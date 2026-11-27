#!/usr/bin/env node
// Translation helper (docs/i18n.md), from the repository root (Node 22+, no packages):
//   node tools/i18n.mjs status <lang>            what is translated, per file
//   node tools/i18n.mjs todo <lang> [file]       the English still to translate, in the overlay's shape (stdout):
//                                                file is ui, manifest, regions, links or a layer id (skeleton…)
//   node tools/i18n.mjs snapshot <lang>          record the English of every translated string in
//                                                locales/<lang>/source.json, so the data check can spot stale ones
import { readFile, writeFile } from 'node:fs/promises';
import { loadLang, textUnits, unitId, getAt, setAt, overlayOf, translated, sourceFile, isPlural, pluralForms } from '../js/i18n.js';

const root = new URL('../', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const [cmd, id, only] = process.argv.slice(2);
const manifest = await json('data/manifest.json');
const languages = manifest.languages || [];
if (!cmd || !id || !languages.some((l) => l.id === id) || id === languages[0]?.id) {
  console.error(`usage: node tools/i18n.mjs status|todo|snapshot <${languages.slice(1).map((l) => l.id).join('|')}> [file]`);
  process.exit(2);
}
const layers = await Promise.all(manifest.layers.map(async (l) => ({ ...l, data: await json(l.data) })));
const links = (await Promise.all((manifest.links || []).map(json))).flatMap((f) => f.links || []);
const raw = { layers, links, linkTypes: manifest.linkTypes, regions: manifest.regions ? await json(manifest.regions.data) : { regions: [] } };
const enUi = await json(languages[0].ui);
const lang = await loadLang(manifest, id, json);
const units = textUnits(manifest, raw);
const forms = pluralForms(id);
const uiDone = (k) => (isPlural(enUi[k]) ? isPlural(lang.ui[k]) && forms.every((f) => lang.ui[k][f]) : !!lang.ui[k]);

if (cmd === 'status') {
  const done = Object.keys(enUi).filter(uiDone).length;
  console.log(`ui        ${done}/${Object.keys(enUi).length}`);
  const files = [...new Set(units.map((u) => u.file))];
  for (const f of files) {
    const us = units.filter((u) => u.file === f);
    const n = us.filter((u) => translated(getAt(overlayOf(lang, f), u.path))).length;
    console.log(`${f.padEnd(10)}${n}/${us.length}`);
  }
} else if (cmd === 'todo') {
  const out = {};
  if (!only || only === 'ui') {
    for (const k of Object.keys(enUi)) if (!uiDone(k)) out[k] = isPlural(enUi[k]) ? Object.fromEntries(forms.map((f) => [f, enUi[k].other])) : enUi[k];
  }
  if (only !== 'ui') {
    for (const u of units) {
      if (only && u.file !== only) continue;
      if (translated(getAt(overlayOf(lang, u.file), u.path))) continue;
      setAt(only ? out : (out[u.file] ||= {}), u.path, u.en);
    }
  }
  console.log(JSON.stringify(out, null, 2));
} else if (cmd === 'snapshot') {
  const file = sourceFile(manifest, id);
  const src = {};
  for (const u of units) if (translated(getAt(overlayOf(lang, u.file), u.path))) src[unitId(u)] = u.en;
  await writeFile(new URL(file, root), JSON.stringify(src, null, 1) + '\n');
  console.log(`${file}: ${Object.keys(src).length} strings`);
} else {
  console.error(`unknown command "${cmd}"`);
  process.exit(2);
}
