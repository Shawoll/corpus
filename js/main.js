// Corpus — boot & wiring. No build step: plain ES modules, JSON data and SVG assets.
import { createStore } from './state.js';
import { Graph, parseKey } from './graph.js';
import { createMap } from './map.js';
import { createZoom } from './zoom.js';
import { createPanel } from './panel.js';
import { createSearch } from './search.js';
import { buildBrowse } from './browse.js';
import { forSex } from './sex.js';
import { createT, applyDom, loadLang, forLang, localizeManifest, pickLang, sourceFile } from './i18n.js';
import * as Router from './router.js';
import * as Offline from './offline.js';

const $ = (s) => document.querySelector(s);
// 16 × 16 stroke icons for the layer buttons (currentColor), by layer id
const LAYER_ICONS = {
  nerves: '<path d="M8 1.8v5.4M8 7.2 4.6 10.4v3.8M8 7.2l3.4 3.2v3.8M8 7.2v6.9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="1.9" r="1.1" fill="currentColor"/>',
  lymphatics: '<path d="M8 1.5v13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="8" cy="5" rx="2.4" ry="1.7" fill="currentColor"/><ellipse cx="8" cy="11" rx="2.4" ry="1.7" fill="currentColor"/>',
  vessels: '<path d="M8 1.8C8 1.8 3.6 7 3.6 10a4.4 4.4 0 0 0 8.8 0C12.4 7 8 1.8 8 1.8z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
  muscles: '<path d="M1.5 8h2.2M12.3 8h2.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3.7 8C5.4 4.4 10.6 4.4 12.3 8 10.6 11.6 5.4 11.6 3.7 8z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/><path d="m6.4 6.4 3.2 3.2M8.4 5.9l1.5 1.5M6.1 8.6l1.5 1.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>',
  ligaments: '<path d="M3.2 2.8h9.6M3.2 13.2h9.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="m5.6 4.6 4.8 6.8M10.4 4.6l-4.8 6.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  skeleton: '<path d="M9 13.2a3.2 3.2 0 1 1 3.4-3.6h7.2a3.2 3.2 0 1 1 3.4 3.6 3.2 3.2 0 1 1-3.4 3.6h-7.2A3.2 3.2 0 1 1 9 13.2z" transform="rotate(-45 8 8) scale(0.5) translate(0 2.8)" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linejoin="round"/>',
  organs: '<path d="M8 1.8v4.6M8 6.4 6.6 7.6M8 6.4l1.4 1.2" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.2 4.6C4.1 4.9 2.4 8 2.4 11.3c0 1.4.7 2.3 1.8 2.3 1.2 0 2.5-.8 2.5-1.9V5.1zM9.8 4.6c2.1.3 3.8 3.4 3.8 6.7 0 1.4-.7 2.3-1.8 2.3-1.2 0-2.5-.8-2.5-1.9V5.1z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>',
  joints: '<circle cx="8" cy="8" r="5.6" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/>',
  default: '<rect x="3" y="3" width="10" height="10" rx="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
};
const prefs = {
  get(k, d) { try { const v = localStorage.getItem('corpus:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('corpus:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
// the interface's strings; English until boot has loaded the chosen language (the boot error message uses it too)
let t = createT();
const applyTheme = (th) => { if (th) document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme; };
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
  // languages (js/i18n.js): English is the source (locales/en/ui.json and data/); another language overlays both
  const languages = manifest.languages?.length ? manifest.languages : [{ id: 'en', name: 'English' }];
  const langById = new Map(languages.map((l) => [l.id, l]));
  const urlLang = new URLSearchParams(location.search).get('lang');
  const startLang = pickLang(languages, { param: urlLang, saved: prefs.get('lang', null), browser: navigator.languages || [] });
  if (urlLang && langById.has(urlLang)) prefs.set('lang', urlLang);
  const langLoads = new Map(); // lang id -> Promise of loadLang()'s result
  const getLang = (id) => {
    if (!langLoads.has(id)) langLoads.set(id, loadLang(manifest, id, (u) => load(u)).catch((err) => { langLoads.delete(id); throw err; }));
    return langLoads.get(id);
  };
  const [datas, svgs, linkFiles, regionsData, regionSvgs, modelIndex, enLang, firstLang] = await Promise.all([
    Promise.all(manifest.layers.map((l) => load(l.data))),
    Promise.all(manifest.layers.map((l) => loadSvgs(l.svg))),
    Promise.all((manifest.links || []).map((u) => load(u))),
    manifest.regions ? load(manifest.regions.data) : { regions: [] },
    manifest.regions ? loadSvgs(manifest.regions.svg) : {},
    // which keys the 3D model has (a few KB), so routes can pick a view without loading any model
    modelView && manifest.model3d ? load(manifest.model3d.keys).catch(() => null) : null,
    getLang(languages[0].id).catch(() => null),
    getLang(startLang).catch(() => null),
  ]);
  const enUi = enLang?.ui || {};
  // the language on show: its strings (t), the manifest's names in it (man) and the data in it (raw, below)
  let lang = firstLang ? startLang : languages[0].id;
  let man = localizeManifest(manifest, firstLang?.manifest);
  t = createT(firstLang?.ui, enUi, lang);
  applyDom(document, t);
  // layer id -> Set(key) in its .glb; only layers the manifest gives a "model" count
  const modelKeys = new Map(manifest.layers.filter((l) => l.model && modelIndex?.layers?.[l.id]).map((l) => [l.id, new Set(modelIndex.layers[l.id])]));
  const inModel = (k) => [...modelKeys.values()].some((s) => s.has(k));
  // "Where does it hurt?" in 3D: the skin and the areas it covers
  const skinUrl = modelView && manifest.model3d?.skin && modelIndex?.skin?.length ? manifest.model3d.skin : null;
  const skinRegions = new Set(skinUrl ? modelIndex.skin : []);
  // stand-ins the build drew for structures the source has no mesh for (tools/model3d/generated.py)
  const generatedKeys = new Set(modelIndex?.generated || []);
  const layers = manifest.layers.map((l, i) => ({ ...l, data: datas[i], svgs: svgs[i] }));
  // biological sex: one graph per setting, built on first use from the data filtered by js/sex.js (the first is neutral)
  const sexes = manifest.sexes?.length ? manifest.sexes : [{ id: 'none', name: 'Not set' }];
  const sexById = new Map(sexes.map((x) => [x.id, x]));
  const rawEn = { layers, links: linkFiles.flatMap((f) => f.links || []), linkTypes: manifest.linkTypes, regions: regionsData };
  // the data in the language on show; the graphs are built from it (forLang first: overlays merge by index)
  let raw = forLang(rawEn, firstLang);
  const graphs = new Map(); // sex -> Graph, for the language on show
  const graphFor = (sx) => { if (!graphs.has(sx)) graphs.set(sx, new Graph({ ...forSex(raw, sx), t })); return graphs.get(sx); };
  // names from the manifest in the language on show (views, styles, sexes, layers)
  const nameIn = (list, id) => man[list]?.find((x) => x.id === id)?.name || id;
  const savedSex = prefs.get('sex', sexes[0].id);
  const initialSex = sexById.has(savedSex) ? savedSex : sexes[0].id;
  let graph = graphFor(initialSex);

  const svg = $('#map');
  const wrap = $('.map-wrap');
  const tooltip = $('#tooltip');
  const panelEl = $('#panel');
  const panelBody = $('#panel-body');
  const hint = $('#map-hint');
  let panel = createPanel(graph, t);
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
    lang, // the language on show (not part of the route)
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
  // the screen px of a map element (the SVG, or the 3D canvas) covered by overlays, which framing a selection keeps it
  // clear of: the layer chips down the left edge, and on phones the bottom sheet (at the height it is moving to, from
  // its state and the CSS's --peek / --sheet-half, since the slide may still be running)
  function mapInsets(el) {
    const r = el.getBoundingClientRect();
    const out = { left: 0, bottom: 0 };
    const chips = $('#layerbar').getBoundingClientRect();
    if (chips.width && chips.right < r.left + r.width * 0.45) out.left = chips.right - r.left + 8;
    const ps = getComputedStyle(panelEl);
    if (ps.position === 'fixed') {
      const h = panelEl.offsetHeight; // px of the sheet in view:
      const shown = sheet === 'full' ? h : sheet === 'half' ? h * (1 - (parseFloat(ps.getPropertyValue('--sheet-half')) || 0.46))
        : parseFloat(ps.getPropertyValue('--peek')) || 0;
      out.bottom = Math.max(0, r.bottom - (innerHeight - shown)) + 8;
    }
    return out;
  }
  const zoom = createZoom(svg, { onChange: () => {}, insets: () => mapInsets(svg) });

  // ------------------------------------------------------------------ the 3D view (js/model3d.js, loaded on first use)
  const canvas = $('#model3d');
  const modelStatus = $('#model-status');
  let model = null, modelLoad = null, modelFront = true;
  // structure id -> { layer, kind } for every structure, whatever the biological sex (the model's colours)
  const infoById = new Map(layers.flatMap((l) => l.data.structures.map((s) => [s.id, { layer: l.id, kind: s.kind }])));
  const setStatus = (text) => { modelStatus.textContent = text || ''; modelStatus.hidden = !text; };
  function ensureModel() {
    if (!modelLoad) {
      setStatus(t('model.loading'));
      modelLoad = import('./model3d.js').then(({ createModel3d }) => {
        model = createModel3d({
          canvas, bounds: modelIndex.bounds, info: (id) => infoById.get(id), onPick, onHover,
          onTurn: (front) => { modelFront = front; renderControls(store.get()); if (!settingsEl.hidden) renderSettings(store.get()); },
        });
        return model;
      }).catch((err) => { modelLoad = null; setStatus(t('model.failed')); throw err; });
    }
    return modelLoad;
  }
  // layer id -> the promise of its .glb loading (see ensureModelLayers)
  const modelLayerLoads = new Map();
  let loadFailed = false;
  // the line at the top of the 3D view: what the model can't show for this page, else how far loading has got
  function modelNote(st, h) {
    const n = st.route.view === 'node' ? graph.node(st.route.id) : null;
    const keys = [...h.sel];
    if (n && keys.length && !keys.some(inModel)) return t('model.notIn', { name: n.name });
    if (n && keys.length && keys.every((k) => !inModel(k) || generatedKeys.has(k))) return t('model.standIn', { name: n.name });
    if (loadFailed) return t('model.partFailed');
    const want = manifest.layers.filter((l) => l.model && modelKeys.has(l.id) && st.visible.has(l.id));
    const done = want.filter((l) => model?.hasLayer(l.id)).length;
    const skinWait = Router.isHurt(st.route) && skinUrl && !model?.hasSkin();
    if (!model || skinWait) return t('model.loading');
    if (done < want.length) return t(Router.isHurt(st.route) ? 'model.loadingUnder' : 'model.loadingLayers', { done, total: want.length });
    return '';
  }
  // Start loading what the 3D view needs and isn't loading yet: the .glb of every visible layer and, in "Where does it
  // hurt?", the skin. Each load starts once and redraws once when it lands; the promise settles when all have.
  let skinLoading = null;
  function ensureModelLayers(st) {
    return ensureModel().then((m) => {
      const jobs = [];
      // the skin first (it is what you tap); the layers behind it fill "Under this spot"
      if (Router.isHurt(st.route) && skinUrl && !m.hasSkin() && !skinLoading) {
        skinLoading = m.loadSkin(skinUrl).then(() => renderMap(store.get()),
          (err) => { skinLoading = null; loadFailed = true; renderMap(store.get()); console.warn('[Corpus] 3D skin failed to load', err); });
      }
      if (skinLoading && !m.hasSkin()) jobs.push(skinLoading);
      for (const l of manifest.layers) {
        if (!l.model || !modelKeys.has(l.id) || !st.visible.has(l.id) || m.hasLayer(l.id)) continue;
        if (!modelLayerLoads.has(l.id)) {
          modelLayerLoads.set(l.id, m.load(l.id, l.model).then(() => renderMap(store.get()),
            (err) => { modelLayerLoads.delete(l.id); loadFailed = true; renderMap(store.get()); console.warn('[Corpus] 3D model failed to load', err); }));
        }
        jobs.push(modelLayerLoads.get(l.id));
      }
      if (!jobs.length) renderMap(store.get());
      return Promise.all(jobs);
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
      if (r) {
        const rks = graph.regionKeys(r.id, r.paired ? route.side : null);
        const vs = map.viewsOf(rks, { regions: true });
        found = rks.some((k) => skinRegions.has(k)) ? views.map((v) => v.id).filter((v) => vs.includes(v) || v === modelView) : vs;
      }
    }
    if (Router.isHurt(route) && is3d(current) && !skinUrl) return svgViews[0].id;
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
    panel = createPanel(graph, t);
    search?.setGraph(graph, t);
    if (browse) buildBrowse(browse, graph, t);
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
  // ------------------------------------------------------------------ language
  // load the language once, then rebuild everything built from text: the graphs (names, search), the panel, Browse,
  // the layer chips, the cog and the static page text; the route, view and selection stay as they are
  async function setLang(id) {
    if (!langById.has(id) || id === store.get().lang) return;
    let data;
    try { data = await getLang(id); } catch (err) { console.warn(`[Corpus] language ${id} failed to load`, err); return; }
    lang = id;
    t = createT(data.ui, enUi, id);
    man = localizeManifest(manifest, data.manifest);
    raw = forLang(rawEn, data);
    graphs.clear();
    prefs.set('lang', id);
    useSex(store.get().sex);
    applyDom(document, t);
    buildLayerList();
    renderLayerbar();
    buildSettings();
    setPlaceholder();
    store.set({ lang: id });
  }
  const cycleSex = () => { const i = sexes.findIndex((x) => x.id === store.get().sex); setSex(sexes[(i + 1) % sexes.length].id); };

  // ------------------------------------------------------------------ navigation
  // zoomNext: the next route should be brought into view (search, panel links: not a tap on the map, which is in view
  // already). inApp tells those routes from the ones that come from outside (a typed or pasted address, back and
  // forward, the first load), which are always brought into view.
  let zoomNext = false, inApp = false;
  const navigate = (path, { zoom: z = false } = {}) => { zoomNext = z; inApp = true; Router.go(path); };
  const regionKey = (r) => (r.side ? `${r.id}:${r.side}` : r.id);

  function onRoute() {
    tooltip.hidden = true; // a hover label from the last page would point at the wrong thing
    const prev = store.get();
    const route = Router.parse();
    // an area that was split or renamed ("formerly" in regions.json): its old address opens the area that took over
    if (route.view === 'region' && !graph.regions.has(route.id)) {
      const now = [...graph.regions.values()].find((r) => r.formerly?.includes(route.id));
      if (now) { location.replace(Router.href(`r/${encodeURIComponent(now.id)}${route.side ? '/' + route.side : ''}`)); return; }
    }
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
    if (zoomNext || !inApp) requestAnimationFrame(() => revealSelection());
    zoomNext = inApp = false;
  }

  // whether a body area exists for the current biological sex (one function per graph, so the model sees a change)
  const regionOks = new WeakMap();
  const regionOkFor = (g) => {
    if (!regionOks.has(g)) regionOks.set(g, (rk) => g.regions.has(parseKey(rk).id));
    return regionOks.get(g);
  };
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
      if (st.route.view === 'region') { ensureModelLayers(st).then(() => model?.frameRegions([...h.rsel])); return; }
      if (!h.sel.size) return;
      // the model may still be loading the layer: frame once it's there
      ensureModelLayers(st).then(() => model?.frame([...h.sel], { parts: h.sel.size === 2 ? [...h.sel] : null, insets: mapInsets(canvas) }));
      return;
    }
    if (st.route.view === 'region') { zoom.reveal(map.bbox([...h.rsel], { regions: true })); return; }
    const parts = h.sel.size > 1 && h.sel.size <= 2 ? [...h.sel].map((k) => map.bbox([k])).filter(Boolean) : null;
    zoom.reveal(map.bbox([...h.sel]), { parts });
  }

  // ------------------------------------------------------------------ map events
  function onPick({ key, rkey, clientX, clientY, flat = null, world = null }) {
    hideHint();
    const st = store.get();
    if (Router.isHurt(st.route)) {
      if (!rkey) return;
      // in 3D the spot is on the skin: everything along that line of sight, and the matching point of the 2D frame
      const three = is3d(st.view);
      const keys = three ? model.probe(clientX, clientY) : map.probe(clientX, clientY);
      store.set({ probe: { rkey, keys, point: three ? flat : map.toSvgPoint(clientX, clientY), world: three ? world : null } });
      const { id, side } = parseKey(rkey);
      navigate(`r/${encodeURIComponent(id)}${side ? '/' + side : ''}`);
      return;
    }
    if (key) {
      const { id, side } = parseKey(key);
      navigate(`s/${encodeURIComponent(id)}${side ? '/' + side : ''}`);
    } else if (st.route.view !== 'home') navigate('');
  }

  function onHover(hit, x, y) {
    if (!hit) { tooltip.hidden = true; return; }
    const hurt = Router.isHurt(store.get().route);
    let label = '', sub = '';
    if (hurt && hit.rkey) {
      const { id, side } = parseKey(hit.rkey);
      label = graph.regions.get(id)?.name || id;
      sub = side ? t(`tooltip.side.${side}`) : '';
    } else if (!hurt && hit.key) {
      const { id, side } = parseKey(hit.key);
      const n = graph.node(id);
      label = n?.name || id;
      sub = [side ? t(`side.${side}`) : '', n?.type === 'joint' ? t('tooltip.joint') : ''].filter(Boolean).join(' · ');
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
    for (const b of document.querySelectorAll('.modes button')) {
      const on = (b.dataset.mode === 'hurt') === hurt;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    const here = layersIn(st.view);
    const active = activeIn(st);
    const vname = nameIn('views', st.view);
    for (const b of document.querySelectorAll('.layer-chip[data-layer]')) {
      const id = b.dataset.layer;
      const name = nameIn('layers', id);
      const drawnHere = here.includes(id);
      const state = !drawnHere ? 'na' : !st.visible.has(id) ? 'off' : active === id ? 'active' : 'context';
      b.dataset.state = state;
      b.disabled = !drawnHere;
      b.setAttribute('aria-pressed', String(state === 'active' || state === 'context'));
      b.title = state === 'na' ? (is3d(st.view) ? t('layers.not3d', { name }) : t('layers.notDrawn', { name, view: vname.toLowerCase() }))
        : t(state === 'off' ? 'layers.show' : state === 'context' ? 'layers.focus' : 'layers.hide', { name });
    }
    svg.setAttribute('aria-label', t('map.aria', { view: vname }));
    canvas.setAttribute('aria-label', t('map.aria3d'));
    const jb = $('.layer-chip[data-toggle="joints"]');
    jb.dataset.state = st.joints ? 'active' : 'off';
    jb.setAttribute('aria-pressed', String(st.joints));
    // in 3D the sides follow the camera: seen from behind, the body's right is on the viewer's right
    const flip = is3d(st.view) ? !modelFront : flipOf(st);
    const lab = (s) => `<b>${escapeHtml(t(`map.sideShort.${s}`))}</b><small>${escapeHtml(t(`map.sideLong.${s}`))}</small>`;
    $('#side-left').innerHTML = lab(flip ? 'left' : 'right');
    $('#side-right').innerHTML = lab(flip ? 'right' : 'left');
    $('#hurt-banner').hidden = st.route.view !== 'hurt';
    if (hint) hint.textContent = t(is3d(st.view) ? 'map.hint3d' : 'map.hint');
    const title = panel.title(st);
    document.title = title ? t('app.pageTitle', { title }) : t('app.title');
  }
  let lastFlip = null;
  function renderMap(st) {
    const three = is3d(st.view);
    svg.toggleAttribute('hidden', three); // SVG elements have no .hidden property
    canvas.hidden = !three;
    $('.model-credit').hidden = !three;
    if (three) {
      if (!model) { setStatus(t('model.loading')); ensureModelLayers(st); return; }
      const hurt = Router.isHurt(st.route);
      // something visible that isn't loaded and isn't on its way yet
      if (manifest.layers.some((l) => modelKeys.has(l.id) && st.visible.has(l.id) && !model.hasLayer(l.id) && !modelLayerLoads.has(l.id))
        || (hurt && skinUrl && !model.hasSkin() && !skinLoading)) ensureModelLayers(st);
      model.resize();
      const h = highlights(st);
      model.render({
        ...h, visible: st.visible, active: activeIn(st), sex: st.sex, joints: st.joints, hurt, regionOk: regionOkFor(graph),
        probe: st.route.view === 'region' && st.probe?.world ? st.probe.world : null,
      });
      setStatus(modelNote(st, h));
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
    // the side switch re-renders the panel when it is used: keep the keyboard focus on it
    const inSwitch = !!document.activeElement?.closest?.('.side-switch') && panelBody.contains(document.activeElement);
    panelBody.innerHTML = panel.render(st);
    if (top) { panelBody.scrollTop = 0; panelEl.scrollTop = 0; }
    if (inSwitch) panelBody.querySelector('.side-switch [role="radio"][aria-checked="true"]')?.focus({ preventScroll: true });
  }
  store.subscribe((st, prev) => {
    if (st.style !== prev.style || st.view !== prev.view) ensureShown(st);
    if (st.route !== prev.route || st.probe !== prev.probe || st.mirror !== prev.mirror || st.fromRegion !== prev.fromRegion || st.visible !== prev.visible || st.view !== prev.view || st.sex !== prev.sex || st.lang !== prev.lang) renderPanel(st, st.route !== prev.route);
    renderMap(st);
    renderControls(st);
  });

  // ------------------------------------------------------------------ controls
  // The layer buttons: a column of chips, each an icon (whose disc shows the state) and a name. The toggle above them
  // collapses the column to icons (saved as corpus:layersCollapsed); on phones the column is always closed and the
  // toggle opens it as a menu.
  const layerbar = $('#layerbar');
  const layerList = $('#layer-list');
  const layerToggle = $('#layer-toggle');
  const chipIcon = (id) => `<span class="sw" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16">${LAYER_ICONS[id] || LAYER_ICONS.default}</svg></span>`;
  const buildLayerList = () => {
    layerList.innerHTML = [...man.layers].reverse()
      .map((l) => `<button class="layer-chip" data-layer="${l.id}">${chipIcon(l.id)}<span class="name">${escapeHtml(l.name)}</span></button>`)
      .join('') + `<button class="layer-chip" data-toggle="joints" title="${escapeHtml(t('layers.jointsTitle'))}">${chipIcon('joints')}<span class="name">${escapeHtml(t('layers.joints'))}</span></button>`;
  };
  buildLayerList();
  const narrow = matchMedia('(max-width: 760px)'); // the phone layout (css/app.css)
  let layersOpen = false; // the phone menu
  function renderLayerbar() {
    const collapsed = !!prefs.get('layersCollapsed', false);
    layerbar.dataset.collapsed = String(collapsed);
    layerbar.dataset.open = String(layersOpen);
    const expanded = narrow.matches ? layersOpen : !collapsed;
    layerToggle.setAttribute('aria-expanded', String(expanded));
    layerToggle.title = t(narrow.matches ? (layersOpen ? 'layers.close' : 'layers.title') : collapsed ? 'layers.showNames' : 'layers.iconsOnly');
  }
  const setLayersOpen = (open, { refocus = false } = {}) => {
    layersOpen = open;
    renderLayerbar();
    if (refocus) layerToggle.focus();
  };
  layerToggle.addEventListener('click', () => {
    if (narrow.matches) setLayersOpen(!layersOpen);
    else { prefs.set('layersCollapsed', !prefs.get('layersCollapsed', false)); renderLayerbar(); }
  });
  narrow.addEventListener('change', () => setLayersOpen(false));
  document.addEventListener('pointerdown', (e) => { if (layersOpen && !layerbar.contains(e.target)) setLayersOpen(false); });
  layerbar.addEventListener('keydown', (e) => { if (e.key === 'Escape' && layersOpen) { e.stopPropagation(); setLayersOpen(false, { refocus: true }); } });
  layerbar.addEventListener('focusout', (e) => { if (layersOpen && e.relatedTarget && !layerbar.contains(e.relatedTarget)) setLayersOpen(false); });
  renderLayerbar();
  layerList.addEventListener('click', (e) => {
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
  // reset: the whole body, upright (in 3D, still from the side it is seen from)
  const zoomHome = () => { if (is3d(store.get().view)) model?.home(); else zoom.home(); };
  // move up or down the body: a fifth of the view at a time (in 3D along the screen's up, whatever the tilt)
  const moveBy = (d) => { hideHint(); if (is3d(store.get().view)) model?.pan(d); else zoom.pan(0, d); };
  $('#zoom-in').addEventListener('click', () => { hideHint(); zoomBy(0.7); });
  $('#zoom-out').addEventListener('click', () => zoomBy(1.4));
  $('#zoom-fit').addEventListener('click', () => zoomHome());
  $('#move-up').addEventListener('click', () => moveBy(-0.2));
  $('#move-down').addEventListener('click', () => moveBy(0.2));
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
  // built again when the language changes (buildSettings)
  let settingRows = [];
  const makeRows = () => [
    { id: 'theme', label: t('settings.theme'), opts: ['auto', 'light', 'dark'].map((v) => [v, t(`settings.theme.${v}`)]),
      value: () => prefs.get('theme', null) || 'auto',
      set: (v) => { const th = v === 'auto' ? null : v; applyTheme(th); prefs.set('theme', th); } },
    { id: 'display', label: t('settings.display'), keys: 'M', opts: [['2d', t('settings.display.2d')], ['3d', t('settings.display.3d')]], hide: !modelView,
      value: (st) => (is3d(st.view) ? '3d' : '2d'), set: (v) => setDisplay(v),
      off: (v, st) => v === '3d' && Router.isHurt(st.route) && !skinUrl, why: t('settings.display.hurt2d') },
    { id: 'view', label: t('settings.view'), keys: 'B', opts: svgViews.map((v) => [v.id, nameIn('views', v.id)]), hide: svgViews.length < 2,
      value: (st) => facing(st), set: (v) => setFacing(v) },
    { id: 'style', label: t('settings.style'), keys: 'D', opts: styles.map((s) => [s.id, nameIn('styles', s.id)]), hide: styles.length < 2,
      value: (st) => (styleIn(st.style, st.view) ? st.style : styles[0].id), set: (v) => setStyle(v),
      off: (v, st) => !styleIn(v, st.view), why: (st) => t(is3d(st.view) ? 'settings.style.one3d' : 'settings.style.notHere') },
    { id: 'sex', label: t('settings.sex'), keys: 'S', opts: sexes.map((x) => [x.id, nameIn('sexes', x.id)]), hide: sexes.length < 2,
      value: (st) => st.sex, set: (v) => setSex(v) },
    // Anatomy draws the joints of the realistic skeleton as capsules and joint spaces; the schematic one only has dots
    { id: 'joints', label: t('settings.joints'), opts: ['dots', 'anatomy', 'off'].map((v) => [v, t(`settings.joints.${v}`)]),
      value: (st) => (!st.joints ? 'off' : anatomyIn(st) ? st.jointStyle : 'dots'),
      set: (v) => {
        const on = v !== 'off';
        prefs.set('joints', on);
        if (on) prefs.set('jointStyle', v);
        store.set(on ? { joints: true, jointStyle: v } : { joints: false });
      },
      off: (v, st) => v === 'anatomy' && !anatomyIn(st), why: t('settings.joints.realisticOnly') },
    { id: 'mirror', label: t('settings.mirror'), opts: [['off', t('settings.mirror.off')], ['on', t('settings.mirror.on')]],
      value: (st) => (st.mirror && !viewById.get(st.view)?.flip && !is3d(st.view) ? 'on' : 'off'),
      set: (v) => { prefs.set('mirror', v === 'on'); store.set({ mirror: v === 'on' }); },
      off: (v, st) => !!viewById.get(st.view)?.flip || is3d(st.view),
      why: (st) => t(is3d(st.view) ? 'settings.mirror.why3d' : 'settings.mirror.whyBack') },
    // each language named in itself (from the manifest, never translated)
    { id: 'lang', label: t('settings.language'), opts: languages.map((l) => [l.id, l.name]), hide: languages.length < 2,
      value: (st) => st.lang, set: (v) => setLang(v) },
  ].filter((r) => !r.hide);
  const settingsEl = $('#settings');
  const settingsBtn = $('#settings-toggle');
  const settingsWrap = settingsEl.closest('.settings-wrap');
  function buildSettings() {
    settingRows = makeRows();
    settingsEl.innerHTML = `<h2 id="settings-title">${escapeHtml(t('settings.title'))}</h2>` + settingRows.map((r) => `<div class="setting"><span class="setting-label" id="set-${r.id}">${escapeHtml(r.label)}</span>`
      + `<div class="seg" role="radiogroup" aria-labelledby="set-${r.id}"${r.keys ? ` aria-keyshortcuts="${r.keys}"` : ''}>`
      + r.opts.map(([v, name]) => `<button type="button" role="radio" data-setting="${r.id}" data-value="${escapeHtml(v)}" aria-checked="false" tabindex="-1"${r.id === 'lang' ? ` lang="${escapeHtml(v)}"` : ''}>${escapeHtml(name)}</button>`).join('')
      + '</div></div>').join('')
      + (Offline.supported ? `<div class="setting offline"><span class="setting-label" id="set-offline">${escapeHtml(t('settings.offline'))}</span>`
        + '<p class="offline-note" id="offline-note" role="status" tabindex="-1"></p>'
        + `<button type="button" class="offline-save" id="offline-save" aria-describedby="offline-note">${escapeHtml(t('settings.offline.save'))}</button></div>` : '');
    $('#offline-save')?.addEventListener('click', saveOffline);
    if (!settingsEl.hidden) { renderSettings(store.get()); renderOffline(); }
  }
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
  // Offline: what a visit fetches only on demand (the realistic drawings, the 3D view) saved ahead (js/offline.js).
  // OFFLINE_MB is that download, compressed, give or take: update it when the models or drawings grow a lot.
  const OFFLINE_MB = 6;
  let offlineSaving = false;
  async function renderOffline() {
    const note = $('#offline-note'), btn = $('#offline-save');
    if (!note || offlineSaving) return;
    const all = await Offline.savedAll(manifest);
    note.textContent = t(all ? 'settings.offline.all' : 'settings.offline.some');
    btn.hidden = all;
    btn.textContent = t('settings.offline.saveSize', { mb: OFFLINE_MB });
  }
  async function saveOffline() {
    const note = $('#offline-note'), btn = $('#offline-save');
    const hadFocus = settingsEl.contains(document.activeElement);
    offlineSaving = true;
    btn.disabled = true;
    const failed = await Offline.saveAll(manifest, (done, total) => { btn.textContent = t('settings.offline.saving', { done, total }); });
    offlineSaving = false;
    btn.disabled = false;
    await renderOffline();
    if (failed) note.textContent = t('settings.offline.failed', { n: failed });
    if (btn.hidden && hadFocus) note.focus(); // the button is gone: keep the focus in the cog
  }
  buildSettings();

  const setSettings = (open, { refocus = false } = {}) => {
    settingsEl.hidden = !open;
    settingsBtn.setAttribute('aria-expanded', String(open));
    if (open) { renderSettings(store.get()); renderOffline(); settingsEl.querySelector('[tabindex="0"]')?.focus(); }
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
  function setPlaceholder() { $('#search').placeholder = t(phone.matches ? 'app.searchShort' : 'app.searchPlaceholder'); }
  setPlaceholder();
  phone.addEventListener('change', setPlaceholder);
  search = createSearch({ input: $('#search'), list: $('#search-results'), graph, t, onChoose: (nav) => navigate(nav, { zoom: true }) });

  browse = $('#browse');
  const browseBtn = $('#browse-toggle');
  buildBrowse(browse, graph, t);
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
  const hoverFrom = (el) => {
    const keys = el?.dataset.keys ? el.dataset.keys.split(' ') : [];
    map.setHover(keys, el?.dataset.rkeys ? el.dataset.rkeys.split(' ') : []);
    model?.setHover(keys, el?.dataset.rkeys ? el.dataset.rkeys.split(' ') : []);
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

  // the radio groups outside the cog (the Explore / Where does it hurt? switch, the panel's side switch): the arrow
  // keys, Home and End choose, like the cog's rows (renderPanel keeps the focus on the side switch it redraws)
  document.addEventListener('keydown', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[role="radio"]') : null;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!b || settingsEl.contains(b) || !(step || e.key === 'Home' || e.key === 'End')) return;
    e.preventDefault();
    const btns = [...b.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]')].filter((x) => !x.disabled);
    let i = btns.indexOf(b);
    i = e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : (i + step + btns.length) % btns.length;
    const next = btns[i];
    if (!next || next === b) return;
    next.focus();
    next.click();
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
    else if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveBy(e.key === 'ArrowUp' ? -0.2 : 0.2); }
    else if (e.key === 'b' || e.key === 'B') toggleView();
    else if ((e.key === 'm' || e.key === 'M') && (skinUrl || !Router.isHurt(store.get().route))) toggleDisplay();
    else if (e.key === 'd' || e.key === 'D') toggleStyle();
    else if (e.key === 's' || e.key === 'S') cycleSex();
  });

  // a saved non-default style: mount the current view's drawings before the first render, so they don't swap in later
  if (store.get().style !== styles[0].id) await ensureStyle(store.get().style, store.get().view);
  window.addEventListener('hashchange', onRoute);
  onRoute();
  ensureShown(store.get());
  document.body.classList.add('ready');
  // offline use: start the service worker once the page has loaded, so it doesn't compete with the first paint
  if (Offline.supported) {
    if (document.readyState === 'complete') Offline.register();
    else addEventListener('load', () => Offline.register(), { once: true });
  }

  if (new URLSearchParams(location.search).has('debug')) {
    // the check compares every style's drawings with the default ones, so mount them all first
    Promise.all(styles.slice(1).flatMap((s) => views.map((v) => ensureStyle(s.id, v.id))))
      .then(() => import('./validate.js'))
      .then(async (m) => {
        const read = async (u, as) => { const r = await fetch(u, { cache: 'no-cache' }); return as === 'json' ? r.json() : r.arrayBuffer(); };
        // every other language against English (locales/<lang>/source.json may not exist yet)
        const langs = await Promise.all(languages.slice(1).map(async (L) => m.checkLang({
          manifest, raw: rawEn, lang: await getLang(L.id), enUi,
          source: await read(sourceFile(manifest, L.id), 'json').catch(() => null),
        })));
        return m.validate({ raw: rawEn, map, models: await m.modelsFrom(manifest, read), skin: await m.skinFrom(manifest, read), langs });
      });
  }
  // handy for poking around in the console; graph is the current sex's graph
  window.corpus = { get graph() { return graph; }, get model() { return model; }, get t() { return t; }, graphFor, setLang, map, store, zoom };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

boot().catch((err) => {
  console.error(err);
  const body = document.querySelector('#panel-body');
  if (body) {
    body.innerHTML = `<div class="panel-inner"><p class="eyebrow">${t.html('app.bootFailedEyebrow')}</p><h2 class="title">${t.html('app.bootFailedTitle')}</h2>
      <p class="summary">${escapeHtml(err.message)}</p>
      <p class="summary" style="margin-top:12px">${t.html('app.bootFailedHelpHtml')}</p></div>`;
  }
});
