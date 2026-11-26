// The 3D body: one .glb per layer (assets/3d/, built by tools/model3d/build.py), drawn with three.js into a <canvas>.
// Its interface mirrors js/map.js where it can (render, setHover, probe, keys), so main.js treats it as another view.
// Every mesh carries its graph key in userData.key (`femur:right`) and userData.sex when it exists for one sex only;
// joint markers (in the skeleton file) also carry userData.joint, their class. The skin (skin.glb) is the body you tap
// in "Where does it hurt?": its _hurt vertex attribute holds each vertex's place in the 2D drawings' frame and its area.
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
// the skin on a body-area page: the chosen area tinted, the rest nearly clear, so what lies under it shows
const AREA_ALPHA = 0.55, SKIN_ALPHA = 0.08;

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
      const toks = m.userData.joint ? [`--j-${m.userData.joint}`] : tokenFor(m.userData.id, info);
      m.userData.base = toks.map(get).find(Boolean) || get('--bone-back') || new THREE.Color(0xdddddd);
    }
    colours.sel = get('--sel') || new THREE.Color(0xc8402a);
    colours.selFill = get('--sel-fill') || new THREE.Color(0xf4b9a9);
    colours.rel = get('--rel') || new THREE.Color(0x1f7a80);
    colours.paper = get('--paper') || new THREE.Color(0xf3eee4);
    colours.hover = get('--hover-fill') || new THREE.Color(0xfff3d6);
    colours.skin = (get('--paper-3') || new THREE.Color(0xe9e2d4)).clone().lerp(get('--muscle') || new THREE.Color(0xb65a4e), 0.12);
    xrayMat.color.copy(colours.sel);
    probeMat.color.copy(colours.sel);
    paintSkin();
    if (state) render(state);
  }
  const xrayMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthTest: false, depthWrite: false });
  // the tapped spot on a body-area page
  const probeMat = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true });
  const probeDot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 12), probeMat);
  probeDot.renderOrder = 12;
  probeDot.visible = false;
  scene.add(probeDot);
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
          // joint markers sit where bones meet, often inside a socket: drawn on top, like the 2D dots
          if (o.userData.joint) { o.material.depthTest = false; o.renderOrder = 8; }
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

  // ---- the skin ("Where does it hurt?")
  let skin = null; // { mesh, regions: [key], scale, region: Int32Array (per vertex), colour: Float32Array }
  let skinLoad = null;
  let hoverRegion = null;
  function loadSkin(url) {
    if (!skinLoad) {
      skinLoad = loader.loadAsync(url).then((gltf) => {
        let mesh = null;
        gltf.scene.traverse((o) => { if (o.isMesh && o.userData.skin) mesh = o; });
        if (!mesh) throw new Error('skin.glb has no skin mesh');
        const g = mesh.geometry;
        const hurt = g.attributes._hurt;
        const n = hurt.count;
        const region = new Int32Array(n);
        for (let i = 0; i < n; i++) region[i] = hurt.getZ(i);
        const colour = new Float32Array(n * 4); // rgba: the alpha clears the skin around a chosen area
        g.setAttribute('color', new THREE.BufferAttribute(colour, 4));
        mesh.material = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, vertexColors: true });
        mesh.renderOrder = 5;
        mesh.visible = false;
        skin = { mesh, regions: mesh.userData.regions || [], scale: mesh.userData.flatScale || 16, region, colour };
        scene.add(gltf.scene);
        paintSkin();
        if (state) render(state);
      }).catch((err) => { skinLoad = null; throw err; });
    }
    return skinLoad;
  }
  // each area a slightly different shade, so the areas can be told apart; the chosen one in the selection colour
  const shade = (k) => { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h >>> 0) % 7) / 7 - 0.5; };
  function paintSkin() {
    if (!skin || !colours.skin) return;
    const rsel = state?.rsel || new Set();
    const ok = state?.regionOk || (() => true);
    const tones = skin.regions.map((k) => {
      if (!k || !ok(k)) return colours.skin.clone().multiplyScalar(0.94);
      if (rsel.has(k)) return colours.skin.clone().lerp(colours.sel, 0.55);
      if (k === hoverRegion) return colours.skin.clone().lerp(colours.sel, 0.25);
      return colours.skin.clone().offsetHSL(0, 0, shade(k) * 0.05);
    });
    const alphas = skin.regions.map((k) => (!rsel.size ? 1 : rsel.has(k) ? AREA_ALPHA : SKIN_ALPHA));
    const c = skin.colour;
    for (let i = 0; i < skin.region.length; i++) {
      const t = tones[skin.region[i]] || colours.skin;
      c[i * 4] = t.r; c[i * 4 + 1] = t.g; c[i * 4 + 2] = t.b; c[i * 4 + 3] = alphas[skin.region[i]] ?? SKIN_ALPHA;
    }
    skin.mesh.geometry.attributes.color.needsUpdate = true;
    invalidate();
  }
  // the area under a screen point: { rkey, flat: {x, y} in the 2D frame, world: {x, y, z} } or null
  const tri = new THREE.Triangle(), bary = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  function regionAt(clientX, clientY) {
    if (!skin?.mesh.visible) return null;
    aim(clientX, clientY);
    const h = ray.intersectObject(skin.mesh, false)[0];
    if (!h?.face) return null;
    const pos = skin.mesh.geometry.attributes.position, hurt = skin.mesh.geometry.attributes._hurt;
    const { a, b, c } = h.face;
    tri.set(pa.fromBufferAttribute(pos, a), pb.fromBufferAttribute(pos, b), pc.fromBufferAttribute(pos, c));
    tri.getBarycoord(skin.mesh.worldToLocal(h.point.clone()), bary);
    const w = [bary.x, bary.y, bary.z], vs = [a, b, c];
    // the area of the corner nearest the hit (areas don't blend), the 2D point blended
    const near = vs[w.indexOf(Math.max(...w))];
    const rkey = skin.regions[skin.region[near]] || null;
    const ok = state?.regionOk || (() => true);
    const x = vs.reduce((s, v, i) => s + w[i] * hurt.getX(v), 0) / skin.scale;
    const y = vs.reduce((s, v, i) => s + w[i] * hurt.getY(v), 0) / skin.scale;
    return { rkey: rkey && ok(rkey) ? rkey : null, flat: { x, y }, world: { x: h.point.x, y: h.point.y, z: h.point.z } };
  }
  // frame body areas from the side they are on (the lower back from behind)
  function frameRegions(rkeys) {
    if (!skin) return;
    const want = new Set(rkeys.map((k) => skin.regions.indexOf(k)).filter((i) => i > 0));
    const pos = skin.mesh.geometry.attributes.position, nrm = skin.mesh.geometry.attributes.normal;
    const b = new THREE.Box3(), p = new THREE.Vector3();
    let nz = 0;
    skin.mesh.updateWorldMatrix(true, false);
    for (let i = 0; i < skin.region.length; i++) {
      if (!want.has(skin.region[i])) continue;
      b.expandByPoint(p.fromBufferAttribute(pos, i).applyMatrix4(skin.mesh.matrixWorld));
      nz += nrm.getZ(i);
    }
    if (b.isEmpty()) return;
    const c = b.getCenter(new THREE.Vector3());
    const r = Math.max(b.getSize(new THREE.Vector3()).length() / 2, 0.05);
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (Math.sign(dir.z || 1) !== Math.sign(nz || 1)) dir.set(0, 0.15, Math.sign(nz || 1)).normalize();
    moveTo(c.clone().add(dir.multiplyScalar(fitDistance(r) * 1.3)), c);
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

  // v: { sel, rel, rsel, visible, active, sex, joints, hurt, probe, regionOk } as map.render gets them: Sets of keys,
  // region keys and layer ids; probe is the tapped spot ({x, y, z}); regionOk(rkey) says whether an area exists now
  function render(v) {
    const rselChanged = !state || state.rsel !== v.rsel || state.regionOk !== v.regionOk;
    state = { ...v, rsel: v.rsel || new Set() };
    v = state;
    for (const x of xray) x.removeFromParent();
    xray = [];
    const hasSel = v.sel.size > 0;
    // "Where does it hurt?": a solid body to tap; on an area's page the skin turns see-through over the anatomy
    const hurtHome = !!v.hurt && !v.rsel.size;
    if (skin) {
      skin.mesh.visible = !!v.hurt;
      const m = skin.mesh.material;
      if (m.transparent !== !hurtHome) { m.transparent = !hurtHome; m.needsUpdate = true; }
      m.depthWrite = hurtHome;
      if (rselChanged) paintSkin();
    }
    for (const [layer, g] of groups) g.visible = v.visible.has(layer) && !(hurtHome && skin);
    probeDot.visible = !!v.probe && !!v.hurt;
    if (v.probe) probeDot.position.set(v.probe.x, v.probe.y, v.probe.z);
    for (const m of meshes) {
      const k = m.userData.key;
      m.visible = shownFor(m, v.sex);
      // joint markers: with the joints on and the skeleton in focus, as in 2D (or when they're part of the selection)
      if (m.userData.joint) m.visible = !v.hurt && (v.sel.has(k) || v.rel.has(k) || (!!v.joints && v.active === 'skeleton'));
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

  function setHover(keys = [], rkeys = []) {
    hovered = new Set(keys);
    const r = rkeys[0] || null;
    if (r !== hoverRegion) { hoverRegion = r; paintSkin(); }
    if (state) render(state);
  }

  // ---- picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function aim(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  // all: every loaded structure, hidden or not (but not the joint markers): "Under this spot"
  function hits(clientX, clientY, { all = false } = {}) {
    aim(clientX, clientY);
    const sex = state?.sex;
    // the raycaster doesn't skip hidden objects, so pass only the ones that count
    const pool = meshes.filter((m) => shownFor(m, sex) && (all ? !m.userData.joint : m.visible && groups.get(m.userData.layer)?.visible));
    return ray.intersectObjects(pool, false);
  }
  // the first hit in the layer in focus (context layers are see-through), else the first hit at all
  // a joint marker wins, since it is drawn on top of the bones
  const topOf = (h) => (h.find((x) => x.object.userData.joint) || h.find((x) => x.object.userData.layer === state?.active) || h[0])?.object.userData.key || null;
  // a near miss still counts, so thin nerves and vessels can be tapped (the 2D map's wider .hit strokes):
  // rings of rays around the point, nearest ring first; fingers get wider rings
  const coarse = matchMedia('(pointer: coarse)');
  function keyAt(clientX, clientY, { rings = coarse.matches ? [7, 14] : [4, 8] } = {}) {
    const k = topOf(hits(clientX, clientY));
    if (k) return k;
    for (const r of rings) {
      const ring = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ring.push(...hits(clientX + Math.cos(a) * r, clientY + Math.sin(a) * r));
      }
      ring.sort((a, b) => a.distance - b.distance);
      const near = topOf(ring);
      if (near) return near;
    }
    return null;
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
    if (!tap) return;
    if (state?.hurt) {
      const r = regionAt(e.clientX, e.clientY);
      onPick({ key: null, rkey: r?.rkey || null, clientX: e.clientX, clientY: e.clientY, flat: r?.flat || null, world: r?.world || null });
    } else onPick({ key: keyAt(e.clientX, e.clientY), rkey: null, clientX: e.clientX, clientY: e.clientY });
  });
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('pointerleave', () => { onHover(null); if (hoverRegion) { hoverRegion = null; paintSkin(); } });
  let hoverRaf = 0, hoverXY = null;
  function hoverAt(x, y) {
    hoverXY = [x, y];
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const [cx, cy] = hoverXY;
      if (state?.hurt) {
        const rk = regionAt(cx, cy)?.rkey || null;
        canvas.style.cursor = rk ? 'pointer' : '';
        if (rk !== hoverRegion) { hoverRegion = rk; paintSkin(); }
        onHover(rk ? { key: null, rkey: rk } : null, cx, cy);
        return;
      }
      const k = keyAt(cx, cy, { rings: [5] }); // one ring: hover runs on every mouse move
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
    load, loadSkin, render, setHover, probe, home, zoomBy, orbit, face, invalidate, resize, frameRegions,
    frame: frameKeys,
    hasLayer: (layer) => groups.has(layer),
    hasSkin: () => !!skin,
    has: (k) => index.has(k),
    keys: () => [...index.keys()],
    get facingFront() { return facingFront !== false; },
  };
}
