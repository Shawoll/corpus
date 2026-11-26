// Data integrity check. Runs in the browser with ?debug in the URL, and headless with `node tools/check.mjs`.
// check() is pure (no DOM) so both can share it; validate() is the browser wrapper that logs and shows a badge.
import { parseKey } from './graph.js';

// drawn: Map(view -> Set(structure key)), regionShapes: Map(view -> Set(region key)),
// variants: [{ layer, view, style, keys: Set, base: Set }] a layer's drawing in another style and its default drawing's keys
export function check({ graph, drawn, regionShapes, variants = [] }) {
  const problems = [...graph.problems];
  const views = [...drawn.keys()];
  const all = new Set([...drawn.values()].flatMap((s) => [...s]));
  const allRegions = new Set([...regionShapes.values()].flatMap((s) => [...s]));

  for (const [view, keys] of drawn) {
    for (const k of keys) {
      const { id, side } = parseKey(k);
      const n = graph.node(id);
      if (!n) { problems.push(`SVG shape "${k}" (${view}) has no entry in the data`); continue; }
      if (n.paired && !side) problems.push(`"${id}" is paired but a ${view} shape has no data-side`);
      if (!n.paired && side) problems.push(`"${id}" is not paired but a ${view} shape has data-side="${side}"`);
    }
  }
  for (const n of graph.nodes.values()) {
    if (n.type === 'joint') continue;
    const keys = graph.instances(n.id);
    if (n.listOnly) { if (keys.some((k) => all.has(k))) problems.push(`"${n.id}" is drawn, so it shouldn't be "listOnly"`); continue; }
    for (const k of keys) if (!all.has(k)) problems.push(`"${k}" is not drawn in any view (add a shape or set "listOnly": true)`);
  }
  // a drawing in another style must show exactly the structures of the default drawing (same ids and sides)
  for (const { layer, view, style, keys, base } of variants) {
    for (const k of base) if (!keys.has(k)) problems.push(`The ${style} ${layer} drawing (${view}) is missing "${k}"`);
    for (const k of keys) if (!base.has(k)) problems.push(`The ${style} ${layer} drawing (${view}) has "${k}", which the default drawing doesn't`);
  }

  let bones = 0;
  for (const n of graph.nodes.values()) {
    if (n.type === 'bone') {
      bones += n.count || 0;
      for (const k of graph.instances(n.id)) if (!graph.jointsOf(k).length && !n.noJoints) problems.push(`Bone "${k}" has no joints`);
    }
    if (n.type === 'joint') for (const k of graph.instances(n.id)) if (!graph.membersOfJoint(k).length) problems.push(`Joint "${k}" connects nothing`);
    if (n.type === 'muscle') for (const k of graph.instances(n.id)) if (!graph.edges(k).some((e) => e.type === 'origin' || e.type === 'insertion')) problems.push(`Muscle "${k}" has no origin or insertion`);
  }
  if (bones !== 206) problems.push(`Bone count is ${bones}, expected 206`);

  // once a nerves or vessels layer exists, every muscle needs a nerve supply and a blood supply, and every organ a blood supply
  const types = new Set([...graph.nodes.values()].map((n) => n.type));
  const has = (k, type, dir) => graph.edges(k).some((e) => e.type === type && e.dir === dir);
  for (const n of graph.nodes.values()) {
    for (const k of graph.instances(n.id)) {
      if (['nerve', 'vessel', 'lymph', 'connective'].includes(n.type) && !graph.edges(k).length) problems.push(`${{ nerve: 'Nerve', vessel: 'Vessel', lymph: 'Lymphatic', connective: 'Ligament or tendon' }[n.type]} "${k}" connects nothing`);
      if (n.type === 'muscle' && types.has('nerve') && !has(k, 'innervates', 'in')) problems.push(`Muscle "${k}" has no nerve supply`);
      if ((n.type === 'muscle' || n.type === 'organ') && types.has('vessel') && !has(k, 'supplies', 'in')) problems.push(`${n.type === 'muscle' ? 'Muscle' : 'Organ'} "${k}" has no blood supply`);
    }
  }

  // regions: a back area ("view": "back") needs a shape in the back view, every other area one in the front view
  for (const k of allRegions) if (!graph.regions.get(parseKey(k).id)) problems.push(`Region shape "${k}" has no entry in regions.json`);
  const backView = views.includes('posterior') ? 'posterior' : null;
  for (const r of graph.regions.values()) {
    const home = r.view === 'back' ? backView : views[0];
    if (!home) problems.push(`Region "${r.id}" is on the back, but there is no posterior view`);
    else for (const k of graph.regionKeys(r.id)) if (!regionShapes.get(home)?.has(k)) problems.push(`Region "${k}" has no shape in the ${home} view`);
    const refs = [...graph.expandRefs(r.structures), ...r.causes.flatMap((c) => graph.expandRefs(c.related || []))];
    for (const ref of refs) if (!graph.node(parseKey(ref).id)) problems.push(`Region "${r.id}" references unknown "${ref}"`);
  }

  const unique = [...new Set(problems)];
  const edges = [...graph.adj.values()].reduce((s, l) => s + l.length, 0) / 2;
  const perView = [...drawn].map(([v, s]) => `${s.size} ${v}`).join(', ');
  const summary = `${unique.length} issue${unique.length === 1 ? '' : 's'} · ${bones} bones · ${graph.nodes.size} structures · ${edges} connections · drawn keys: ${perView}`;
  return { problems: unique, summary };
}

export function validate({ graph, map }) {
  const { problems, summary } = check({ graph, drawn: map.drawnByView(), regionShapes: map.regionsByView(), variants: map.variants() });
  console.group(`[Corpus] data check: ${summary}`);
  if (problems.length) console.table(problems.map((p) => ({ problem: p })));
  else console.info('All references resolve.');
  console.groupEnd();
  const badge = document.createElement('div');
  badge.className = 'debug-badge';
  badge.textContent = `debug: ${summary}`;
  document.body.appendChild(badge);
  return problems;
}
