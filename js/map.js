// The body map: mounts each layer's SVG into one <svg>, indexes shapes by key, and renders highlight state.
// Every view (front, back) gets its own <g class="view">; only the current one is displayed. All drawings share
// one frame (body's right at x < 240), so a view with "flip" is shown through the mirror transform on #world.
// A layer may have one drawing per style (schematic, realistic) in a view: each gets its own <g class="layer"
// data-style=…> with the same ids, and only the current style's group is displayed.
// A sex-specific shape carries data-sex="female|male" and is hidden (.sex-off) unless that biological sex is chosen.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
const keyOf = (node) => (node.dataset.side ? `${node.dataset.id}:${node.dataset.side}` : node.dataset.id);

export function createMap({ svg, graph, onPick, onHover }) {
  const layersG = svg.querySelector('#layers');
  const overlay = svg.querySelector('#overlay');
  const world = svg.querySelector('#world');
  const index = new Map(); // structure key -> elements (all views)
  const rindex = new Map(); // region key -> elements (all views)
  const keyViews = new Map(); // structure key -> Set(view) where it is drawn and tappable (not .back)
  const regionViews = new Map(); // region key -> Set(view)
  const drawn = new Map(); // view -> Map(structure key -> Set(data-sex value, '' when untagged)), including .back shapes
  const sexed = []; // elements with data-sex
  const regionDrawn = new Map(); // view -> Set(region key)
  const layerEls = new Map(); // layer id -> [<g class="layer">] (one per view it is drawn in)
  const viewEls = new Map(); // view id -> <g class="view">
  const styled = []; // [{ g, style }] layer groups that belong to one drawing style
  const variants = []; // [{ layer, view, style, keys: Set, base: Set }] for the ?debug check
  let viewIds = [];
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
  const shown = (e) => !e.closest('.layer.off, .layer.style-off, .view.off, .sex-off');
  let marked = [];
  let hovered = [];

  function importSvg(text, into) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const root = doc.documentElement;
    if (root.nodeName !== 'svg') throw new Error('Not an SVG');
    for (const child of [...root.children]) {
      if (child.nodeName === 'title' || child.nodeName === 'style' || child.nodeName === 'script') continue;
      into.appendChild(document.importNode(child, true));
    }
  }

  // layers: [{ id, svgs: { <view>: svgText }, styleSvgs: { <style>: { <view>: svgText } } }], regionSvgs: { <view>: svgText },
  // views: [{ id }] (drawing order: first is bottom), styles: [{ id }] (the first is the default drawing, held in svgs)
  function mount(layers, regionSvgs = {}, views = [{ id: 'anterior' }], styles = [{ id: 'default' }]) {
    const keysOf = (g) => new Set([...g.querySelectorAll('[data-id]')].map(keyOf));
    viewIds = views.map((v) => v.id);
    for (const V of views) {
      const vg = el('g', { class: 'view', 'data-view': V.id });
      layersG.appendChild(vg);
      viewEls.set(V.id, vg);
      drawn.set(V.id, new Map());
      regionDrawn.set(V.id, new Set());
      for (const L of layers) {
        if (!L.svgs?.[V.id]) continue;
        const alts = styles.slice(1).filter((S) => L.styleSvgs?.[S.id]?.[V.id]);
        const groups = [{ style: alts.length ? styles[0].id : null, text: L.svgs[V.id] },
          ...alts.map((S) => ({ style: S.id, text: L.styleSvgs[S.id][V.id] }))];
        if (!layerEls.has(L.id)) layerEls.set(L.id, []);
        for (const { style, text } of groups) {
          const g = el('g', { class: 'layer', 'data-layer': L.id });
          if (style) { g.dataset.style = style; styled.push({ g, style }); }
          importSvg(text, g);
          vg.appendChild(g);
          layerEls.get(L.id).push(g);
        }
        if (alts.length) {
          const [base, ...rest] = layerEls.get(L.id).slice(-groups.length);
          const baseKeys = keysOf(base);
          rest.forEach((g, i) => variants.push({ layer: L.id, view: V.id, style: alts[i].id, keys: keysOf(g), base: baseKeys }));
        }
      }
      const rg = el('g', { class: 'layer regions-layer', 'data-layer': 'regions' });
      if (regionSvgs[V.id]) importSvg(regionSvgs[V.id], rg);
      vg.appendChild(rg);

      for (const e of vg.querySelectorAll('.layer:not(.regions-layer) [data-id]')) {
        const k = keyOf(e);
        e.dataset.key = k;
        if (!index.has(k)) index.set(k, []);
        index.get(k).push(e);
        add(drawn.get(V.id), k, e.dataset.sex || '');
        if (e.dataset.sex) sexed.push(e);
        if (!e.classList.contains('back')) add(keyViews, k, V.id);
        const b = e.querySelector(':scope > .b');
        if (b) { const hit = b.cloneNode(false); hit.setAttribute('class', 'hit'); e.appendChild(hit); }
        if (e.classList.contains('jm')) {
          const n = graph.node(e.dataset.id);
          if (n?.class) e.dataset.jclass = n.class;
        }
      }
      for (const e of rg.querySelectorAll('[data-id]')) {
        const k = keyOf(e);
        e.dataset.rkey = k;
        if (!rindex.has(k)) rindex.set(k, []);
        rindex.get(k).push(e);
        regionDrawn.get(V.id).add(k);
        add(regionViews, k, V.id);
      }
    }
  }

  // Views (in manifest order) where any of these keys is drawn; regions: true looks at "Where does it hurt?" areas.
  function viewsOf(keys, { regions = false } = {}) {
    const m = regions ? regionViews : keyViews;
    const hit = new Set();
    for (const k of keys) for (const v of m.get(k) || []) hit.add(v);
    return viewIds.filter((v) => hit.has(v));
  }

  // ---- events
  svg.addEventListener('click', (e) => {
    const r = e.target.closest?.('[data-rkey]');
    const s = e.target.closest?.('[data-key]');
    onPick({ key: s?.dataset.key || null, rkey: r?.dataset.rkey || null, clientX: e.clientX, clientY: e.clientY });
  });
  let lastHover = null;
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const t = e.target.closest?.('[data-rkey],[data-key]');
    const id = t ? (t.dataset.rkey ? 'r|' + t.dataset.rkey : t.dataset.key) : null;
    if (id !== lastHover) lastHover = id;
    onHover(t ? { key: t.dataset.key || null, rkey: t.dataset.rkey || null } : null, e.clientX, e.clientY);
  });
  svg.addEventListener('pointerleave', () => { lastHover = null; onHover(null); });

  // ---- rendering
  function render(v) {
    for (const e of marked) e.classList.remove('is-sel', 'is-rel');
    marked = [];
    const mark = (keys, cls, idx = index) => {
      for (const k of keys) for (const e of idx.get(k) || []) { e.classList.add(cls); marked.push(e); }
    };
    mark(v.rel, 'is-rel');
    mark(v.sel, 'is-sel');
    mark(v.rsel, 'is-sel', rindex);

    svg.classList.toggle('has-sel', v.sel.size > 0 || v.rsel.size > 0);
    svg.classList.toggle('mode-hurt', !!v.hurt);
    svg.classList.toggle('no-joints', !v.joints);
    for (const [id, g] of viewEls) g.classList.toggle('off', id !== v.view);
    for (const { g, style } of styled) g.classList.toggle('style-off', style !== v.style);
    for (const e of sexed) e.classList.toggle('sex-off', e.dataset.sex !== v.sex);
    for (const [id, gs] of layerEls) {
      const on = v.visible.has(id);
      for (const g of gs) {
        g.classList.toggle('off', !on);
        g.classList.toggle('active', on && v.active === id);
        g.classList.toggle('context', on && v.active !== id);
      }
    }
    world.setAttribute('transform', v.flip ? 'matrix(-1 0 0 1 480 0)' : 'matrix(1 0 0 1 0 0)');

    // outline overlay for the selection (makes hidden-behind structures visible)
    overlay.replaceChildren();
    const ov = el('g', { class: 'ov' });
    for (const k of v.sel) {
      for (const e of index.get(k) || []) {
        if (!shown(e)) continue;
        const shape = e.matches('circle') ? e : e.querySelector('.b');
        if (shape) ov.appendChild(shape.cloneNode(false)).removeAttribute('class');
      }
    }
    // dashed outlines for connected structures, so ones hidden behind others still show
    const ovr = el('g', { class: 'ov-rel' });
    for (const k of v.rel) {
      for (const e of index.get(k) || []) {
        if (!shown(e) || e.matches('circle') || e.classList.contains('jt')) continue;
        const shape = e.querySelector('.b');
        if (shape) ovr.appendChild(shape.cloneNode(false)).removeAttribute('class');
      }
    }
    overlay.appendChild(ovr);
    overlay.appendChild(ov);
    if (v.probePoint) overlay.appendChild(el('circle', { class: 'probe-dot', cx: v.probePoint.x, cy: v.probePoint.y, r: 3.2 }));
  }

  function setHover(keys = [], rkeys = []) {
    for (const e of hovered) e.classList.remove('is-hover');
    hovered = [];
    for (const k of keys) for (const e of index.get(k) || []) { e.classList.add('is-hover'); hovered.push(e); }
    for (const k of rkeys) for (const e of rindex.get(k) || []) { e.classList.add('is-hover'); hovered.push(e); }
  }

  // Everything under a screen point, across all layers of the current view (even hidden ones), top-most first.
  function probe(clientX, clientY) {
    svg.classList.add('probing');
    const hits = document.elementsFromPoint(clientX, clientY);
    svg.classList.remove('probing');
    const out = [];
    for (const h of hits) {
      const s = h.closest?.('[data-key]');
      if (s && !s.classList.contains('jm') && !out.includes(s.dataset.key)) out.push(s.dataset.key);
    }
    return out;
  }

  function toSvgPoint(clientX, clientY) {
    const m = world.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  // Bounding box of keys in viewBox units.
  function bbox(keys, { regions = false } = {}) {
    const idx = regions ? rindex : index;
    const rootInv = svg.getScreenCTM()?.inverse();
    if (!rootInv) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k of keys) {
      for (const e of idx.get(k) || []) {
        if (!shown(e)) continue;
        let b;
        try { b = e.getBBox(); } catch { continue; }
        const m = e.getScreenCTM();
        if (!m || (!b.width && !b.height)) continue;
        const M = rootInv.multiply(m);
        for (const [px, py] of [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]) {
          const p = new DOMPoint(px, py).matrixTransform(M);
          x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
        }
      }
    }
    return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  return {
    mount, render, setHover, probe, bbox, toSvgPoint, viewsOf,
    has: (k) => index.has(k),
    keys: () => [...index.keys()],
    regionKeys: () => [...rindex.keys()],
    // view -> Set(structure key) drawn for one sex (untagged shapes and that sex's), and the tagged map for ?debug
    drawnByView: (sex = 'none') => new Map([...drawn].map(([v, m]) => [v, new Set([...m].filter(([, t]) => t.has('') || t.has(sex)).map(([k]) => k))])),
    drawnTagged: () => drawn,
    regionsByView: () => regionDrawn,
    variants: () => variants, // per-style drawings of a layer, for the ?debug check (same keys as the default)
    elements: (k) => index.get(k) || [],
  };
}
