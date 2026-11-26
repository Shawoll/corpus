// The 3D body: one .glb per layer (assets/3d/, built by tools/model3d/build.py), drawn with three.js into a <canvas>.
// Its interface mirrors js/map.js where it can (render, setHover, probe, keys), so main.js treats it as another view.
// Every mesh carries its graph key in userData.key (`femur:right`) and userData.sex when it exists for one sex only.
// Loaded only when the 3D view is first opened (main.js imports this module dynamically), so three.js and the models
// cost nothing until then.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAP_PX = 6; // a press that moves less than this is a tap, not a drag-to-turn
const CONTEXT_OPACITY = 0.2; // layers shown for context, as in the 2D map
const FOV = 30;

// colour token for a mesh: info(id) gives { layer, kind } from the data
function tokenFor(id, info) {
  const { layer, kind } = info(id) || {};
  switch (layer) {
    case 'skeleton': return ['--bone-back'];
    case 'muscles': return ['--muscle'];
    case 'ligaments': return ['--ligament'];
    case 'vessels': return [kind === 'vein' ? '--vein' : '--artery'];
    case 'nerves': return ['--nerve'];
    case 'lymphatics': return ['--lymph'];
    case 'organs': return [`--o-${id}`, ['testis', 'ovary'].includes(id) ? '--o-gonad' : '--o-repro'];
    default: return ['--bone-back'];
  }
}

export function createModel3d({ canvas, bounds, info, onPick = () => {}, onHover = () => {}, onTurn = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0); // the map's own background shows through
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 50);
  scene.add(camera);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7d6c, 1.6);
  scene.add(hemi);
  // a headlight that turns with the camera, so whatever faces the viewer is lit
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(0.6, 0.8, 1);
  camera.add(key);
  camera.add(key.target);
  key.target.position.set(0, 0, -1);

  const lo = new THREE.Vector3(...bounds[0]), hi = new THREE.Vector3(...bounds[1]);
  const body = new THREE.Box3(lo, hi);
  const centre = body.getCenter(new THREE.Vector3());

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minPolarAngle = 0.18; // no flipping over the top or under the feet
  controls.maxPolarAngle = Math.PI - 0.18;
  controls.minDistance = 0.12;
  controls.maxDistance = 7;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = true;
  controls.target.copy(centre);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const groups = new Map(); // layer id -> THREE.Group
  const loading = new Map(); // layer id -> Promise
  const index = new Map(); // key -> [mesh]
  const meshes = []; // every mesh
  let colours = {}; // token -> THREE.Color
  let state = null; // the last render() argument
  let hovered = new Set();
  let xray = [];

  // ---- colours (from the CSS tokens, re-read when the theme changes)
  function readColours() {
    const cs = getComputedStyle(document.documentElement);
    colours = {};
    const get = (name) => {
      if (!(name in colours)) {
        const v = cs.getPropertyValue(name).trim();
        colours[name] = v ? new THREE.Color().setStyle(v) : null;
      }
      return colours[name];
    };
    for (const m of meshes) {
      const toks = tokenFor(m.userData.id, info);
      m.userData.base = toks.map(get).find(Boolean) || get('--bone-back') || new THREE.Color(0xdddddd);
    }
    colours.sel = get('--sel') || new THREE.Color(0xc8402a);
    colours.selFill = get('--sel-fill') || new THREE.Color(0xf4b9a9);
    colours.rel = get('--rel') || new THREE.Color(0x1f7a80);
    colours.paper = get('--paper') || new THREE.Color(0xf3eee4);
    colours.hover = get('--hover-fill') || new THREE.Color(0xfff3d6);
    xrayMat.color.copy(colours.sel);
    if (state) render(state);
  }
  const xrayMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthTest: false, depthWrite: false });
  new MutationObserver(readColours).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColours);

  // ---- loading
  function load(layer, url) {
    if (groups.has(layer)) return Promise.resolve();
    if (!loading.has(layer)) {
      loading.set(layer, loader.loadAsync(url).then((gltf) => {
        const g = gltf.scene;
        g.name = layer;
        g.traverse((o) => {
          if (!o.isMesh || !o.userData.key) return;
          const k = o.userData.key;
          o.userData.id = k.split(':')[0];
          o.userData.layer = layer;
          o.material = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0 });
          if (!index.has(k)) index.set(k, []);
          index.get(k).push(o);
          meshes.push(o);
        });
        scene.add(g);
        groups.set(layer, g);
        readColours();
        invalidate();
      }).catch((err) => { loading.delete(layer); throw err; }));
    }
    return loading.get(layer);
  }

  // ---- rendering (on demand: a frame only when something changed, or while the camera settles)
  let raf = 0;
  let anim = null; // { from: {pos, target}, to: {pos, target}, t0, ms }
  let facingFront = null;
  function invalidate() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    let again = false;
    if (anim) {
      const t = Math.min(1, (now - anim.t0) / anim.ms);
      const e = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(anim.from.pos, anim.to.pos, e);
      controls.target.lerpVectors(anim.from.target, anim.to.target, e);
      if (t >= 1) anim = null;
      again = true;
    }
    if (controls.update()) again = true;
    renderer.render(scene, camera);
    const front = camera.position.z - controls.target.z >= 0;
    if (front !== facingFront) { facingFront = front; onTurn(front); }
    if (again) invalidate();
  }
  controls.addEventListener('change', invalidate);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  }
  new ResizeObserver(resize).observe(canvas);

  // the distance at which a sphere of radius r fills the view
  function fitDistance(r) {
    const v = THREE.MathUtils.degToRad(FOV) / 2;
    const hz = Math.atan(Math.tan(v) * camera.aspect);
    return r / Math.sin(Math.min(v, hz));
  }
  function moveTo(pos, target, ms = 480) {
    if (reduced()) {
      anim = null;
      camera.position.copy(pos);
      controls.target.copy(target);
    } else anim = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to: { pos, target: target.clone() }, t0: performance.now(), ms };
    invalidate();
  }
  // look at the whole body from the front (dir +1) or the back (-1)
  function home(dir = Math.sign(camera.position.z - controls.target.z) || 1) {
    const r = body.getSize(new THREE.Vector3()).y / 2;
    const d = fitDistance(r) * 1.02;
    moveTo(new THREE.Vector3(centre.x, centre.y, centre.z + dir * d), centre);
  }
  function zoomBy(f) {
    const off = camera.position.clone().sub(controls.target);
    const len = THREE.MathUtils.clamp(off.length() * f, controls.minDistance, controls.maxDistance);
    moveTo(controls.target.clone().add(off.setLength(len)), controls.target, 220);
  }
  // turn around the target: azimuth (left/right) and polar (up/down) in radians, for the arrow keys
  function orbit(dAz, dPol) {
    const off = camera.position.clone().sub(controls.target);
    const s = new THREE.Spherical().setFromVector3(off);
    s.theta += dAz;
    s.phi = THREE.MathUtils.clamp(s.phi + dPol, controls.minPolarAngle, controls.maxPolarAngle);
    moveTo(controls.target.clone().add(new THREE.Vector3().setFromSpherical(s)), controls.target, 160);
  }
  function face(view) { home(view === 'posterior' ? -1 : 1); }

  const shownFor = (m, sex) => !m.userData.sex || m.userData.sex === sex;
  const boxOf = (keys) => {
    const b = new THREE.Box3();
    for (const k of keys) for (const m of index.get(k) || []) if (!state || shownFor(m, state.sex)) b.expandByObject(m);
    return b;
  };
  // bring keys into view, keeping the current direction; a pair of tiny parts (both hands' carpals) frames the first
  function frameKeys(keys, { parts = null } = {}) {
    let b = boxOf(keys);
    if (b.isEmpty()) return;
    if (parts?.length > 1) {
      const bs = parts.map((k) => boxOf([k])).filter((x) => !x.isEmpty());
      if (bs.length > 1 && bs.every((x) => x.getSize(new THREE.Vector3()).length() < 0.12)) b = bs[0];
    }
    const c = b.getCenter(new THREE.Vector3());
    const r = Math.max(b.getSize(new THREE.Vector3()).length() / 2, 0.05);
    const dir = camera.position.clone().sub(controls.target).normalize();
    moveTo(c.clone().add(dir.multiplyScalar(fitDistance(r) * 1.4)), c);
  }

  // v: { sel, rel, visible, active, sex } (Sets of keys / layer ids), as map.render gets
  function render(v) {
    state = v;
    for (const x of xray) x.removeFromParent();
    xray = [];
    const hasSel = v.sel.size > 0;
    for (const [layer, g] of groups) g.visible = v.visible.has(layer);
    for (const m of meshes) {
      const k = m.userData.key;
      m.visible = shownFor(m, v.sex);
      const mat = m.material;
      const sel = v.sel.has(k), rel = v.rel.has(k);
      const context = m.userData.layer !== v.active;
      const c = mat.color.copy(m.userData.base);
      if (sel) c.lerp(colours.sel, 0.55);
      else if (rel) c.lerp(colours.rel, 0.5);
      else if (hasSel && !context) c.lerp(colours.paper, 0.35);
      mat.emissive.copy(hovered.has(k) ? colours.hover : colours.sel).multiplyScalar(hovered.has(k) ? 0.22 : sel ? 0.12 : 0);
      const fade = context && !sel && !rel;
      const opacity = fade ? CONTEXT_OPACITY : context ? 0.85 : 1;
      if (mat.transparent !== opacity < 1) { mat.transparent = opacity < 1; mat.needsUpdate = true; }
      mat.opacity = opacity;
      mat.depthWrite = opacity === 1;
      // the selection drawn again on top, faintly, so a part hidden behind others still shows (the 2D outline overlay)
      if (sel && m.visible && groups.get(m.userData.layer)?.visible) {
        const x = new THREE.Mesh(m.geometry, xrayMat);
        x.renderOrder = 10;
        x.raycast = () => {};
        m.add(x);
        xray.push(x);
      }
    }
    invalidate();
  }

  function setHover(keys = []) {
    hovered = new Set(keys);
    if (state) render(state);
  }

  // ---- picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hits(clientX, clientY, { all = false } = {}) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const sex = state?.sex;
    // the raycaster doesn't skip hidden objects, so pass only the ones that count
    const pool = meshes.filter((m) => shownFor(m, sex) && (all || (m.visible && groups.get(m.userData.layer)?.visible)));
    return ray.intersectObjects(pool, false);
  }
  // the first hit in the layer in focus (context layers are see-through), else the first hit at all
  function keyAt(clientX, clientY) {
    const h = hits(clientX, clientY);
    const top = h.find((x) => x.object.userData.layer === state?.active) || h[0];
    return top?.object.userData.key || null;
  }
  // everything under a screen point, in every loaded layer (hidden ones too), nearest first: "Under this spot"
  function probe(clientX, clientY) {
    const out = [];
    for (const x of hits(clientX, clientY, { all: true })) if (!out.includes(x.object.userData.key)) out.push(x.object.userData.key);
    return out;
  }

  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    anim = null;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_PX) down.moved = true;
    if (e.pointerType !== 'mouse' || e.buttons) return;
    hoverAt(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || e.pointerId !== down.id) return;
    const tap = !down.moved;
    down = null;
    if (tap) onPick({ key: keyAt(e.clientX, e.clientY), rkey: null, clientX: e.clientX, clientY: e.clientY });
  });
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('pointerleave', () => onHover(null));
  let hoverRaf = 0, hoverXY = null;
  function hoverAt(x, y) {
    hoverXY = [x, y];
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const [cx, cy] = hoverXY;
      const k = keyAt(cx, cy);
      canvas.style.cursor = k ? 'pointer' : '';
      onHover(k ? { key: k, rkey: null } : null, cx, cy);
    });
  }

  // keyboard: arrow keys turn the body while the canvas has focus
  canvas.addEventListener('keydown', (e) => {
    const step = Math.PI / 12;
    const turn = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step / 2], ArrowDown: [0, step / 2] }[e.key];
    if (!turn) return;
    e.preventDefault();
    orbit(...turn);
  });

  readColours();
  resize();
  // start at the whole body, from the front
  camera.position.set(centre.x, centre.y, centre.z + fitDistance(body.getSize(new THREE.Vector3()).y / 2));
  controls.update();

  return {
    load, render, setHover, probe, home, zoomBy, orbit, face, invalidate, resize,
    frame: frameKeys,
    hasLayer: (layer) => groups.has(layer),
    has: (k) => index.has(k),
    keys: () => [...index.keys()],
    get facingFront() { return facingFront !== false; },
  };
}
