// The body as one graph: every structure (bone, joint, organ…) is a node; joints and links are edges.
// Paired structures exist as two instances keyed "id:right" / "id:left"; midline ones are keyed by id.

export const SIDES = ['right', 'left'];

export function parseKey(key) {
  const i = key.indexOf(':');
  return i < 0 ? { id: key, side: null } : { id: key.slice(0, i), side: key.slice(i + 1) };
}

export const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .toLowerCase();

export class Graph {
  constructor({ layers, links = [], linkTypes = {}, regions = { regions: [] } }) {
    this.layers = layers;
    this.linkTypes = linkTypes;
    this.nodes = new Map();
    this.groups = new Map();
    this.adj = new Map();
    this.jointMembers = new Map(); // joint key -> Set(bone keys)
    this.memberJoints = new Map(); // bone key -> Set(joint keys)
    this.problems = [];

    for (const L of layers) this.#addLayer(L);
    for (const g of this.groups.values()) if (g.parent) this.groups.get(g.parent)?.children.push(g.id);
    for (const n of this.nodes.values()) if (n.group && n.type !== 'joint') this.groups.get(n.group)?.members.push(n.id);
    for (const L of layers) for (const j of L.data.joints || []) this.#addJoint(j);
    for (const l of links) this.#addLink(l);

    this.regionsData = regions;
    this.regions = new Map((regions.regions || []).map((r) => [r.id, r]));
    this.searchIndex = this.#buildSearch();
  }

  // ------------------------------------------------------------ building
  #addLayer(L) {
    const d = L.data || {};
    for (const g of d.groups || []) this.groups.set(g.id, { ...g, layer: L.id, children: [], members: [] });
    for (const s of d.structures || []) {
      if (this.nodes.has(s.id)) this.problems.push(`Duplicate id "${s.id}"`);
      this.nodes.set(s.id, { ...s, layer: L.id, type: s.kind === 'organ' ? 'organ' : 'bone' });
    }
    for (const j of d.joints || []) {
      if (this.nodes.has(j.id)) this.problems.push(`Duplicate id "${j.id}"`);
      this.nodes.set(j.id, { ...j, layer: L.id, type: 'joint' });
    }
  }

  #ref(r) {
    const { id, side } = parseKey(r);
    if (!this.nodes.has(id)) this.problems.push(`Unknown reference "${r}"`);
    return { id, side };
  }

  // "@group" → ids in the group subtree; anything else is passed through
  expandRefs(refs) {
    const out = [];
    for (const r of refs || []) {
      if (r.startsWith('@')) {
        const g = r.slice(1);
        if (!this.groups.has(g)) this.problems.push(`Unknown group "${r}"`);
        out.push(...this.groupIds(g));
      } else out.push(r);
    }
    return out;
  }

  k(id, side) {
    const n = this.nodes.get(id);
    if (!n) return id;
    return n.paired ? `${id}:${side || 'right'}` : id;
  }

  // Side rules: explicit side wins; within a sided context use that side;
  // two paired ends link same side to same side; a midline end links to both sides.
  resolvePair(a, b, S = null) {
    const A = this.#ref(a), B = this.#ref(b);
    const na = this.nodes.get(A.id), nb = this.nodes.get(B.id);
    if (!na || !nb) return [];
    const pa = !A.side && na.paired, pb = !B.side && nb.paired;
    const ka = (s) => this.k(A.id, A.side || s), kb = (s) => this.k(B.id, B.side || s);
    if (S) return [[ka(S), kb(S)]];
    if (pa && pb) return SIDES.map((s) => [ka(s), kb(s)]);
    if (pa) return SIDES.map((s) => [ka(s), kb(null)]);
    if (pb) return SIDES.map((s) => [ka(null), kb(s)]);
    return [[ka(null), kb(null)]];
  }

  #edge(a, b, type, extra = {}) {
    if (a === b) return;
    if (!this.adj.has(a)) this.adj.set(a, []);
    if (!this.adj.has(b)) this.adj.set(b, []);
    const sym = type === 'articulates';
    this.adj.get(a).push({ type, dir: sym ? 'both' : 'out', to: b, ...extra });
    this.adj.get(b).push({ type, dir: sym ? 'both' : 'in', to: a, ...extra });
  }

  #member(jk, bk) {
    if (!this.jointMembers.has(jk)) this.jointMembers.set(jk, new Set());
    if (!this.memberJoints.has(bk)) this.memberJoints.set(bk, new Set());
    this.jointMembers.get(jk).add(bk);
    this.memberJoints.get(bk).add(jk);
  }

  #addJoint(j) {
    const sides = j.paired ? SIDES : [null];
    for (const S of sides) {
      const jk = this.k(j.id, S);
      let pairs = [];
      if (j.pairs) pairs = j.pairs;
      else if (j.chain) pairs = j.chain.slice(1).map((b, i) => [j.chain[i], b]);
      else if (j.bones?.length === 1) {
        const b = this.#ref(j.bones[0]);
        const bn = this.nodes.get(b.id);
        if (!bn) continue;
        if (!j.paired && bn.paired && !b.side) pairs = [[`${b.id}:right`, `${b.id}:left`]];
        else { this.#member(jk, this.k(b.id, b.side || S)); continue; } // joint inside a grouped bone
      } else if (j.bones) {
        for (let x = 0; x < j.bones.length; x++) for (let y = x + 1; y < j.bones.length; y++) pairs.push([j.bones[x], j.bones[y]]);
      }
      for (const [a, b] of pairs) {
        for (const [ka, kb] of this.resolvePair(a, b, S)) {
          this.#edge(ka, kb, 'articulates', { via: jk });
          this.#member(jk, ka);
          this.#member(jk, kb);
        }
      }
    }
  }

  #addLink(l) {
    if (!this.linkTypes[l.type]) this.problems.push(`Unknown link type "${l.type}"`);
    const from = this.expandRefs(l.from), to = this.expandRefs(l.to);
    for (const a of from) for (const b of to) {
      for (const [ka, kb] of this.resolvePair(a, b, null)) {
        if (l.side) {
          const sa = parseKey(ka).side, sb = parseKey(kb).side;
          if ((sa && sa !== l.side) || (sb && sb !== l.side)) continue;
        }
        this.#edge(ka, kb, l.type, l.note ? { note: l.note } : {});
      }
    }
  }

  // ------------------------------------------------------------ queries
  node(id) { return this.nodes.get(id); }
  group(id) { return this.groups.get(id); }
  layer(id) { return this.layers.find((l) => l.id === id); }

  instances(id) {
    const n = this.nodes.get(id);
    if (!n) return [];
    return n.paired ? SIDES.map((s) => `${id}:${s}`) : [id];
  }
  keysFor(id, side) {
    const n = this.nodes.get(id);
    if (!n) return [];
    if (n.paired) return side ? [`${id}:${side}`] : this.instances(id);
    return [id];
  }
  edges(key) { return this.adj.get(key) || []; }
  jointsOf(key) { return [...(this.memberJoints.get(key) || [])]; }
  membersOfJoint(key) { return [...(this.jointMembers.get(key) || [])]; }

  groupIds(gid) {
    const g = this.groups.get(gid);
    if (!g) return [];
    return [...g.members, ...g.children.flatMap((c) => this.groupIds(c))];
  }
  groupKeys(gid) { return this.groupIds(gid).flatMap((id) => this.instances(id)); }
  groupCount(gid) { return this.groupIds(gid).reduce((s, id) => s + (this.nodes.get(id)?.count || 0), 0); }
  ancestry(gid) {
    const out = [];
    let g = this.groups.get(gid);
    while (g) { out.unshift(g); g = g.parent ? this.groups.get(g.parent) : null; }
    return out;
  }
  // nearest group (walking up) that has issues
  inheritedIssues(n) {
    let g = n.group ? this.groups.get(n.group) : null;
    while (g) {
      if (g.issues?.length) return { group: g, issues: g.issues };
      g = g.parent ? this.groups.get(g.parent) : null;
    }
    return null;
  }

  regionKeys(id, side) {
    const r = this.regions.get(id);
    if (!r) return [];
    if (r.paired) return side ? [`${id}:${side}`] : SIDES.map((s) => `${id}:${s}`);
    return [id];
  }
  // structures listed for a region, resolved to instance keys
  regionStructures(r, side) {
    const s = r.paired ? side : r.side || null;
    const out = [];
    for (const ref of this.expandRefs(r.structures)) {
      const { id, side: explicit } = parseKey(ref);
      const n = this.nodes.get(id);
      if (!n) continue;
      if (!n.paired) out.push(id);
      else if (explicit || s) out.push(`${id}:${explicit || s}`);
      else out.push(...this.instances(id));
    }
    return [...new Set(out)];
  }

  // ------------------------------------------------------------ search
  #buildSearch() {
    const idx = [];
    for (const n of this.nodes.values()) {
      const layerName = this.layer(n.layer)?.name || n.layer;
      const where = n.type === 'joint' ? 'Joint' : this.groups.get(n.group)?.name || layerName;
      const terms = [[n.name, 1], [n.latin, 0.95], ...(n.aka || []).map((a) => [a, 0.85])];
      idx.push({ kind: 'node', id: n.id, label: n.name, meta: where, terms, weight: 3 });
      for (const m of n.members || []) {
        idx.push({ kind: 'member', id: n.id, member: m.name, label: m.name, meta: `in ${n.name}`, terms: [[m.name, 1], [m.latin, 0.95]], weight: 2 });
      }
    }
    for (const g of this.groups.values()) idx.push({ kind: 'group', id: g.id, label: g.name, meta: 'Group', terms: [[g.name, 1]], weight: 1 });
    for (const r of this.regions.values()) idx.push({ kind: 'region', id: r.id, label: r.name, meta: 'Where does it hurt?', terms: [[r.name, 1]], weight: -8 });
    for (const e of idx) e.norm = e.terms.filter(([t]) => t).map(([t, f]) => [normalize(t), f]);
    return idx;
  }

  search(q, limit = 12) {
    const words = normalize(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const scored = [];
    for (const e of this.searchIndex) {
      let total = 0;
      for (const w of words) {
        let best = 0;
        for (const [t, f] of e.norm) {
          let s = 0;
          if (t === w) s = 100;
          else if (t.startsWith(w)) s = 80;
          else if (t.split(/[\s\-(),/]+/).some((p) => p.startsWith(w))) s = 60;
          else if (t.includes(w)) s = 30;
          best = Math.max(best, s * f);
        }
        if (!best) { total = 0; break; }
        total += best;
      }
      if (total) scored.push({ e, score: total + e.weight * 2 - e.label.length * 0.05 });
    }
    scored.sort((a, b) => b.score - a.score);
    const seen = new Set();
    const out = [];
    for (const { e } of scored) {
      const sig = `${e.kind}|${e.id}|${e.member || ''}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(e);
      if (out.length >= limit) break;
    }
    return out;
  }
}
