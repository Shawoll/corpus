// Data integrity check, loaded only with ?debug in the URL. Helps when adding layers or editing data.
import { parseKey } from './graph.js';

export function validate({ graph, map }) {
  const problems = [...graph.problems];
  const drawn = new Set(map.keys());
  const regionShapes = new Set(map.regionKeys());

  for (const k of drawn) {
    const { id, side } = parseKey(k);
    const n = graph.node(id);
    if (!n) { problems.push(`SVG shape "${k}" has no entry in the data`); continue; }
    if (n.paired && !side) problems.push(`"${id}" is paired but a shape has no data-side`);
    if (!n.paired && side) problems.push(`"${id}" is not paired but a shape has data-side="${side}"`);
  }
  for (const n of graph.nodes.values()) {
    if (n.type === 'joint' || n.listOnly) continue;
    for (const k of graph.instances(n.id)) if (!drawn.has(k)) problems.push(`"${k}" is not drawn (add a shape or set "listOnly": true)`);
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
      if ((n.type === 'nerve' || n.type === 'vessel') && !graph.edges(k).length) problems.push(`${n.type === 'nerve' ? 'Nerve' : 'Vessel'} "${k}" connects nothing`);
      if (n.type === 'muscle' && types.has('nerve') && !has(k, 'innervates', 'in')) problems.push(`Muscle "${k}" has no nerve supply`);
      if ((n.type === 'muscle' || n.type === 'organ') && types.has('vessel') && !has(k, 'supplies', 'in')) problems.push(`${n.type === 'muscle' ? 'Muscle' : 'Organ'} "${k}" has no blood supply`);
    }
  }

  for (const k of regionShapes) if (!graph.regions.get(parseKey(k).id)) problems.push(`Region shape "${k}" has no entry in regions.json`);
  for (const r of graph.regions.values()) {
    if (r.view !== 'back') for (const k of graph.regionKeys(r.id)) if (!regionShapes.has(k)) problems.push(`Region "${k}" has no shape`);
    const refs = [...graph.expandRefs(r.structures), ...r.causes.flatMap((c) => graph.expandRefs(c.related || []))];
    for (const ref of refs) if (!graph.node(parseKey(ref).id)) problems.push(`Region "${r.id}" references unknown "${ref}"`);
  }

  const unique = [...new Set(problems)];
  const edges = [...graph.adj.values()].reduce((s, l) => s + l.length, 0) / 2;
  const summary = `${unique.length} issue${unique.length === 1 ? '' : 's'} · ${bones} bones · ${graph.nodes.size} structures · ${edges} connections · ${drawn.size} drawn keys`;
  console.group(`[Corpus] data check: ${summary}`);
  if (unique.length) console.table(unique.map((p) => ({ problem: p })));
  else console.info('All references resolve.');
  console.groupEnd();
  const badge = document.createElement('div');
  badge.className = 'debug-badge';
  badge.textContent = `debug: ${summary}`;
  document.body.appendChild(badge);
  return unique;
}
