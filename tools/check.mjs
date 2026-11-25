#!/usr/bin/env node
// Headless version of the ?debug data check: `node tools/check.mjs` from the repository root (Node 22+, no packages).
// Builds the same graph the app does and runs js/validate.js's check() on it. Exits 1 if anything is wrong.
import { readFile } from 'node:fs/promises';
import { Graph } from '../js/graph.js';
import { check } from '../js/validate.js';

const root = new URL('../', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const text = (p) => readFile(new URL(p, root), 'utf8');

// every element with a data-id, as map.js indexes it: "id" or "id:side"
const keysIn = (svg) => new Set([...svg.matchAll(/<[a-z]+\b[^>]*\bdata-id="([^"]+)"[^>]*>/g)].map((m) => {
  const side = /\bdata-side="([^"]+)"/.exec(m[0]);
  return side ? `${m[1]}:${side[1]}` : m[1];
}));

const manifest = await json('data/manifest.json');
const views = manifest.views?.length ? manifest.views : [{ id: 'anterior' }];
const svgMap = (spec) => (typeof spec === 'string' ? { [views[0].id]: spec } : spec || {});

const layers = await Promise.all(manifest.layers.map(async (l) => ({ ...l, data: await json(l.data) })));
const links = (await Promise.all((manifest.links || []).map(json))).flatMap((f) => f.links || []);
const regions = manifest.regions ? await json(manifest.regions.data) : { regions: [] };
const graph = new Graph({ layers, links, linkTypes: manifest.linkTypes, regions });

const drawn = new Map();
const regionShapes = new Map();
for (const v of views) {
  const keys = new Set();
  for (const l of manifest.layers) {
    const file = svgMap(l.svg)[v.id];
    if (file) for (const k of keysIn(await text(file))) keys.add(k);
  }
  drawn.set(v.id, keys);
  const rfile = manifest.regions && svgMap(manifest.regions.svg)[v.id];
  regionShapes.set(v.id, rfile ? keysIn(await text(rfile)) : new Set());
}

const { problems, summary } = check({ graph, drawn, regionShapes });
console.log(`[Corpus] data check: ${summary}`);
for (const p of problems) console.log(`  - ${p}`);
process.exit(problems.length ? 1 : 0);
