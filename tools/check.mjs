#!/usr/bin/env node
// Headless version of the ?debug data check: `node tools/check.mjs` from the repository root (Node 22+, no packages).
// Builds the same graphs the app does (one per biological sex setting) and runs js/validate.js's checkAll() on them.
// Exits 1 if anything is wrong.
import { readFile } from 'node:fs/promises';
import { checkAll, modelsFrom } from '../js/validate.js';

const root = new URL('../', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const text = (p) => readFile(new URL(p, root), 'utf8');

// every element with a data-id, as map.js indexes it: "id" or "id:side" -> Set(data-sex value, '' when untagged)
const taggedKeysIn = (svg) => {
  const out = new Map();
  for (const m of svg.matchAll(/<[a-z]+\b[^>]*\bdata-id="([^"]+)"[^>]*>/g)) {
    const side = /\bdata-side="([^"]+)"/.exec(m[0]);
    const sex = /\bdata-sex="([^"]+)"/.exec(m[0]);
    const k = side ? `${m[1]}:${side[1]}` : m[1];
    if (!out.has(k)) out.set(k, new Set());
    out.get(k).add(sex ? sex[1] : '');
  }
  return out;
};
const keysIn = (svg) => new Set(taggedKeysIn(svg).keys());

const manifest = await json('data/manifest.json');
// the 3D view ("model": true) has no drawings; its .glb files are checked through modelsFrom()
const views = (manifest.views?.length ? manifest.views : [{ id: 'anterior' }]).filter((v) => !v.model);
const svgMap = (spec) => (typeof spec === 'string' ? { [views[0].id]: spec } : spec || {});

const layers = await Promise.all(manifest.layers.map(async (l) => ({ ...l, data: await json(l.data) })));
const links = (await Promise.all((manifest.links || []).map(json))).flatMap((f) => f.links || []);
const regions = manifest.regions ? await json(manifest.regions.data) : { regions: [] };
const raw = { layers, links, linkTypes: manifest.linkTypes, regions };

const drawnTagged = new Map();
const regionShapes = new Map();
const variants = []; // a layer's drawing in another style (realistic…) next to its default drawing
for (const v of views) {
  const keys = new Map();
  const merge = (m) => { for (const [k, tags] of m) { if (!keys.has(k)) keys.set(k, new Set()); for (const t of tags) keys.get(k).add(t); } };
  for (const l of manifest.layers) {
    const file = svgMap(l.svg)[v.id];
    if (!file) continue;
    const baseTagged = taggedKeysIn(await text(file));
    const base = new Set(baseTagged.keys());
    merge(baseTagged);
    for (const [style, files] of Object.entries(l.styles || {})) {
      if (!files[v.id]) continue;
      const altTagged = taggedKeysIn(await text(files[v.id]));
      const alt = new Set(altTagged.keys());
      merge(altTagged);
      variants.push({ layer: l.id, view: v.id, style, keys: alt, base });
    }
  }
  drawnTagged.set(v.id, keys);
  const rfile = manifest.regions && svgMap(manifest.regions.svg)[v.id];
  regionShapes.set(v.id, rfile ? keysIn(await text(rfile)) : new Set());
}

const models = await modelsFrom(manifest, async (p, as) => (as === 'json' ? json(p) : readFile(new URL(p, root))));

const { problems, summary } = checkAll({ raw, drawnTagged, regionShapes, variants, models });
console.log(`[Corpus] data check: ${summary}`);
for (const p of problems) console.log(`  - ${p}`);
process.exit(problems.length ? 1 : 0);
