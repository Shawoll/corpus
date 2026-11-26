// Corpus — boot & wiring. No build step: plain ES modules, JSON data and SVG assets.
import { createStore } from './state.js';
import { Graph, parseKey } from './graph.js';
import { createMap } from './map.js';
import { createZoom } from './zoom.js';
import { createPanel } from './panel.js';
import { createSearch } from './search.js';
import { buildBrowse } from './browse.js';
import { forSex } from './sex.js';
import * as Router from './router.js';

const $ = (s) => document.querySelector(s);
const prefs = {
  get(k, d) { try { const v = localStorage.getItem('corpus:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('corpus:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const applyTheme = (t) => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
applyTheme(prefs.get('theme', null));

async function load(url, as = 'json') {
  const r = await fetch(url, { cache: 'no-cache' }); // revalidate data/SVG so edits show up straight away
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return as === 'json' ? r.json() : r.text();
}

async function boot() {
  const manifest = await load('data/manifest.json');
  const views = manifest.views?.length ? manifest.views : [{ id: 'anterior', name: 'Front' }];
  // the 3D view ("model": true) has no SVG drawings: each layer's "model" is a .glb, loaded by js/model3d.js on demand
  const svgViews = views.filter((v) => !v.model);
  const modelView = views.find((v) => v.model)?.id || null;
  const is3d = (v) => v === modelView;
  // a layer's "svg" maps view id -> file; a plain string means the first view only
  const svgMap = (spec) => (typeof spec === 'string' ? { [views[0].id]: spec } : spec || {});
  const loadSvgs = async (spec) => Object.fromEntries(await Promise.all(Object.entries(svgMap(spec)).map(async ([v, url]) => [v, await load(url, 'text')])));
  // drawing styles: the first is the default drawing in a layer's "svg"; a layer's "styles" adds per-style drawings,
  // which are fetched only when first shown (ensureStyle below), so a first visit downloads the default drawings only
  const styles = manifest.styles?.length ? manifest.styles : [{ id: 'schematic', name: 'Schematic' }];
  const [datas, svgs, linkFiles, regionsData, regionSvgs, modelIndex] = await Promise.all([
    Promise.all(manifest.layers.map((l) => load(l.data))),
    Promise.all(manifest.layers.map((l) => loadSvgs(l.svg))),
    Promise.all((manifest.links || []).map((u) => load(u))),
    manifest.regions ? load(manifest.regions.data) : { regions: [] },
    manifest.regions ? loadSvgs(manifest.regions.svg) : {},
    // which keys the 3D model has (a few KB), so routes can pick a view without loading any model
    modelView && manifest.model3d ? load(manifest.model3d.keys).catch(() => null) : null,
  ]);
  // layer id -> Set(key) in its .glb; only layers the manifest gives a "model" count
  const modelKeys = new Map(manifest.layers.filter((l) => l.model && modelIndex?.layers?.[l.id]).map((l) => [l.id, new Set(modelIndex.layers[l.id])]));
  const inModel = (k) => [...modelKeys.values()].some((s) => s.has(k));
  const layers = manifest.layers.map((l, i) => ({ ...l, data: datas[i], svgs: svgs[i] }));
  // biological sex: one graph per setting, built on first use from the data filtered by js/sex.js (the first is neutral)
  const sexes = manifest.sexes?.length ? manifest.sexes : [{ id: 'none', name: 'Not set' }];
  const sexById = new Map(sexes.map((x) => [x.id, x]));
  const raw = { layers, links: linkFiles.flatMap((f) => f.links || []), linkTypes: manifest.linkTypes, regions: regionsData };
  const graphs = new Map();
  const graphFor = (sx) => { if (!graphs.has(sx)) graphs.set(sx, new Graph(forSex(raw, sx))); return graphs.get(sx); };
  const savedSex = prefs.get('sex', sexes[0].id);
  const initialSex = sexById.has(savedSex) ? savedSex : sexes[0].id;
  let graph = graphFor(initialSex);

  const svg = $('#map');
  const wrap = $('.map-wrap');
  const tooltip = $('#tooltip');
  const panelEl = $('#panel');
  const panelBody = $('#panel-body');
  const hint = $('#map-hint');
  const hintText = hint?.textContent;
  let panel = createPanel(graph);
  let search = null, browse = null; // created further down; useSex() rebuilds them

  const viewById = new Map(views.map((v) => [v.id, v]));
  const savedView = prefs.get('view', views[0].id);
  const styleById = new Map(styles.map((s) => [s.id, s]));
  const savedStyle = prefs.get('style', styles[0].id);
  const store = createStore({
    route: { view: 'home' },
    view: viewById.has(savedView) ? savedView : views[0].id, // front / back (not part of the route)
    style: styleById.has(savedStyle) ? savedStyle : styles[0].id, // schematic / realistic drawings (not part of the route)
    sex: initialSex, // biological sex: none / female / male (not part of the route)
    visible: new Set(manifest.layers.filter((l) => l.visible).map((l) => l.id)),
    active: [...manifest.layers].reverse().find((l) => l.visible)?.id,
    joints: prefs.get('joints', true),
    jointStyle: prefs.get('jointStyle', 'anatomy') === 'dots' ? 'dots' : 'anatomy', // realistic drawings: joints as anatomy or as dots
    mirror: prefs.get('mirror', false),
    probe: null,
    fromRegion: null,
    drawings: 0, // bumped when a style's drawings are mounted (ensureStyle)
  });

  const map = createMap({ svg, graph, onPick, onHover });
  map.mount(layers, regionSvgs, svgViews, styles);
  const zoom = createZoom(svg, { onChange: () => {} });

  // ------------------------------------------------------------------ the 3D view (js/model3d.js, loaded on first use)
  const canvas = $('#model3d');
  const modelStatus = $('#model-status');
  let model = null, modelLoad = null, modelFront = true;
  // structure id -> { layer, kind } for every structure, whatever the biological sex (the model's colours)
  const infoById = new Map(layers.flatMap((l) => l.data.structures.map((s) => [s.id, { layer: l.id, kind: s.kind }])));
  const setStatus = (text) => { modelStatus.textContent = text || ''; modelStatus.hidden = !text; };
  function ensureModel() {
    if (!modelLoad) {
      setStatus('Loading the 3D body…');
      modelLoad = import('./model3d.js').then(({ createModel3d }) => {
        model = createModel3d({
          canvas, bounds: modelIndex.bounds, info: (id) => infoById.get(id), onPick, onHover,
          onTurn: (front) => { modelFront = front; renderControls(store.get()); if (!settingsEl.hidden) renderSettings(store.get()); },
        });
        return model;
      }).catch((err) => { modelLoad = null; setStatus('The 3D view couldn’t load.'); throw err; });
    }
    return modelLoad;
  }
  // load the .glb of every visible layer that has one (each once), then draw
  const modelLayerLoads = new Map();
  function ensureModelLayers(st) {
    return ensureModel().then((m) => {
      const want = manifest.layers.filter((l) => l.model && modelKeys.has(l.id) && st.visible.has(l.id) && !m.hasLayer(l.id));
      if (!want.length) { setStatus(''); renderMap(store.get()); return; }
      setStatus('Loading the 3D body…');
      return Promise.all(want.map((l) => {
        if (!modelLayerLoads.has(l.id)) modelLayerLoads.set(l.id, m.load(l.id, l.model).catch((err) => { modelLayerLoads.delete(l.id); throw err; }));
        return modelLayerLoads.get(l.id);
      })).then(() => { setStatus(''); renderMap(store.get()); })
        .catch((err) => { setStatus('Part of the 3D body couldn’t load.'); console.warn('[Corpus] 3D model failed to load', err); });
    });
  }

  // ------------------------------------------------------------------ views (front / back / 3D)
  const layersIn = (v) => (is3d(v) ? manifest.layers.filter((l) => modelKeys.has(l.id)) : manifest.layers.filter((l) => svgMap(l.svg)[v])).map((l) => l.id);
  // the back view is drawn in the front's frame and shown flipped; Mirror only applies to views that aren't flipped
  const flipOf = (st) => (is3d(st.view) ? false : viewById.get(st.view)?.flip ? true : st.mirror);
  // the layer in focus, falling back to the top-most visible layer this view has a drawing for
  const activeIn = (st) => {
    const here = layersIn(st.view);
    if (here.includes(st.active) && st.visible.has(st.active)) return st.active;
    return [...here].reverse().find((id) => st.visible.has(id)) || null;
  };
  // patch that switches to view v, keeping at least one layer that is drawn there visible
  // the 2D view to return to from 3D (the Display row and the M key)
  let lastFlat = svgViews.some((x) => x.id === prefs.get('view', '')) ? prefs.get('view', '') : svgViews[0].id;
  function viewPatch(st, v) {
    if (!viewById.has(v) || v === st.view) return {};
    prefs.set('view', v);
    if (!is3d(v)) lastFlat = v;
    const patch = { view: v };
    const here = layersIn(v);
    const visible = st.visible;
    if (here.length && !here.some((id) => visible.has(id))) patch.visible = new Set([...visible, here[0]]);
    return patch;
  }
  // keys a route points at, and the views where they are drawn: switch only when the current view doesn't show them
  // (the 3D model counts as a view for structures it has a mesh for; "Where does it hurt?" is 2D only for now)
  function viewFor(route, current) {
    let found = [];
    const withModel = (keys) => {
      const vs = map.viewsOf(keys);
      return modelView && keys.some(inModel) ? views.map((v) => v.id).filter((v) => vs.includes(v) || v === modelView) : vs;
    };
    if (route.view === 'node') {
      const n = graph.node(route.id);
      if (n) found = withModel(graph.keysFor(n.id, n.paired ? route.side : null));
    } else if (route.view === 'group') found = withModel(graph.groupKeys(route.id));
    else if (route.view === 'region') {
      const r = graph.regions.get(route.id);
      if (r) found = map.viewsOf(graph.regionKeys(r.id, r.paired ? route.side : null), { regions: true });
    }
    if (Router.isHurt(route) && is3d(current) && !found.length) return svgViews[0].id;
    return !found.length || found.includes(current) ? current : found[0];
  }
  const setView = (v) => store.set(viewPatch(store.get(), v));
  // a style other than the default only exists where some layer has a drawing for it in this view
  const styleIn = (s, v) => s === styles[0].id || manifest.layers.some((l) => l.styles?.[s]?.[v]);
  // whether the drawings shown in this view and style draw any joint as anatomy (`.ja`, the realistic skeleton)
  const anatomyIn = (st) => !!svg.querySelector(`.view[data-view="${st.view}"] .layer[data-style="${styleIn(st.style, st.view) ? st.style : styles[0].id}"] .ja`);
  const setStyle = (s) => { if (!styleById.has(s)) return; prefs.set('style', s); store.set({ style: s }); };
  // fetch and mount a style's drawings for one view, once; until then the map shows the default drawings there
  const styleLoads = new Map(); // 'style|view' -> Promise
  function ensureStyle(s, v) {
    const id = `${s}|${v}`;
    if (map.hasStyle(s, v) || !styleIn(s, v)) return Promise.resolve();
    if (!styleLoads.has(id)) {
      const files = manifest.layers.filter((l) => l.styles?.[s]?.[v]).map((l) => [l.id, l.styles[s][v]]);
      styleLoads.set(id, Promise.all(files.map(async ([layer, url]) => [layer, await load(url, 'text')]))
        .then((texts) => {
          map.addStyle(s, v, Object.fromEntries(texts));
          store.set({ drawings: store.get().drawings + 1 }); // re-render the map and the cog with the new drawings
        })
        .catch((err) => { styleLoads.delete(id); console.warn(`[Corpus] ${s} drawings (${v}) failed to load`, err); }));
    }
    return styleLoads.get(id);
  }
  // the current view's drawings in the current style first, then that style's other views in the background
  function ensureShown(st) {
    if (st.style === styles[0].id) return Promise.resolve();
    return ensureStyle(st.style, st.view).then(() => Promise.all(views.map((v) => ensureStyle(st.style, v.id))));
  }

  // ------------------------------------------------------------------ biological sex
  // does the route's structure, group or region exist in this graph? (home and hurt always do)
  const routeIn = (g, route) => (route.view === 'node' ? !!g.node(route.id) : route.view === 'group' ? !!g.group(route.id)
    : route.view === 'region' ? g.regions.has(route.id) : true);
  // a shared link to a sex-specific page (#/s/prostate) switches to the sex that has it
  const sexFor = (route, current) => (routeIn(graphFor(current), route) ? current
    : sexes.map((x) => x.id).find((x) => routeIn(graphFor(x), route)) || current);
  // swap the graph and everything built from it; the caller puts { sex } in its store patch
  function useSex(sx) {
    graph = graphFor(sx);
    panel = createPanel(graph);
    search?.setGraph(graph);
    if (browse) buildBrowse(browse, graph);
    prefs.set('sex', sx);
  }
  function setSex(sx) {
    if (!sexById.has(sx) || sx === store.get().sex) return;
    useSex(sx);
    const st = store.get();
    // an "Under this spot" list was probed with the other sex's shapes: drop it until the next tap
    if (routeIn(graph, st.route)) { store.set({ sex: sx, probe: null }); return; }
    // the page on show doesn't exist for this sex: go home (in the same render, so it never shows "not found")
    store.set({ sex: sx, route: Router.isHurt(st.route) ? { view: 'hurt' } : { view: 'home' }, probe: null, fromRegion: null });
    navigate(Router.isHurt(st.route) ? 'hurt' : '');
  }
  const cycleSex = () => { const i = sexes.findIndex((x) => x.id === store.get().sex); setSex(sexes[(i + 1) % sexes.length].id); };

  // ------------------------------------------------------------------ navigation
  let zoomNext = false;
  const navigate = (path, { zoom: z = false } = {}) => { zoomNext = z; Router.go(path); };
  const regionKey = (r) => (r.side ? `${r.id}:${r.side}` : r.id);

  function onRoute() {
    const prev = store.get();
    const route = Router.parse();
    const sx = sexFor(route, prev.sex);
    if (sx !== prev.sex) useSex(sx);
    const patch = { route, ...(sx !== prev.sex ? { sex: sx } : {}), ...viewPatch(prev, viewFor(route, prev.view)) };
    if (route.view === 'node') {
      const n = graph.node(route.id);
      if (n && !n.listOnly && !Router.isHurt(route)) {
        const vis = new Set(patch.visible || prev.visible);
        vis.add(n.layer);
        patch.visible = vis;
        patch.active = n.layer;
      }
      patch.fromRegion = prev.route.view === 'region' ? prev.route : prev.route.view === 'node' ? prev.fromRegion : null;
    } else patch.fromRegion = null;
    if (Router.isHurt(route) && !Router.isHurt(prev.route)) patch.visible = new Set(layers.map((l) => l.id));
    if (route.view !== 'region' || (prev.probe && prev.probe.rkey !== regionKey(route))) patch.probe = null;
    store.set(patch);

    if (route.view === 'home' || route.view === 'hurt') setSheet('peek');
    else if (sheet === 'peek') setSheet('half');
    if (zoomNext) {
      zoomNext = false;
      requestAnimationFrame(() => revealSelection());
    }
  }

  function highlights(st) {
    const sel = new Set(), rel = new Set(), rsel = new Set();
    const r = st.route;
    if (r.view === 'node') {
      const n = graph.node(r.id);
      if (n) {
        for (const k of graph.keysFor(n.id, n.paired ? r.side : null)) {
          sel.add(k);
          for (const e of graph.edges(k)) rel.add(e.to);
          for (const jk of graph.jointsOf(k)) rel.add(jk);
          if (n.type === 'joint') for (const m of graph.membersOfJoint(k)) rel.add(m);
        }
      }
    } else if (r.view === 'group') {
      graph.groupKeys(r.id).forEach((k) => sel.add(k));
    } else if (r.view === 'region') {
      const reg = graph.regions.get(r.id);
      if (reg) {
        graph.regionKeys(reg.id, reg.paired ? r.side : null).forEach((k) => rsel.add(k));
        graph.regionStructures(reg, reg.paired ? r.side : null).forEach((k) => rel.add(k));
      }
    }
    for (const k of sel) rel.delete(k);
    return { sel, rel, rsel };
  }

  function revealSelection() {
    const st = store.get();
    const h = highlights(st);
    if (is3d(st.view)) {
      if (!h.sel.size) return;
      // the model may still be loading the layer: frame once it's there
      ensureModelLayers(st).then(() => model?.frame([...h.sel], { parts: h.sel.size === 2 ? [...h.sel] : null }));
      return;
    }
    if (st.route.view === 'region') { zoom.reveal(map.bbox([...h.rsel], { regions: true })); return; }
    const parts = h.sel.size > 1 && h.sel.size <= 2 ? [...h.sel].map((k) => map.bbox([k])).filter(Boolean) : null;
    zoom.reveal(map.bbox([...h.sel]), { parts });
  }

  // ------------------------------------------------------------------ map events
  function onPick({ key, rkey, clientX, clientY }) {
    hideHint();
    const st = store.get();
    if (Router.isHurt(st.route)) {
      if (!rkey) return;
      const keys = map.probe(clientX, clientY);
      store.set({ probe: { rkey, keys, point: map.toSvgPoint(clientX, clientY) } });
      const { id, side } = parseKey(rkey);
      navigate(`r/${encodeURIComponent(id)}${side ? '/' + side : ''}`);
      return;
    }
    if (key) {
      const { id, side } = parseKey(key);
      navigate(`s/${encodeURIComponent(id)}${side ? '/' + side : ''}`);
    } else if (st.route.view !== 'home') navigate('');
  }

  function onHover(t, x, y) {
    if (!t) { tooltip.hidden = true; return; }
    const hurt = Router.isHurt(store.get().route);
    let label = '', sub = '';
    if (hurt && t.rkey) {
      const { id, side } = parseKey(t.rkey);
      label = graph.regions.get(id)?.name || id;
      sub = side ? `${side} side` : '';
    } else if (!hurt && t.key) {
      const { id, side } = parseKey(t.key);
      const n = graph.node(id);
      label = n?.name || id;
      sub = [side, n?.type === 'joint' ? 'joint' : ''].filter(Boolean).join(' · ');
    } else { tooltip.hidden = true; return; }
    const r = wrap.getBoundingClientRect();
    tooltip.innerHTML = `${escapeHtml(label)}${sub ? `<span class="tt-sub">${escapeHtml(sub)}</span>` : ''}`;
    tooltip.style.left = `${x - r.left}px`;
    tooltip.style.top = `${y - r.top}px`;
    tooltip.hidden = false;
  }
  function hideHint() { hint?.classList.add('gone'); }

  // ------------------------------------------------------------------ rendering
  function renderControls(st) {
    const hurt = Router.isHurt(st.route);
    for (const b of document.querySelectorAll('.modes button')) b.setAttribute('aria-pressed', String((b.dataset.mode === 'hurt') === hurt));
    const here = layersIn(st.view);
    const active = activeIn(st);
    const vname = viewById.get(st.view)?.name || st.view;
    for (const b of document.querySelectorAll('.layer-chip[data-layer]')) {
      const id = b.dataset.layer;
      const name = b.dataset.name;
      const drawnHere = here.includes(id);
      const state = !drawnHere ? 'na' : !st.visible.has(id) ? 'off' : active === id ? 'active' : 'context';
      b.dataset.state = state;
      b.disabled = !drawnHere;
      b.setAttribute('aria-pressed', String(state === 'active' || state === 'context'));
      b.title = state === 'na' ? (is3d(st.view) ? `${name} aren’t in the 3D model yet` : `${name} aren’t drawn in the ${vname.toLowerCase()} view yet`) : state === 'off' ? `Show ${name}` : state === 'context' ? `Bring ${name} into focus` : `Hide ${name}`;
    }
    svg.setAttribute('aria-label', `${vname} view of the human body. Use search or Browse to reach every structure by keyboard.`);
    canvas.setAttribute('aria-label', '3D model of the human body: drag or use the arrow keys to turn it. Use search or Browse to reach every structure by keyboard.');
    const jb = $('.layer-chip[data-toggle="joints"]');
    jb.dataset.state = st.joints ? 'active' : 'off';
    jb.setAttribute('aria-pressed', String(st.joints));
    // in 3D the sides follow the camera: seen from behind, the body's right is on the viewer's right
    const flip = is3d(st.view) ? !modelFront : flipOf(st);
    const lab = (s) => `<b>${s === 'right' ? 'R' : 'L'}</b><small>body’s ${s}</small>`;
    $('#side-left').innerHTML = lab(flip ? 'left' : 'right');
    $('#side-right').innerHTML = lab(flip ? 'right' : 'left');
    $('#hurt-banner').hidden = st.route.view !== 'hurt';
    if (hint) hint.textContent = is3d(st.view) ? 'Tap a bone · drag to turn · scroll or pinch to zoom' : hintText;
    const t = panel.title(st);
    document.title = t ? `${t} · Corpus` : 'Corpus: a connected map of the human body';
  }
  let lastFlip = null;
  function renderMap(st) {
    const three = is3d(st.view);
    svg.toggleAttribute('hidden', three); // SVG elements have no .hidden property
    canvas.hidden = !three;
    $('.model-credit').hidden = !three;
    if (three) {
      if (!model) { ensureModelLayers(st); return; }
      if (manifest.layers.some((l) => modelKeys.has(l.id) && st.visible.has(l.id) && !model.hasLayer(l.id))) ensureModelLayers(st);
      model.resize();
      const h = highlights(st);
      model.render({ ...h, visible: st.visible, active: activeIn(st), sex: st.sex });
      // a structure the model has no mesh for (the female organs, a few tendons): say so instead of showing nothing
      const n = st.route.view === 'node' ? graph.node(st.route.id) : null;
      if (n && h.sel.size && ![...h.sel].some(inModel)) setStatus(`${n.name} isn’t in the 3D model yet. Switch to 2D to see it.`);
      else if (!modelLayerLoads.size || [...modelKeys.keys()].every((id) => !st.visible.has(id) || model.hasLayer(id))) setStatus('');
      return;
    }
    setStatus('');
    const flip = flipOf(st);
    if (lastFlip !== null && flip !== lastFlip) zoom.mirrorX(); // keep the same body part in frame
    lastFlip = flip;
    map.render({
      ...highlights(st),
      view: st.view,
      style: st.style,
      visible: st.visible,
      active: activeIn(st),
      hurt: Router.isHurt(st.route),
      joints: st.joints,
      jointStyle: st.jointStyle,
      flip,
      sex: st.sex,
      probePoint: st.route.view === 'region' && st.probe ? st.probe.point : null,
    });
  }
  function renderPanel(st, top) {
    panelBody.innerHTML = panel.render(st);
    if (top) { panelBody.scrollTop = 0; panelEl.scrollTop = 0; }
  }
  store.subscribe((st, prev) => {
    if (st.style !== prev.style || st.view !== prev.view) ensureShown(st);
    if (st.route !== prev.route || st.probe !== prev.probe || st.mirror !== prev.mirror || st.fromRegion !== prev.fromRegion || st.visible !== prev.visible || st.view !== prev.view || st.sex !== prev.sex) renderPanel(st, st.route !== prev.route);
    renderMap(st);
    renderControls(st);
  });

  // ------------------------------------------------------------------ controls
  const layerbar = $('#layerbar');
  layerbar.innerHTML = [...manifest.layers].reverse()
    .map((l) => `<button class="layer-chip" data-layer="${l.id}" data-name="${escapeHtml(l.name)}"><span class="sw" aria-hidden="true"></span>${escapeHtml(l.name)}</button>`)
    .join('') + `<button class="layer-chip" data-toggle="joints" title="Show or hide the joints"><span class="sw" aria-hidden="true" style="border-radius:50%"></span>Joints</button>`;
  layerbar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const st = store.get();
    if (b.dataset.toggle === 'joints') { prefs.set('joints', !st.joints); store.set({ joints: !st.joints }); return; }
    const id = b.dataset.layer;
    if (!layersIn(st.view).includes(id)) return;
    const vis = new Set(st.visible);
    const active = activeIn(st);
    if (!vis.has(id)) { vis.add(id); store.set({ visible: vis, active: id }); }
    else if (active !== id) store.set({ active: id });
    else {
      // hide it, but keep at least one layer of this view on
      const others = layersIn(st.view).filter((x) => x !== id && vis.has(x));
      if (!others.length) return;
      vis.delete(id);
      store.set({ visible: vis, active: others[others.length - 1] });
    }
  });

  for (const b of document.querySelectorAll('.modes button')) {
    b.addEventListener('click', () => {
      const hurt = b.dataset.mode === 'hurt';
      if (hurt === Router.isHurt(store.get().route)) return;
      navigate(hurt ? 'hurt' : '');
    });
  }
  // zoom: the SVG's viewBox, or the 3D camera
  const zoomBy = (f) => { if (is3d(store.get().view)) model?.zoomBy(f); else zoom.zoomBy(f); };
  const zoomHome = () => { if (is3d(store.get().view)) model?.home(); else zoom.home(); };
  $('#zoom-in').addEventListener('click', () => { hideHint(); zoomBy(0.7); });
  $('#zoom-out').addEventListener('click', () => zoomBy(1.4));
  $('#zoom-fit').addEventListener('click', () => zoomHome());
  // Front / Back: in 2D the drawings, in 3D which way the model faces (B)
  const facing = (st) => (is3d(st.view) ? (modelFront ? svgViews[0].id : (svgViews[1] || svgViews[0]).id) : st.view);
  const setFacing = (v) => { if (is3d(store.get().view)) model?.face(v); else setView(v); };
  const toggleView = () => {
    const i = svgViews.findIndex((v) => v.id === facing(store.get()));
    setFacing(svgViews[(i + 1) % svgViews.length].id);
  };
  // 2D / 3D (M)
  const setDisplay = (d) => setView(d === '3d' ? modelView : lastFlat);
  const toggleDisplay = () => { if (modelView) setDisplay(is3d(store.get().view) ? '2d' : '3d'); };
  const toggleStyle = () => {
    const st = store.get();
    const here = styles.filter((s) => styleIn(s.id, st.view));
    const i = here.findIndex((s) => s.id === st.style);
    if (here.length > 1) setStyle(here[(i + 1) % here.length].id);
  };
  svg.addEventListener('wheel', hideHint, { passive: true, once: true });
  canvas.addEventListener('pointerdown', hideHint, { once: true });

  // ------------------------------------------------------------------ settings (cog)
  // Each row is a segmented switch, marked up as a radio group: one Tab stop per row (the checked option), arrow
  // keys move and choose, as with native radios. value(st) gives the checked option, set(v) applies it, off(v, st)
  // disables one, why says why (shown as its tooltip), keys names the row's shortcut.
  const settingRows = [
    { id: 'theme', label: 'Theme', opts: [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']],
      value: () => prefs.get('theme', null) || 'auto',
      set: (v) => { const t = v === 'auto' ? null : v; applyTheme(t); prefs.set('theme', t); } },
    { id: 'display', label: 'Display', keys: 'M', opts: [['2d', '2D'], ['3d', '3D']], hide: !modelView,
      value: (st) => (is3d(st.view) ? '3d' : '2d'), set: (v) => setDisplay(v),
      off: (v, st) => v === '3d' && Router.isHurt(st.route), why: '“Where does it hurt?” is 2D only for now' },
    { id: 'view', label: 'View', keys: 'B', opts: svgViews.map((v) => [v.id, v.name]), hide: svgViews.length < 2,
      value: (st) => facing(st), set: (v) => setFacing(v) },
    { id: 'style', label: 'Drawings', keys: 'D', opts: styles.map((s) => [s.id, s.name]), hide: styles.length < 2,
      value: (st) => (styleIn(st.style, st.view) ? st.style : styles[0].id), set: (v) => setStyle(v),
      off: (v, st) => !styleIn(v, st.view), why: (st) => (is3d(st.view) ? 'The 3D view has one style' : 'Not drawn in this view yet') },
    { id: 'sex', label: 'Biological sex', keys: 'S', opts: sexes.map((x) => [x.id, x.name]), hide: sexes.length < 2,
      value: (st) => st.sex, set: (v) => setSex(v) },
    // Anatomy draws the joints of the realistic skeleton as capsules and joint spaces; the schematic one only has dots
    { id: 'joints', label: 'Joints', opts: [['dots', 'Dots'], ['anatomy', 'Anatomy'], ['off', 'Off']],
      value: (st) => (!st.joints ? 'off' : anatomyIn(st) ? st.jointStyle : 'dots'),
      set: (v) => {
        const on = v !== 'off';
        prefs.set('joints', on);
        if (on) prefs.set('jointStyle', v);
        store.set(on ? { joints: true, jointStyle: v } : { joints: false });
      },
      off: (v, st) => v === 'anatomy' && !anatomyIn(st), why: 'Only with realistic drawings' },
    { id: 'mirror', label: 'Mirror', opts: [['off', 'Off'], ['on', 'On']],
      value: (st) => (st.mirror && !viewById.get(st.view)?.flip && !is3d(st.view) ? 'on' : 'off'),
      set: (v) => { prefs.set('mirror', v === 'on'); store.set({ mirror: v === 'on' }); },
      off: (v, st) => !!viewById.get(st.view)?.flip || is3d(st.view),
      why: (st) => (is3d(st.view) ? 'Turn the 3D body to see it from behind' : 'The back view is already shown from behind') },
  ].filter((r) => !r.hide);
  const settingsEl = $('#settings');
  const settingsBtn = $('#settings-toggle');
  const settingsWrap = settingsEl.closest('.settings-wrap');
  settingsEl.innerHTML = '<h2 id="settings-title">Settings</h2>' + settingRows.map((r) => `<div class="setting"><span class="setting-label" id="set-${r.id}">${escapeHtml(r.label)}</span>`
    + `<div class="seg" role="radiogroup" aria-labelledby="set-${r.id}"${r.keys ? ` aria-keyshortcuts="${r.keys}"` : ''}>`
    + r.opts.map(([v, name]) => `<button type="button" role="radio" data-setting="${r.id}" data-value="${escapeHtml(v)}" aria-checked="false" tabindex="-1">${escapeHtml(name)}</button>`).join('')
    + '</div></div>').join('');
  settingsEl.setAttribute('aria-labelledby', 'settings-title');
  settingsEl.removeAttribute('aria-label');
  const rowOf = (b) => settingRows.find((x) => x.id === b.dataset.setting);
  const renderSettings = (st) => {
    for (const seg of settingsEl.querySelectorAll('.seg')) {
      const btns = [...seg.querySelectorAll('[data-setting]')];
      for (const b of btns) {
        const r = rowOf(b);
        const off = !!r.off?.(b.dataset.value, st);
        b.setAttribute('aria-checked', String(r.value(st) === b.dataset.value));
        b.disabled = off;
        if (off && r.why) b.title = typeof r.why === 'function' ? r.why(st) : r.why; else b.removeAttribute('title');
      }
      // the row's one Tab stop: its checked option, else its first enabled one
      const stop = btns.find((b) => b.getAttribute('aria-checked') === 'true' && !b.disabled) || btns.find((b) => !b.disabled);
      for (const b of btns) b.tabIndex = b === stop ? 0 : -1;
    }
  };
  const setSettings = (open, { refocus = false } = {}) => {
    settingsEl.hidden = !open;
    settingsBtn.setAttribute('aria-expanded', String(open));
    if (open) { renderSettings(store.get()); settingsEl.querySelector('[tabindex="0"]')?.focus(); }
    else if (refocus) settingsBtn.focus();
  };
  const choose = (b) => {
    if (!b || b.disabled) return;
    rowOf(b).set(b.dataset.value);
    renderSettings(store.get());
  };
  settingsBtn.addEventListener('click', () => setSettings(settingsEl.hidden));
  settingsEl.addEventListener('click', (e) => choose(e.target.closest('[data-setting]')));
  settingsEl.addEventListener('keydown', (e) => {
    const b = e.target.closest?.('[data-setting]');
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!b || !(step || e.key === 'Home' || e.key === 'End')) return;
    e.preventDefault();
    e.stopPropagation();
    const btns = [...b.parentElement.querySelectorAll('[data-setting]')].filter((x) => !x.disabled || x === b);
    let i = btns.indexOf(b);
    if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = btns.length - 1;
    else i = (i + step + btns.length) % btns.length;
    const next = btns[i];
    if (next === b || next.disabled) return;
    choose(next);
    // choosing can re-render the page (biological sex), so focus the option by its row and value
    settingsEl.querySelector(`[data-setting="${next.dataset.setting}"][data-value="${CSS.escape(next.dataset.value)}"]`)?.focus();
  });
  store.subscribe((st) => { if (!settingsEl.hidden) renderSettings(st); });
  document.addEventListener('pointerdown', (e) => { if (!settingsEl.hidden && !settingsWrap.contains(e.target)) setSettings(false); });
  // Escape closes it from anywhere inside (the cog included) and returns to the cog; tabbing away closes it too
  settingsWrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsEl.hidden) { e.stopPropagation(); setSettings(false, { refocus: true }); }
  });
  settingsWrap.addEventListener('focusout', (e) => {
    if (!settingsEl.hidden && e.relatedTarget && !settingsWrap.contains(e.relatedTarget)) setSettings(false);
  });

  // phones: a short placeholder, since the search shares its row with the other controls
  const phone = matchMedia('(max-width: 760px)');
  const fullPlaceholder = $('#search').placeholder;
  const setPlaceholder = () => { $('#search').placeholder = phone.matches ? 'Search' : fullPlaceholder; };
  setPlaceholder();
  phone.addEventListener('change', setPlaceholder);
  search = createSearch({ input: $('#search'), list: $('#search-results'), graph, onChoose: (nav) => navigate(nav, { zoom: true }) });

  browse = $('#browse');
  const browseBtn = $('#browse-toggle');
  buildBrowse(browse, graph);
  const setBrowse = (open) => { browse.hidden = !open; browseBtn.setAttribute('aria-expanded', String(open)); if (open) browse.querySelector('summary')?.focus(); };
  browseBtn.addEventListener('click', () => setBrowse(browse.hidden));
  browse.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nav]');
    if (!b) return;
    navigate(b.dataset.nav, { zoom: true });
    if (matchMedia('(max-width: 760px)').matches) setBrowse(false);
  });

  // panel: navigation, range expansion, hover-to-highlight
  panelEl.addEventListener('click', (e) => {
    const exp = e.target.closest('[data-expand]');
    if (exp) {
      exp.hidden = true;
      const more = exp.nextElementSibling;
      more.hidden = false;
      more.querySelector('button')?.focus();
      return;
    }
    const show = e.target.closest('[data-layer-on]');
    if (show) {
      const id = show.dataset.layerOn;
      const st = store.get();
      // a layer this view has no drawing for: switch to the first view that has one
      const v = layersIn(st.view).includes(id) ? st.view : views.find((x) => layersIn(x.id).includes(id))?.id;
      const patch = v ? viewPatch(st, v) : {};
      const vis = new Set(patch.visible || st.visible);
      vis.add(id);
      store.set({ ...patch, visible: vis });
      return;
    }
    if (e.target.closest('[data-back]')) {
      const fr = store.get().fromRegion;
      if (fr) navigate(`r/${encodeURIComponent(fr.id)}${fr.side ? '/' + fr.side : ''}`);
      return;
    }
    const nav = e.target.closest('[data-nav]');
    if (nav) { navigate(nav.dataset.nav, { zoom: true }); return; }
    if (sheet === 'peek' && isMobile()) setSheet('half');
  });
  const hoverFrom = (t) => {
    const keys = t?.dataset.keys ? t.dataset.keys.split(' ') : [];
    map.setHover(keys, t?.dataset.rkeys ? t.dataset.rkeys.split(' ') : []);
    model?.setHover(keys);
  };
  panelEl.addEventListener('pointerover', (e) => hoverFrom(e.target.closest('[data-keys],[data-rkeys]')));
  panelEl.addEventListener('pointerleave', () => { map.setHover(); model?.setHover(); });
  panelEl.addEventListener('focusin', (e) => hoverFrom(e.target.closest('[data-keys],[data-rkeys]')));
  panelEl.addEventListener('focusout', () => { map.setHover(); model?.setHover(); });

  // mobile bottom sheet
  let sheet = 'peek';
  const isMobile = () => matchMedia('(max-width: 760px)').matches;
  function setSheet(s) { sheet = s; panelEl.dataset.sheet = s; }
  const order = ['peek', 'half', 'full'];
  const handle = $('.sheet-handle');
  let sy = null;
  handle.addEventListener('pointerdown', (e) => { sy = e.clientY; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointerup', (e) => {
    if (sy == null) return;
    const dy = e.clientY - sy;
    sy = null;
    const i = order.indexOf(sheet);
    if (Math.abs(dy) < 8) setSheet(order[(i + 1) % order.length]);
    else if (dy < 0) setSheet(order[Math.min(2, i + 1)]);
    else setSheet(order[Math.max(0, i - 1)]);
  });

  // keyboard
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); search.focus(); }
    else if (e.key === 'Escape') {
      if (!browse.hidden) { setBrowse(false); return; }
      const r = store.get().route;
      if (r.view === 'region') navigate('hurt');
      else if (r.view !== 'home' && r.view !== 'hurt') navigate('');
    } else if (e.key === '+' || e.key === '=') zoomBy(0.7);
    else if (e.key === '-' || e.key === '_') zoomBy(1.4);
    else if (e.key === '0') zoomHome();
    else if (e.key === 'b' || e.key === 'B') toggleView();
    else if ((e.key === 'm' || e.key === 'M') && !Router.isHurt(store.get().route)) toggleDisplay();
    else if (e.key === 'd' || e.key === 'D') toggleStyle();
    else if (e.key === 's' || e.key === 'S') cycleSex();
  });

  // a saved non-default style: mount the current view's drawings before the first render, so they don't swap in later
  if (store.get().style !== styles[0].id) await ensureStyle(store.get().style, store.get().view);
  window.addEventListener('hashchange', onRoute);
  onRoute();
  ensureShown(store.get());
  if (store.get().route.view !== 'home') requestAnimationFrame(() => revealSelection());
  document.body.classList.add('ready');

  if (new URLSearchParams(location.search).has('debug')) {
    // the check compares every style's drawings with the default ones, so mount them all first
    Promise.all(styles.slice(1).flatMap((s) => views.map((v) => ensureStyle(s.id, v.id))))
      .then(() => import('./validate.js'))
      .then(async (m) => m.validate({ raw, map, models: await m.modelsFrom(manifest, async (u, as) => {
        const r = await fetch(u, { cache: 'no-cache' });
        return as === 'json' ? r.json() : r.arrayBuffer();
      }) }));
  }
  // handy for poking around in the console; graph is the current sex's graph
  window.corpus = { get graph() { return graph; }, get model() { return model; }, graphFor, map, store, zoom };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

boot().catch((err) => {
  console.error(err);
  const body = document.querySelector('#panel-body');
  if (body) {
    body.innerHTML = `<div class="panel-inner"><p class="eyebrow">Couldn’t start</p><h2 class="title">The map didn’t load</h2>
      <p class="summary">${escapeHtml(err.message)}</p>
      <p class="summary" style="margin-top:12px">If you opened <code>index.html</code> straight from disk, serve the folder instead, for example with <code>python3 -m http.server</code>, then open <code>http://localhost:8000</code>.</p></div>`;
  }
});
