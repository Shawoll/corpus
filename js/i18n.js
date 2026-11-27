// Languages (docs/i18n.md). English is the source: the interface strings are in locales/en/ui.json and the content
// stays in data/*.json. Each other language adds locales/<lang>/ui.json (the same keys) and overlays of the data,
// keyed by id, in locales/<lang>/data/ (one per data file, the same name). Latin names are never translated.
//   - createT(): t(key, vars) for a key of ui.json, with {var} interpolation and plural forms;
//   - forLang(): pure, merges a language's overlays into a deep copy of the raw data (before js/sex.js's forSex),
//     so graph.js and the panel only ever see one language;
//   - langFiles(): the files a language reads, for main.js, the offline save and the data check.

// a structure, group, joint, member, cause or region field that holds text to translate (every "<field>Note" too)
export const TEXT_FIELDS = new Set(['name', 'summary', 'location', 'membersLabel', 'nerve', 'carries', 'pulse', 'subtype',
  'noJoints', 'listOnly', 'countLabel', 'rangeLabel', 'title', 'signs', 'note', 'text', 'disclaimer', 'emergency']);
export const isTextField = (k) => TEXT_FIELDS.has(k) || /^[a-z]+Note$/.test(k);
// arrays of text (a string, or { text, sex }) merged by index; aka is replaced as a whole (synonyms differ by language)
export const TEXT_LISTS = new Set(['actions', 'functions', 'movements', 'redFlags']);
// arrays of objects merged by index, field by field
export const ITEM_LISTS = new Set(['issues', 'members', 'causes', 'sexNotes']);
// objects of text by key (sideNotes: { right, left })
export const TEXT_MAPS = new Set(['sideNotes']);

const basename = (p) => p.split('/').pop();
// the files of one language: { ui, manifest, layers: { id: file }, regions, links: [file] } (data: null for English)
export function langFiles(manifest, lang) {
  const L = (manifest.languages || []).find((x) => x.id === lang);
  if (!L) return null;
  const dir = L.data;
  return {
    ui: L.ui,
    manifest: dir ? `${dir}/manifest.json` : null,
    layers: dir ? Object.fromEntries(manifest.layers.map((l) => [l.id, `${dir}/${basename(l.data)}`])) : {},
    regions: dir && manifest.regions ? `${dir}/${basename(manifest.regions.data)}` : null,
    links: dir ? (manifest.links || []).map((u) => `${dir}/${basename(u)}`) : [],
  };
}
// every file of every language (the offline save)
export const allLangFiles = (manifest) => (manifest.languages || []).flatMap((L) => {
  const f = langFiles(manifest, L.id);
  return [f.ui, f.manifest, ...Object.values(f.layers), f.regions, ...f.links].filter(Boolean);
});

// Read a language's overlays with read(url) -> JSON (a missing file is an empty overlay)
export async function loadLang(manifest, lang, read) {
  const f = langFiles(manifest, lang);
  if (!f) return null;
  const opt = (u) => (u ? read(u).catch(() => ({})) : Promise.resolve({}));
  const [ui, man, layerOvs, regions, links] = await Promise.all([
    opt(f.ui), opt(f.manifest),
    Promise.all(Object.entries(f.layers).map(async ([id, u]) => [id, await opt(u)])),
    opt(f.regions), Promise.all(f.links.map(opt)),
  ]);
  return {
    id: lang, ui, manifest: man, layers: Object.fromEntries(layerOvs), regions,
    links: { notes: Object.assign({}, ...links.map((x) => x.notes || {})) },
  };
}

// The language to start in: ?lang= (any listed language, drafts too), the saved choice, the browser's languages
// (finished ones only), else the first (English)
export function pickLang(languages, { param, saved, browser = [] }) {
  const ids = new Set(languages.map((l) => l.id));
  const ready = languages.filter((l) => !l.draft).map((l) => l.id);
  if (param && ids.has(param)) return param;
  if (saved && ids.has(saved)) return saved;
  for (const b of browser) {
    const base = String(b).toLowerCase().split('-')[0];
    if (ready.includes(base)) return base;
  }
  return languages[0]?.id || 'en';
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const isPlural = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// the plural forms whole numbers need in a language (Slovak: one, few, other)
export const pluralForms = (lang) => {
  const pr = new Intl.PluralRules(lang);
  return [...new Set(Array.from({ length: 201 }, (_, n) => pr.select(n)))];
};

// t(key, vars): the string in this language, else in English, else the key. "{n}" etc. are filled from vars, and a
// plural string ({ one, few, other }) is picked by vars.n. t.html(key, vars) gives it as HTML: keys ending in "Html"
// are markup from the locale files (their vars are escaped), every other string is escaped whole.
export function createT(strings = {}, fallback = {}, lang = 'en') {
  const pr = new Intl.PluralRules(lang), prEn = new Intl.PluralRules('en');
  const fill = (s, vars, enc) => s.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? enc(vars[k]) : m));
  const raw = (key, vars) => {
    let v = strings[key], rules = pr;
    if (v == null || v === '') { v = fallback[key]; rules = prEn; }
    if (v == null) return key;
    if (isPlural(v)) v = v[rules.select(Number(vars?.n ?? 0))] ?? v.other ?? '';
    return String(v);
  };
  const t = (key, vars) => fill(raw(key, vars), vars, String);
  t.html = (key, vars) => (key.endsWith('Html') ? fill(raw(key, vars), vars, esc) : esc(t(key, vars)));
  t.lang = lang;
  return t;
}

// [data-i18n="key"] sets the text, [data-i18n-html] the markup, [data-i18n-attr="attr:key; attr:key"] attributes
export function applyDom(root, t) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t.html(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
  if (root.documentElement) root.documentElement.lang = t.lang;
}

// ------------------------------------------------------------------ data overlays
const nonEmpty = (v) => typeof v === 'string' && v !== '';
// Merge one overlay object into a copy of src (a structure, group, joint, region…). English stays where the overlay
// has nothing; the English name is kept as nameEn (search) and each member's as en (stable ?m= links).
export function mergeText(src, ov) {
  if (!ov || typeof ov !== 'object') return src;
  const out = { ...src };
  for (const [k, v] of Object.entries(ov)) {
    const cur = src[k];
    if (k === 'aka') { if (Array.isArray(v) && v.length) { out.aka = v; out.akaEn = cur || []; } continue; }
    if (TEXT_LISTS.has(k) && Array.isArray(cur) && Array.isArray(v)) {
      out[k] = cur.map((x, i) => (!nonEmpty(v[i]) ? x : typeof x === 'string' ? v[i] : { ...x, text: v[i] }));
    } else if (ITEM_LISTS.has(k) && Array.isArray(cur) && Array.isArray(v)) {
      out[k] = cur.map((x, i) => {
        const m = mergeText(x, v[i]);
        if (k === 'members' && m !== x) m.en = x.name;
        return m;
      });
    } else if (TEXT_MAPS.has(k) && cur && typeof cur === 'object' && v && typeof v === 'object') {
      out[k] = { ...cur, ...Object.fromEntries(Object.entries(v).filter(([, s]) => nonEmpty(s))) };
    } else if (isTextField(k) && nonEmpty(v) && typeof cur === 'string') {
      out[k] = v;
    }
  }
  if (out.name !== src.name) out.nameEn = src.name;
  return out;
}
// the overlay entry of a data entry: "id#sex" for the entries that share an id (the female and male breast), else id
const entryOv = (byId, x) => byId?.[x.sex ? `${x.id}#${x.sex}` : x.id] ?? (x.sex ? byId?.[x.id] : undefined);

// the manifest with a language's names: views, styles, sexes and layers by id, linkTypes by type
export function localizeManifest(manifest, ov) {
  if (!ov) return manifest;
  const byId = (arr, o) => (arr || []).map((x) => (o?.[x.id] ? mergeText(x, o[x.id]) : x));
  const linkTypes = Object.fromEntries(Object.entries(manifest.linkTypes || {}).map(([k, lt]) => {
    const o = ov.linkTypes?.[k] || {};
    return [k, { ...lt, ...(nonEmpty(o.forward) ? { forward: o.forward } : {}), ...(nonEmpty(o.reverse) ? { reverse: o.reverse } : {}) }];
  }));
  return {
    ...manifest, title: nonEmpty(ov.title) ? ov.title : manifest.title,
    views: byId(manifest.views, ov.views), styles: byId(manifest.styles, ov.styles), sexes: byId(manifest.sexes, ov.sexes),
    layers: byId(manifest.layers, ov.layers), languages: manifest.languages, linkTypes,
  };
}

// raw: { layers, links, linkTypes, regions } as main.js and tools/check.mjs load it (English); lang: loadLang()'s
// result. Returns the same shape in that language. English (or no overlays) returns raw itself.
export function forLang(raw, lang) {
  if (!lang || (!lang.manifest && !Object.keys(lang.layers || {}).length && !lang.regions)) return raw;
  const ovm = lang.manifest || {};
  const entries = (arr, byId) => (arr ? arr.map((x) => mergeText(x, entryOv(byId, x))) : arr);
  const layers = raw.layers.map((L) => {
    const named = ovm.layers?.[L.id] ? mergeText(L, ovm.layers[L.id]) : L;
    const ov = lang.layers?.[L.id];
    if (!ov || !L.data) return named;
    const d = L.data;
    return { ...named, data: { ...d, structures: entries(d.structures, ov.structures), joints: entries(d.joints, ov.joints), groups: entries(d.groups, ov.groups) } };
  });
  const notes = lang.links?.notes || {};
  const links = raw.links.map((l) => (l.note && nonEmpty(notes[l.note]) ? { ...l, note: notes[l.note] } : l));
  const ro = lang.regions || {};
  const rd = raw.regions || { regions: [] };
  const top = mergeText({ disclaimer: rd.disclaimer, emergency: rd.emergency, redFlags: rd.redFlags }, { disclaimer: ro.disclaimer, emergency: ro.emergency, redFlags: ro.redFlags });
  const regions = { ...rd, ...Object.fromEntries(Object.entries(top).filter(([k]) => k in rd)), regions: entries(rd.regions, ro.regions) };
  return { ...raw, layers, links, linkTypes: localizeManifest({ linkTypes: raw.linkTypes }, ovm).linkTypes, regions };
}

// ------------------------------------------------------------------ text units (the data check and tools/i18n.mjs)
// Every English string a language can translate, as { file, path, en }: file is "manifest", "regions", "links" or a
// layer id, and path addresses the same string in that file's overlay (["structures", "femur", "issues", 0, "name"]).
// aka is one unit (a list, replaced whole).
function entryUnits(obj, base, out) {
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'aka') { if (Array.isArray(v) && v.length) out.push({ path: [...base, k], en: v }); }
    else if (TEXT_LISTS.has(k) && Array.isArray(v)) v.forEach((x, i) => { const s = typeof x === 'string' ? x : x?.text; if (s) out.push({ path: [...base, k, i], en: s }); });
    else if (ITEM_LISTS.has(k) && Array.isArray(v)) v.forEach((x, i) => { if (x && typeof x === 'object') entryUnits(x, [...base, k, i], out); });
    else if (TEXT_MAPS.has(k) && v && typeof v === 'object') { for (const [kk, s] of Object.entries(v)) if (nonEmpty(s)) out.push({ path: [...base, k, kk], en: s }); }
    else if (isTextField(k) && nonEmpty(v)) out.push({ path: [...base, k], en: v });
  }
}
// an entry's key in its overlay: "id#sex" when another entry of the same list shares its id (see entryOv)
const entryKeys = (arr) => {
  const n = new Map();
  for (const x of arr) n.set(x.id, (n.get(x.id) || 0) + 1);
  return (x) => (n.get(x.id) > 1 && x.sex ? `${x.id}#${x.sex}` : x.id);
};
export function textUnits(manifest, raw) {
  const out = [];
  const push = (file, list) => list.forEach((u) => out.push({ file, ...u }));
  const m = [];
  if (nonEmpty(manifest.title)) m.push({ path: ['title'], en: manifest.title });
  for (const list of ['views', 'styles', 'sexes', 'layers']) {
    for (const x of manifest[list] || []) for (const k of ['name', 'short']) if (nonEmpty(x[k])) m.push({ path: [list, x.id, k], en: x[k] });
  }
  for (const [type, lt] of Object.entries(manifest.linkTypes || {})) for (const k of ['forward', 'reverse']) if (nonEmpty(lt[k])) m.push({ path: ['linkTypes', type, k], en: lt[k] });
  push('manifest', m);
  for (const L of raw.layers) {
    const u = [];
    for (const sec of ['structures', 'joints', 'groups']) {
      const arr = L.data?.[sec] || [];
      const key = entryKeys(arr);
      for (const x of arr) entryUnits(x, [sec, key(x)], u);
    }
    push(L.id, u);
  }
  const rd = raw.regions || {};
  const r = [];
  entryUnits({ disclaimer: rd.disclaimer, emergency: rd.emergency, redFlags: rd.redFlags }, [], r);
  const key = entryKeys(rd.regions || []);
  for (const x of rd.regions || []) entryUnits(x, ['regions', key(x)], r);
  push('regions', r);
  const notes = [...new Set(raw.links.map((l) => l.note).filter(nonEmpty))];
  push('links', notes.map((n) => ({ path: ['notes', n], en: n })));
  return out;
}
export const unitId = (u) => `${u.file}:${u.path.join('/')}`;
export const getAt = (obj, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
// set a value in a nested overlay, making objects (or arrays, before a numeric key) on the way
export function setAt(obj, path, v) {
  let o = obj;
  path.forEach((k, i) => {
    if (i === path.length - 1) { o[k] = v; return; }
    if (o[k] == null) o[k] = typeof path[i + 1] === 'number' ? [] : {};
    o = o[k];
  });
  return obj;
}
// a language's overlay of one file (as loadLang() returns them)
export const overlayOf = (lang, file) => (file === 'manifest' ? lang?.manifest : file === 'regions' ? lang?.regions : file === 'links' ? lang?.links : lang?.layers?.[file]) || {};
export const translated = (v) => (Array.isArray(v) ? v.length > 0 : nonEmpty(v));
// where a language's source.json is kept: next to its ui.json
export const sourceFile = (manifest, lang) => {
  const L = (manifest.languages || []).find((x) => x.id === lang);
  return L?.ui ? L.ui.replace(/[^/]+$/, 'source.json') : null;
};
