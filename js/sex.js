// Biological sex: any object in the data may carry "sex": "female" | "male"; an object without one applies to both.
// forSex() returns filtered copies of the raw data for one setting ("none", "female" or "male"), so the app and the
// data check build one ordinary Graph per sex and graph.js knows nothing about it.
//   - entity arrays (structures, joints, groups, links, regions): a tagged entry is kept only for its own sex,
//     so with "none" every sex-specific structure is left out (nothing sex-specific is drawn or listed);
//   - every other array (issues, causes, members, functions, redFlags, sexNotes…): a tagged item is dropped only for
//     the other sex, so with "none" sex-specific text still shows (urgent causes are never hidden);
//   - references (from, to, structures, related and every link type's field) to an id or @group that no kept entry
//     brings back are removed, so shared lists like the iliac artery's "supplies" need no per-sex copies.
// Two entries may share an id when each has a different sex (the female and male breast): only one survives.
import { parseKey } from './graph.js';

export const SEX_VALUES = ['female', 'male'];
const tag = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x.sex : undefined);
const keepEntity = (x, sex) => !tag(x) || tag(x) === sex;
const keepText = (x, sex) => !tag(x) || sex === 'none' || tag(x) === sex;

export function forSex({ layers, links = [], regions = { regions: [] }, linkTypes = {} }, sex) {
  const refFields = new Set(['from', 'to', 'structures', 'related', ...Object.values(linkTypes).map((t) => t.field).filter(Boolean)]);
  // ids (structures, joints) and groups before and after filtering: "gone" ones no kept variant brings back
  const all = { ids: new Set(), groups: new Set() }, kept = { ids: new Set(), groups: new Set() };
  for (const L of layers) {
    for (const s of [...(L.data?.structures || []), ...(L.data?.joints || [])]) {
      all.ids.add(s.id);
      if (keepEntity(s, sex)) kept.ids.add(s.id);
    }
    for (const g of L.data?.groups || []) {
      all.groups.add(g.id);
      if (keepEntity(g, sex)) kept.groups.add(g.id);
    }
  }
  const gone = (r) => {
    if (typeof r !== 'string') return false;
    if (r.startsWith('@')) { const g = r.slice(1); return all.groups.has(g) && !kept.groups.has(g); }
    const { id } = parseKey(r);
    return all.ids.has(id) && !kept.ids.has(id);
  };
  // deep copy, applying the text rule to every array and stripping gone references in reference fields
  const clean = (v, key) => {
    if (Array.isArray(v)) {
      let out = v.filter((x) => keepText(x, sex)).map((x) => clean(x));
      if (refFields.has(key)) out = out.filter((x) => !gone(x));
      return out;
    }
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x, k)]));
    return v;
  };
  const entities = (arr) => (arr || []).filter((x) => keepEntity(x, sex)).map((x) => clean(x));

  return {
    layers: layers.map((L) => {
      if (!L.data) return L;
      const data = clean({ ...L.data, structures: undefined, joints: undefined, groups: undefined });
      for (const k of ['structures', 'joints', 'groups']) if (L.data[k]) data[k] = entities(L.data[k]);
      return { ...L, data };
    }),
    links: entities(links),
    regions: { ...clean({ ...regions, regions: undefined }), regions: entities(regions.regions) },
    linkTypes,
  };
}

// Every "sex" value in the data that isn't "female" or "male", as readable problems for the data check.
export function sexTagProblems(raw) {
  const out = [];
  const walk = (v, where) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, where));
    else if (v && typeof v === 'object') {
      if ('sex' in v && !SEX_VALUES.includes(v.sex)) out.push(`${where}: "sex" is "${v.sex}" (use "female" or "male")`);
      const here = v.id ? `"${v.id}"` : where;
      for (const [k, x] of Object.entries(v)) if (k !== 'sex') walk(x, here);
    }
  };
  for (const L of raw.layers) walk(L.data, L.id);
  walk(raw.links, 'links');
  walk(raw.regions, 'regions');
  return out;
}
