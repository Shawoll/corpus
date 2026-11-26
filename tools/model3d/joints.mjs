#!/usr/bin/env node
// Joint sites for the 3D model (drawing tool only; tools/model3d/build.py runs it).
// Prints { <joint key>: { class, sites: [[bone key, bone key] | [bone key]] } } as JSON, using js/graph.js's own side
// rules, so the 3D markers connect the same bones as the data: a pair is where two bones meet, a single bone is a
// joint inside a grouped bone (the intercarpal joints inside "carpals").
import { readFile } from 'node:fs/promises';
import { Graph } from '../../js/graph.js';
import { forSex } from '../../js/sex.js';

const root = new URL('../../', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const manifest = await json('data/manifest.json');
const layers = await Promise.all(manifest.layers.map(async (l) => ({ ...l, data: await json(l.data) })));
const links = (await Promise.all((manifest.links || []).map(json))).flatMap((f) => f.links || []);
const regions = manifest.regions ? await json(manifest.regions.data) : { regions: [] };
const graph = new Graph(forSex({ layers, links, linkTypes: manifest.linkTypes, regions }, 'none'));

const out = {};
for (const j of layers.find((l) => l.id === 'skeleton').data.joints) {
  for (const S of j.paired ? ['right', 'left'] : [null]) {
    const jk = graph.k(j.id, S);
    let pairs = j.pairs || (j.chain ? j.chain.slice(1).map((b, i) => [j.chain[i], b]) : null);
    const sites = [];
    if (pairs) for (const [a, b] of pairs) sites.push(...graph.resolvePair(a, b, S));
    else {
      // a joint given as a list of bones: where each two of them meet, or inside the one bone
      const m = graph.membersOfJoint(jk);
      if (m.length === 1) sites.push([m[0]]);
      else for (let i = 0; i < m.length; i++) for (let k = i + 1; k < m.length; k++) sites.push([m[i], m[k]]);
    }
    out[jk] = { class: j.class, sites };
  }
}
console.log(JSON.stringify(out));
