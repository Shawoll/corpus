// Data integrity check. Runs in the browser with ?debug in the URL, and headless with `node tools/check.mjs`.
// check() is pure (no DOM) so both can share it; checkAll() runs it once per biological sex setting (each builds its
// own graph from forSex()); validate() is the browser wrapper that logs and shows a badge.
import { Graph, parseKey } from './graph.js';
import { forSex, sexTagProblems } from './sex.js';
import { pluralForms, isPlural, textUnits, setAt, getAt, overlayOf, translated, unitId } from './i18n.js';

// drawn: Map(view -> Set(structure key)), regionShapes: Map(view -> Set(region key)),
// variants: [{ layer, view, style, keys: Set, base: Set }] a layer's drawing in another style and its default drawing's keys,
// models: [{ layer, file, nodes: [{ name, key, sex }], listed: [key] | null }] the 3D model's .glb files (see modelsFrom)
export function check({ graph, drawn, regionShapes, variants = [], models = [], sex = 'none' }) {
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
    for (const old of r.formerly || []) if (graph.regions.has(old)) problems.push(`Region "${r.id}" lists "${old}" under formerly, but that area still exists`);
    const home = r.view === 'back' ? backView : views[0];
    if (!home) problems.push(`Region "${r.id}" is on the back, but there is no posterior view`);
    else for (const k of graph.regionKeys(r.id)) if (!regionShapes.get(home)?.has(k)) problems.push(`Region "${k}" has no shape in the ${home} view`);
    const refs = [...graph.expandRefs(r.structures), ...r.causes.flatMap((c) => graph.expandRefs(c.related || []))];
    for (const ref of refs) if (!graph.node(parseKey(ref).id)) problems.push(`Region "${r.id}" references unknown "${ref}"`);
  }

  // the 3D model: every mesh is a structure of its own layer, with the side rules of the drawings; coverage is reported,
  // not required (the source has no female body, for one). Meshes of the other sex don't exist for this sex.
  const in3d = new Set();
  for (const { layer, file, nodes, listed } of models) {
    for (const nd of nodes) {
      if (nd.key !== nd.name) problems.push(`3D model ${file}: node "${nd.name}" carries key "${nd.key}"`);
      if (nd.sex && nd.sex !== sex) continue;
      const { id, side } = parseKey(nd.key || '');
      const n = graph.node(id);
      if (!n) { problems.push(`3D model ${file}: "${nd.key}" has no entry in the data${nd.sex ? '' : ' (if it exists for one sex only, give it extras.sex)'}`); continue; }
      if (n.layer !== layer) problems.push(`3D model ${file}: "${nd.key}" belongs to the ${n.layer} layer`);
      if (n.paired && !side) problems.push(`3D model ${file}: "${id}" is paired but its mesh has no side`);
      if (!n.paired && side) problems.push(`3D model ${file}: "${id}" is not paired but its mesh is "${nd.key}"`);
      in3d.add(nd.key);
    }
    if (listed) {
      const got = new Set(nodes.map((x) => x.key));
      for (const k of listed) if (!got.has(k)) problems.push(`assets/3d/keys.json lists "${k}" for ${layer}, but ${file} has no such mesh`);
      for (const k of got) if (!listed.includes(k)) problems.push(`${file} has "${k}", which assets/3d/keys.json doesn't list (rerun the build)`);
    }
  }
  const solid = [...graph.nodes.values()].filter((n) => n.type !== 'joint');
  const model3d = models.length ? { have: solid.filter((n) => graph.instances(n.id).every((k) => in3d.has(k))).length, of: solid.length } : null;

  const unique = [...new Set(problems)];
  const edges = [...graph.adj.values()].reduce((s, l) => s + l.length, 0) / 2;
  const perView = [...drawn].map(([v, s]) => `${s.size} ${v}`).join(', ');
  const summary = `${unique.length} issue${unique.length === 1 ? '' : 's'} · ${bones} bones · ${graph.nodes.size} structures · ${edges} connections · drawn keys: ${perView}`;
  return { problems: unique, summary, stats: { bones, structures: graph.nodes.size, edges, perView, model3d } };
}

// Keys drawn for one sex: drawnTagged is Map(view -> Map(key -> Set(data-sex value, '' when untagged))).
export const drawnForSex = (drawnTagged, sex) => new Map([...drawnTagged].map(([v, m]) =>
  [v, new Set([...m].filter(([, tags]) => tags.has('') || tags.has(sex)).map(([k]) => k))]));

const SEX_LABEL = { none: 'not set', female: 'female', male: 'male' };
// raw: { layers, links, linkTypes, regions } as loaded. Problems found for every sex are listed once; the others are
// prefixed with the sex they occur in ("[male] …").
// skin: { file, regions: [region key], listed: [region key] | null } the 3D skin's areas (see modelsFrom), or null
export function checkAll({ raw, sexes = ['none', 'female', 'male'], drawnTagged, regionShapes, variants = [], models = [], skin = null }) {
  const graphs = sexes.map((sex) => new Graph(forSex(raw, sex)));
  const runs = sexes.map((sex, i) => ({ sex, ...check({ graph: graphs[i], drawn: drawnForSex(drawnTagged, sex), regionShapes, variants, models, sex }) }));
  const everywhere = runs[0].problems.filter((p) => runs.every((r) => r.problems.includes(p)));
  const problems = [...sexTagProblems(raw), ...everywhere];
  // the skin's areas come from the region drawings (tools/model3d/skin.py): each must be an area for some sex
  if (skin) {
    for (const rk of skin.regions) {
      const { id, side } = parseKey(rk);
      const r = graphs.map((g) => g.regions.get(id)).find(Boolean);
      if (!r) problems.push(`${skin.file}: area "${rk}" has no entry in regions.json (rebuild the skin)`);
      else if (!!r.paired !== !!side) problems.push(`${skin.file}: area "${rk}" ${r.paired ? 'needs' : 'shouldn’t have'} a side`);
    }
    if (skin.listed && skin.listed.join() !== [...new Set(skin.regions)].sort().join()) problems.push(`assets/3d/keys.json "skin" doesn't match ${skin.file} (rerun the build)`);
  }
  for (const r of runs) for (const p of r.problems) if (!everywhere.includes(p)) problems.push(`[${SEX_LABEL[r.sex] || r.sex}] ${p}`);
  const st = runs[0].stats;
  const per = runs.map((r) => `${r.stats.structures} ${SEX_LABEL[r.sex] || r.sex}`).join(' / ');
  const m3 = runs.filter((r) => r.stats.model3d).map((r) => `${r.stats.model3d.have}/${r.stats.model3d.of} ${SEX_LABEL[r.sex] || r.sex}`);
  const summary = `${problems.length} issue${problems.length === 1 ? '' : 's'} · ${st.bones} bones · structures ${per} · ${st.edges} connections · drawn keys: ${st.perView}`
    + (m3.length ? ` · in 3D: ${m3.join(' / ')}` : '');
  return { problems, summary };
}

// The nodes of a binary glTF (.glb): its JSON chunk follows the 12-byte header and the chunk's length and type.
// Each mesh node is named with its key and carries { key, sex? } in extras (tools/model3d/build.py).
export function glbNodes(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(16, true) !== 0x4e4f534a) throw new Error('not a binary glTF file');
  const json = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + dv.getUint32(12, true))));
  return (json.nodes || []).filter((n) => n.mesh != null).map((n) => ({ name: n.name, key: n.extras?.key, sex: n.extras?.sex }));
}

// The 3D model's files for check(): read(url, 'bytes' | 'json') fetches one (fetch() in the browser, the file system in Node)
export async function modelsFrom(manifest, read) {
  if (!manifest.views?.some((v) => v.model)) return [];
  const index = manifest.model3d?.keys ? await read(manifest.model3d.keys, 'json') : null;
  return Promise.all(manifest.layers.filter((l) => l.model).map(async (l) => ({
    layer: l.id, file: l.model, nodes: glbNodes(await read(l.model, 'bytes')), listed: index?.layers?.[l.id] || null,
  })));
}

// The 3D skin's areas for checkAll(): the region keys in skin.glb's extras, and the ones keys.json lists
export async function skinFrom(manifest, read) {
  const file = manifest.views?.some((v) => v.model) && manifest.model3d?.skin;
  if (!file) return null;
  const index = manifest.model3d.keys ? await read(manifest.model3d.keys, 'json') : null;
  const b = new Uint8Array(await read(file, 'bytes'));
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const json = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + dv.getUint32(12, true))));
  const regions = (json.nodes || []).flatMap((n) => (n.extras?.skin ? n.extras.regions || [] : [])).filter(Boolean);
  return { file, regions, listed: index?.skin || null };
}

// langs: checkLang()'s results for the languages other than English
export function validate({ raw, map, models = [], skin = null, langs = [] }) {
  const all = checkAll({ raw, drawnTagged: map.drawnTagged(), regionShapes: map.regionsByView(), variants: map.variants(), models, skin });
  const problems = [...all.problems, ...langs.flatMap((l) => l.problems)];
  const summary = [all.summary.replace(/^\d+ issues?/, `${problems.length} issue${problems.length === 1 ? '' : 's'}`), ...langs.map((l) => l.summary)].join(' · ');
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

// ------------------------------------------------------------------ languages (js/i18n.js, docs/i18n.md)
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
// One language against English. lang: loadLang()'s result; enUi: locales/en/ui.json; source: its source.json (the
// English each translation was made from) or null. Problems: overlay ids or fields that English doesn't have, lists
// of another length, placeholders that differ, plural strings without the forms the language needs, and stale
// strings (English changed since). A draft may be incomplete; a finished language must translate every string.
export function checkLang({ manifest, raw, lang, enUi, source = null }) {
  const L = (manifest.languages || []).find((x) => x.id === lang.id) || {};
  const tag = `[${lang.id}]`;
  const problems = [];
  // ui.json
  const ui = lang.ui || {};
  const forms = pluralForms(lang.id);
  let uiDone = 0;
  for (const [k, v] of Object.entries(ui)) {
    if (!(k in enUi)) { problems.push(`${tag} ui.json: "${k}" is not a key of locales/en/ui.json`); continue; }
    const en = enUi[k];
    if (isPlural(en) !== isPlural(v)) { problems.push(`${tag} ui.json: "${k}" ${isPlural(en) ? 'needs plural forms' : 'is not a plural string'}`); continue; }
    if (isPlural(v)) {
      const miss = forms.filter((f) => !nonEmptyStr(v[f]));
      if (miss.length) problems.push(`${tag} ui.json: "${k}" lacks the plural form${miss.length > 1 ? 's' : ''} ${miss.join(', ')}`);
      for (const f of forms) if (nonEmptyStr(v[f]) && placeholders(v[f]) !== placeholders(en.other)) problems.push(`${tag} ui.json: "${k}" (${f}) has placeholders {${placeholders(v[f])}}, English {${placeholders(en.other)}}`);
    } else if (nonEmptyStr(v) && placeholders(v) !== placeholders(en)) problems.push(`${tag} ui.json: "${k}" has placeholders {${placeholders(v)}}, English {${placeholders(en)}}`);
    if (isPlural(v) ? forms.every((f) => nonEmptyStr(v[f])) : nonEmptyStr(v)) uiDone++;
  }
  const uiTotal = Object.keys(enUi).length;
  // data overlays: every overlay value must sit where English has a string (or a list of the same length)
  const units = textUnits(manifest, raw);
  const enTree = {};
  for (const u of units) setAt(enTree[u.file] ||= {}, u.path, u.en);
  const files = ['manifest', ...raw.layers.map((x) => x.id), 'regions', 'links'];
  const walk = (ov, en, path, file) => {
    for (const [k, v] of Object.entries(ov)) {
      const p = [...path, k];
      const where = `${file} ${p.join('/')}`;
      const e = en?.[k];
      // aka is the language's own synonyms (search): allowed on any entry, even one with none in English
      if (k === 'aka' && e === undefined && en && !Array.isArray(en) && path.length === 2) { if (!Array.isArray(v) || v.some((x) => !nonEmptyStr(x))) problems.push(`${tag} ${where}: aka must be a list of strings`); continue; }
      if (e === undefined) { if (v != null && v !== '') problems.push(`${tag} ${file}: nothing to translate at ${p.join('/')} (unknown id or field)`); continue; }
      if (k === 'aka' && Array.isArray(e)) { if (!Array.isArray(v) || v.some((x) => !nonEmptyStr(x))) problems.push(`${tag} ${where}: aka must be a list of strings`); continue; }
      if (Array.isArray(e)) {
        if (!Array.isArray(v)) problems.push(`${tag} ${where}: should be a list`);
        else if (v.length !== e.length) problems.push(`${tag} ${where}: ${v.length} items, English has ${e.length}`);
        else walk(Object.fromEntries(v.map((x, i) => [i, x])), Object.fromEntries(e.map((x, i) => [i, x])), path.concat(k), file);
      } else if (e && typeof e === 'object') {
        if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, e, p, file);
        else if (v != null) problems.push(`${tag} ${where}: should be an object`);
      } else if (v != null && typeof v !== 'string') problems.push(`${tag} ${where}: should be a string`);
      else if (nonEmptyStr(v) && placeholders(v) !== placeholders(e)) problems.push(`${tag} ${where}: placeholders {${placeholders(v)}}, English {${placeholders(e)}}`);
    }
  };
  for (const f of files) walk(overlayOf(lang, f), enTree[f], [], f);
  let dataDone = 0, unsnapped = 0;
  const missing = [];
  for (const u of units) {
    const v = getAt(overlayOf(lang, u.file), u.path);
    if (!translated(v)) { missing.push(unitId(u)); continue; }
    dataDone++;
    const id = unitId(u);
    if (!source || !(id in source)) unsnapped++;
    else if (JSON.stringify(source[id]) !== JSON.stringify(u.en)) problems.push(`${tag} stale: ${id} (the English changed since it was translated)`);
  }
  const missingUi = Object.keys(enUi).filter((k) => !(isPlural(enUi[k]) ? isPlural(ui[k]) && forms.every((f) => nonEmptyStr(ui[k][f])) : nonEmptyStr(ui[k])));
  if (!L.draft) {
    if (missingUi.length) problems.push(`${tag} ${missingUi.length} interface string(s) not translated: ${missingUi.slice(0, 5).join(', ')}${missingUi.length > 5 ? '…' : ''}`);
    if (missing.length) problems.push(`${tag} ${missing.length} data string(s) not translated: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
    if (unsnapped) problems.push(`${tag} ${unsnapped} translated string(s) not in source.json (run node tools/i18n.mjs snapshot ${lang.id})`);
  }
  const pct = (a, b) => (b ? Math.floor((a / b) * 100) : 100);
  const summary = `${lang.id}${L.draft ? ' (draft)' : ''}: ui ${uiDone}/${uiTotal} (${pct(uiDone, uiTotal)}%), data ${dataDone}/${units.length} (${pct(dataDone, units.length)}%)${unsnapped ? `, ${unsnapped} not snapshotted` : ''}`;
  return { problems, summary };
}
const nonEmptyStr = (v) => typeof v === 'string' && v !== '';
