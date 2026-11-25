// Corpus — boot & wiring. No build step: plain ES modules, JSON data and SVG assets.
import { createStore } from './state.js';
import { Graph, parseKey } from './graph.js';
import { createMap } from './map.js';
import { createZoom } from './zoom.js';
import { createPanel } from './panel.js';
import { createSearch } from './search.js';
import { buildBrowse } from './browse.js';
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
  const [datas, svgs, linkFiles, regionsData, regionsSvg] = await Promise.all([
    Promise.all(manifest.layers.map((l) => load(l.data))),
    Promise.all(manifest.layers.map((l) => load(l.svg, 'text'))),
    Promise.all((manifest.links || []).map((u) => load(u))),
    manifest.regions ? load(manifest.regions.data) : { regions: [] },
    manifest.regions ? load(manifest.regions.svg, 'text') : '',
  ]);
  const layers = manifest.layers.map((l, i) => ({ ...l, data: datas[i], svgText: svgs[i] }));
  const graph = new Graph({ layers, links: linkFiles.flatMap((f) => f.links || []), linkTypes: manifest.linkTypes, regions: regionsData });

  const svg = $('#map');
  const wrap = $('.map-wrap');
  const tooltip = $('#tooltip');
  const panelEl = $('#panel');
  const panelBody = $('#panel-body');
  const hint = $('#map-hint');
  const panel = createPanel(graph);

  const store = createStore({
    route: { view: 'home' },
    visible: new Set(manifest.layers.filter((l) => l.visible).map((l) => l.id)),
    active: [...manifest.layers].reverse().find((l) => l.visible)?.id,
    joints: prefs.get('joints', true),
    mirror: prefs.get('mirror', false),
    probe: null,
    fromRegion: null,
  });

  const map = createMap({ svg, graph, onPick, onHover });
  map.mount(layers, regionsSvg);
  const zoom = createZoom(svg, { onChange: () => {} });

  // ------------------------------------------------------------------ navigation
  let zoomNext = false;
  const navigate = (path, { zoom: z = false } = {}) => { zoomNext = z; Router.go(path); };
  const regionKey = (r) => (r.side ? `${r.id}:${r.side}` : r.id);

  function onRoute() {
    const prev = store.get();
    const route = Router.parse();
    const patch = { route };
    if (route.view === 'node') {
      const n = graph.node(route.id);
      if (n && !n.listOnly && !Router.isHurt(route)) {
        const vis = new Set(prev.visible);
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
    for (const b of document.querySelectorAll('.layer-chip[data-layer]')) {
      const id = b.dataset.layer;
      const state = !st.visible.has(id) ? 'off' : st.active === id ? 'active' : 'context';
      b.dataset.state = state;
      b.setAttribute('aria-pressed', String(state !== 'off'));
      const name = b.dataset.name;
      b.title = state === 'off' ? `Show ${name}` : state === 'context' ? `Bring ${name} into focus` : `Hide ${name}`;
    }
    const jb = $('.layer-chip[data-toggle="joints"]');
    jb.dataset.state = st.joints ? 'active' : 'off';
    jb.setAttribute('aria-pressed', String(st.joints));
    $('#mirror').setAttribute('aria-pressed', String(st.mirror));
    const lab = (s) => `<b>${s === 'right' ? 'R' : 'L'}</b><small>body’s ${s}</small>`;
    $('#side-left').innerHTML = lab(st.mirror ? 'left' : 'right');
    $('#side-right').innerHTML = lab(st.mirror ? 'right' : 'left');
    $('#hurt-banner').hidden = st.route.view !== 'hurt';
    const t = panel.title(st);
    document.title = t ? `${t} · Corpus` : 'Corpus: a connected map of the human body';
  }
  function renderMap(st) {
    map.render({
      ...highlights(st),
      visible: st.visible,
      active: st.active,
      hurt: Router.isHurt(st.route),
      joints: st.joints,
      mirror: st.mirror,
      probePoint: st.route.view === 'region' && st.probe ? st.probe.point : null,
    });
  }
  function renderPanel(st, top) {
    panelBody.innerHTML = panel.render(st);
    if (top) { panelBody.scrollTop = 0; panelEl.scrollTop = 0; }
  }
  store.subscribe((st, prev) => {
    if (st.route !== prev.route || st.probe !== prev.probe || st.mirror !== prev.mirror || st.fromRegion !== prev.fromRegion || st.visible !== prev.visible) renderPanel(st, st.route !== prev.route);
    renderMap(st);
    renderControls(st);
  });

  // ------------------------------------------------------------------ controls
  const layerbar = $('#layerbar');
  layerbar.innerHTML = [...manifest.layers].reverse()
    .map((l) => `<button class="layer-chip" data-layer="${l.id}" data-name="${escapeHtml(l.name)}"><span class="sw" aria-hidden="true"></span>${escapeHtml(l.name)}</button>`)
    .join('') + `<button class="layer-chip" data-toggle="joints" title="Show or hide joint markers"><span class="sw" aria-hidden="true" style="border-radius:50%"></span>Joints</button>`;
  layerbar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const st = store.get();
    if (b.dataset.toggle === 'joints') { prefs.set('joints', !st.joints); store.set({ joints: !st.joints }); return; }
    const id = b.dataset.layer;
    const vis = new Set(st.visible);
    if (!vis.has(id)) { vis.add(id); store.set({ visible: vis, active: id }); }
    else if (st.active !== id) store.set({ active: id });
    else {
      const others = [...vis].filter((x) => x !== id);
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
  $('#zoom-in').addEventListener('click', () => { hideHint(); zoom.zoomBy(0.7); });
  $('#zoom-out').addEventListener('click', () => zoom.zoomBy(1.4));
  $('#zoom-fit').addEventListener('click', () => zoom.home());
  $('#mirror').addEventListener('click', () => { const m = !store.get().mirror; prefs.set('mirror', m); store.set({ mirror: m }); });
  svg.addEventListener('wheel', hideHint, { passive: true, once: true });

  $('#theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    prefs.set('theme', next);
  });

  const search = createSearch({ input: $('#search'), list: $('#search-results'), graph, onChoose: (nav) => navigate(nav, { zoom: true }) });

  const browse = $('#browse');
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
      const vis = new Set(store.get().visible);
      vis.add(show.dataset.layerOn);
      store.set({ visible: vis });
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
  const hoverFrom = (t) => map.setHover(t?.dataset.keys ? t.dataset.keys.split(' ') : [], t?.dataset.rkeys ? t.dataset.rkeys.split(' ') : []);
  panelEl.addEventListener('pointerover', (e) => hoverFrom(e.target.closest('[data-keys],[data-rkeys]')));
  panelEl.addEventListener('pointerleave', () => map.setHover());
  panelEl.addEventListener('focusin', (e) => hoverFrom(e.target.closest('[data-keys],[data-rkeys]')));
  panelEl.addEventListener('focusout', () => map.setHover());

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
    } else if (e.key === '+' || e.key === '=') zoom.zoomBy(0.7);
    else if (e.key === '-' || e.key === '_') zoom.zoomBy(1.4);
    else if (e.key === '0') zoom.home();
  });

  window.addEventListener('hashchange', onRoute);
  onRoute();
  if (store.get().route.view !== 'home') requestAnimationFrame(() => revealSelection());
  document.body.classList.add('ready');

  if (new URLSearchParams(location.search).has('debug')) {
    import('./validate.js').then((m) => m.validate({ graph, map }));
  }
  window.corpus = { graph, map, store, zoom }; // handy for poking around in the console
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
