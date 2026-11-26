// Detail panel: renders the current route as HTML. Clicks/hover are handled by delegation in main.js:
//   [data-nav]  → navigate,  [data-keys] → highlight on hover,  [data-expand] → expand a range chip.
import { parseKey, normalize } from './graph.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const KIND = { long: 'Long bone', short: 'Short bone', flat: 'Flat bone', irregular: 'Irregular bone', sesamoid: 'Sesamoid bone' };
const NERVE_KIND = { cranial: 'Cranial nerve', 'spinal-cord': 'Central nervous system', spinal: 'Spinal nerves', plexus: 'Nerve plexus', peripheral: 'Peripheral nerve' };
const CONNECTIVE_KIND = { ligament: 'Ligament (bone to bone)', tendon: 'Tendon (muscle to bone)', fascia: 'Fascia', cartilage: 'Fibrocartilage' };
const LYMPH_KIND = { node: 'Lymph node group', vessel: 'Lymph vessels', duct: 'Lymph duct', organ: 'Lymphoid organ' };
const CARRIES = { artery: 'Oxygen-rich blood away from the heart', vein: 'Oxygen-poor blood back to the heart' };
// read flow links upstream first: where it comes from, then where it goes
const UPSTREAM_FIRST = new Set(['pumps', 'continues', 'branches', 'drains']);
const URG = { 'self-care': 'Self-care', doctor: 'See a doctor', urgent: 'Urgent' };
const REGION_GROUPS = [
  ['Head & neck', ['head', 'face', 'neck']],
  ['Chest', ['chest-center', 'chest-right', 'chest-left']],
  ['Abdomen', ['upper-right-abdomen', 'upper-middle-abdomen', 'upper-left-abdomen', 'right-flank', 'around-navel', 'left-flank', 'lower-right-abdomen', 'lower-middle-abdomen', 'lower-left-abdomen']],
  ['Arms', ['shoulder', 'armpit', 'upper-arm', 'elbow', 'forearm', 'wrist-hand']],
  ['Legs', ['hip-groin', 'thigh', 'knee', 'back-of-knee', 'lower-leg', 'ankle-foot', 'heel']],
  ['Pelvis', ['genitals']],
  ['Back', ['upper-back', 'mid-back', 'lower-back', 'buttock']],
];
// a list item is a string or { text, sex } (functions, red flags)
const txt = (x) => (typeof x === 'string' ? x : x?.text ?? '');

export function createPanel(graph) {
  // with no biological sex chosen, sex-specific text is still shown, tagged "female" / "male"
  let tagSex = false;
  const sexTag = (x) => (tagSex && x && typeof x === 'object' && x.sex ? `<span class="sex-tag">${esc(x.sex)}</span>` : '');
  const sexHint = () => (tagSex ? '<div class="note-card">Reproductive organs appear once you choose a biological sex in settings (the cog, top right) or with <span class="kbd">S</span>.</div>' : '');
  const navFor = (k) => {
    const { id, side } = parseKey(k);
    return `s/${encodeURIComponent(id)}${side ? '/' + side : ''}`;
  };
  const keysAttr = (k) => {
    const { id, side } = parseKey(k);
    return graph.keysFor(id, side).join(' ');
  };

  function chip(k, ctx = {}) {
    const { id, side } = parseKey(k);
    const n = graph.node(id);
    if (!n) return '';
    const showSide = side && (!ctx.side || ctx.side !== side);
    const dot = n.type === 'joint' ? `<span class="jdot" data-c="${esc(n.class)}"></span>` : '';
    return `<button class="chip" data-nav="${navFor(k)}" data-keys="${keysAttr(k)}">${dot}${esc(n.name)}${showSide ? `<span class="side">${side}</span>` : ''}</button>`;
  }

  function rangeText(g, ords) {
    const runs = [];
    for (const o of ords) {
      const last = runs[runs.length - 1];
      if (last && o === last[1] + 1) last[1] = o;
      else runs.push([o, o]);
    }
    const p = g.rangePrefix || '';
    const r = runs.map(([a, b]) => (a === b ? `${p}${a}` : `${p}${a}–${p}${b}`)).join(', ');
    return (g.rangeLabel || '{r}').replace('{r}', r);
  }

  // A list of chips; runs of ≥3 numbered siblings (ribs, vertebrae) collapse into one expandable chip.
  function chips(keys, ctx = {}) {
    const uniq = [...new Set(keys)].filter((k) => graph.node(parseKey(k).id));
    if (!uniq.length) return '';
    const buckets = new Map();
    const out = [];
    for (const k of uniq) {
      const { id, side } = parseKey(k);
      const n = graph.node(id);
      const g = graph.group(n.group);
      if (n.ordinal && g?.rangeLabel) {
        const b = `${g.id}|${side || ''}`;
        if (!buckets.has(b)) { buckets.set(b, { g, side, items: [] }); out.push({ bucket: b }); }
        buckets.get(b).items.push({ k, n });
      } else out.push({ k });
    }
    const html = out.map((o) => {
      if (o.k) return chip(o.k, ctx);
      const { g, side, items } = buckets.get(o.bucket);
      if (items.length < 3) return items.map((i) => chip(i.k, ctx)).join('');
      items.sort((a, b) => a.n.ordinal - b.n.ordinal);
      const showSide = side && (!ctx.side || ctx.side !== side);
      const all = items.map((i) => keysAttr(i.k)).join(' ');
      return `<span class="chipset"><button class="chip chip-range" data-expand aria-expanded="false" data-keys="${all}" title="Show each">${esc(rangeText(g, items.map((i) => i.n.ordinal)))}${showSide ? `<span class="side">${side}</span>` : ''}</button><span class="chips-more" hidden>${items.map((i) => chip(i.k, ctx)).join('')}</span></span>`;
    }).join('');
    return `<div class="chips">${html}</div>`;
  }

  const section = (title, body, extra = '') => (body ? `<section class="section"><h3>${title}${extra}</h3>${body}</section>` : '');
  const facts = (list) => `<div class="facts">${list.filter((f) => f[1]).map(([k, v]) => `<div class="fact"><b>${esc(k)}</b>${esc(v)}</div>`).join('')}</div>`;
  const issuesList = (issues) => `<ul class="issues">${issues.map((i) => `<li><strong>${esc(i.name)}${sexTag(i)}</strong><span>${esc(i.note)}</span></li>`).join('')}</ul>`;
  const disclaimer = () => `<p class="disclaimer">${esc(graph.regionsData.disclaimer || 'Educational only, not medical advice.')} ${esc(graph.regionsData.emergency || '')}</p>`;
  const flagsCard = (title, list, emergency = true) => `<div class="flags"><h4>${esc(title)}</h4><ul>${list.map((f) => `<li>${esc(txt(f))}${sexTag(f)}</li>`).join('')}</ul>${emergency ? `<p class="emergency">${esc(graph.regionsData.emergency || '')}</p>` : ''}</div>`;

  function firstAka(n) {
    const members = new Set((n.members || []).map((m) => normalize(m.name)));
    const nm = normalize(n.name);
    return (n.aka || []).find((a) => {
      const x = normalize(a);
      return !members.has(x) && !x.startsWith(nm) && !nm.startsWith(x);
    });
  }

  function lift(keys, ctx, selfId) {
    if (!ctx.typeLevel) return keys;
    return [...new Set(keys.map((k) => parseKey(k).id))].filter((id) => id !== selfId);
  }

  function linksSection(n, keys, ctx, st) {
    const byType = new Map();
    for (const k of keys) {
      for (const e of graph.edges(k)) {
        if (e.type === 'articulates') continue;
        const t = `${e.type}|${e.dir}`;
        if (!byType.has(t)) byType.set(t, { type: e.type, dir: e.dir, keys: [], byNote: new Map() });
        const b = byType.get(t);
        b.keys.push(e.to);
        const nk = e.note || '';
        if (!b.byNote.has(nk)) b.byNote.set(nk, []);
        b.byNote.get(nk).push(e.to);
      }
    }
    // a structure field with a note but no links (e.g. the diaphragm inserts into its own tendon)
    for (const [type, lt] of Object.entries(graph.linkTypes)) {
      if (lt.field && n[lt.field + 'Note'] && !byType.has(`${type}|out`) && Array.isArray(n[lt.field])) byType.set(`${type}|out`, { type, dir: 'out', keys: [], byNote: new Map() });
    }
    if (!byType.size) return '';
    const order = ['stabilises', 'attaches', 'origin', 'insertion', 'protects', 'pumps', 'continues', 'branches', 'drains', 'regulates', 'collects', 'innervates', 'supplies', 'attached', 'contains'];
    const rank = (t) => (order.includes(t) ? order.indexOf(t) : order.length);
    const dirRank = (b) => ((b.dir === 'out') !== UPSTREAM_FIRST.has(b.type) ? 0 : 1);
    const items = [...byType.values()].sort((a, b) => rank(a.type) - rank(b.type) || dirRank(a) - dirRank(b));
    return items.map((b) => {
      const lt = graph.linkTypes[b.type] || {};
      const label = b.dir === 'in' ? lt.reverse : lt.forward;
      // one shared note goes in the title; different notes (urine vs blood from the kidney) each label their own chips
      const groups = [...b.byNote.entries()].sort((x, y) => (x[0] ? 1 : 0) - (y[0] ? 1 : 0));
      const shared = groups.length === 1 ? groups[0][0] : '';
      const note = shared ? `<span class="lnote"> · ${esc(shared)}</span>` : '';
      const list = groups.length > 1
        ? groups.map(([nt, ks]) => `<div class="lgroup">${nt ? `<p class="section-note">${esc(cap(nt))}</p>` : ''}${chips(lift(ks, ctx, n.id), ctx)}</div>`).join('')
        : chips(lift(b.keys, ctx, n.id), ctx);
      const where = b.dir === 'out' && lt.field && n[lt.field + 'Note'] ? `<p class="section-note">${esc(n[lt.field + 'Note'])}</p>` : '';
      const count = b.dir === 'in' && b.keys.length > 2 ? ` <span class="n">${new Set(lift(b.keys, ctx, n.id)).size}</span>` : '';
      // offer to reveal targets that live on a hidden layer
      const hidden = [...new Set(b.keys.map((k) => graph.node(parseKey(k).id)).filter((t) => t && !t.listOnly).map((t) => t.layer))].filter((l) => st?.visible && !st.visible.has(l));
      const reveal = hidden.map((l) => `<button class="show-layer" data-layer-on="${esc(l)}">Show ${esc((graph.layer(l)?.name || l).toLowerCase())} on the map</button>`).join('');
      return section(esc(label || b.type), where + list + reveal, note + count);
    }).join('');
  }

  function connectsSection(n, keys, ctx) {
    const rows = new Map(); // joint (instance or type) -> Set(targets)
    for (const k of keys) {
      for (const jk of graph.jointsOf(k)) {
        const rowKey = ctx.typeLevel ? parseKey(jk).id : jk;
        if (!rows.has(rowKey)) rows.set(rowKey, new Set());
        const set = rows.get(rowKey);
        for (const e of graph.edges(k)) if (e.type === 'articulates' && e.via === jk) set.add(e.to);
      }
    }
    if (!rows.size) return '';
    const html = [...rows.entries()].map(([jk, targets]) => {
      const jn = graph.node(parseKey(jk).id);
      const t = lift([...targets], ctx, n.id);
      return `<li><div class="jhead"><button class="jlink" data-nav="${navFor(jk)}" data-keys="${keysAttr(jk)}"><span class="jdot" data-c="${esc(jn.class)}"></span>${esc(jn.name)}</button><span class="jtype">${esc(cap(jn.class))} · ${esc(jn.subtype)}</span></div>${t.length ? chips(t, ctx) : '<span class="jtype">Joints between the bones of this group</span>'}</li>`;
    }).join('');
    return section('Connects to', `<ul class="conn">${html}</ul>`, ` <span class="n">${rows.size} joint${rows.size > 1 ? 's' : ''}</span>`);
  }

  function eyebrow(parts) {
    return `<p class="eyebrow">${parts.filter(Boolean).join(' · ')}</p>`;
  }

  // flip: the figure is shown flipped (Mirror on, or the back view); back: seen from behind
  function sideSwitch(n, side, { flip, back }) {
    const btn = (s) => `<button data-nav="s/${encodeURIComponent(n.id)}${s ? '/' + s : ''}" aria-pressed="${(s || null) === (side || null)}">${s ? cap(s) : 'Both'}</button>`;
    const where = side ? ((side === 'right') !== !!flip ? 'left' : 'right') : null;
    const note = side ? `<p class="side-note">The body’s ${side} side, on the ${where} of the figure${back ? ' seen from behind' : flip ? ' in mirror view' : ''}.</p>` : '';
    return `<div class="side-switch"><div class="seg" role="group" aria-label="Side">${btn('right')}${btn('left')}${btn(null)}</div>${note}</div>`;
  }

  function nodeView(route, st) {
    const n = graph.node(route.id);
    if (!n) return notFound();
    const L = graph.layer(n.layer);
    const side = n.paired ? route.side : null;
    const ctx = { side, typeLevel: n.paired && !side };
    const keys = graph.keysFor(n.id, side);

    const crumbs = [esc(L?.name)];
    if (n.type === 'joint') crumbs.push('Joint');
    else for (const g of graph.ancestry(n.group).slice(-2)) crumbs.push(`<button data-nav="g/${encodeURIComponent(g.id)}">${esc(g.name)}</button>`);

    const aka = firstAka(n);
    let h = '';
    if (st.fromRegion) {
      const r = graph.regions.get(st.fromRegion.id);
      if (r) h += `<button class="crumb" data-back>← Back to ${esc(r.name)}</button>`;
    }
    h += eyebrow(crumbs);
    h += `<h2 class="title">${esc(n.name)}</h2>`;
    h += `<div class="subline">${n.latin && n.latin !== n.name ? `<span class="latin">${esc(n.latin)}</span>` : ''}${aka ? `<span class="aka">also: ${esc(aka)}</span>` : ''}</div>`;
    if (n.paired) h += sideSwitch(n, side, { flip: st.view === 'posterior' || st.mirror, back: st.view === 'posterior' });

    const f = [];
    if (n.type === 'bone') {
      f.push(['Type', KIND[n.kind] || cap(n.kind)]);
      f.push(['Count', n.paired ? `${n.count} · ${n.count / 2} per side` : String(n.count)]);
      if (n.ribType) f.push(['Rib type', `${cap(n.ribType)} rib`]);
    } else if (n.type === 'joint') {
      f.push(['Class', cap(n.class)]);
      f.push(['Type', n.subtype]);
    } else if (n.type === 'muscle') {
      f.push(['Type', n.members?.length ? `Group of ${n.members.length} muscles` : 'Skeletal muscle']);
      if (n.nerve) f.push(['Nerve supply', n.nerve]);
    } else if (n.type === 'nerve') {
      f.push(['Type', NERVE_KIND[n.kind] || cap(n.kind)]);
      if (n.roots) f.push(['Roots', n.roots]);
      if (n.carries) f.push(['Carries', n.carries]);
    } else if (n.type === 'connective') {
      f.push(['Type', CONNECTIVE_KIND[n.kind] || cap(n.kind)]);
      if (n.paired) f.push(['Count', 'One on each side']);
    } else if (n.type === 'lymph') {
      f.push(['Type', LYMPH_KIND[n.kind] || cap(n.kind)]);
      if (n.kind !== 'organ') f.push(['Carries', 'Lymph, back toward the blood']);
    } else if (n.type === 'vessel') {
      f.push(['Type', cap(n.kind)]);
      f.push(['Carries', n.carries || CARRIES[n.kind]]);
      if (n.pulse) f.push(['Pulse', n.pulse]);
    } else {
      f.push(['System', graph.group(n.group)?.name]);
      if (n.paired) f.push(['Count', n.countLabel || 'One on each side']);
    }
    h += facts(f);
    if (n.location) h += `<p class="summary" style="color:var(--ink-2);font-size:14px;margin-bottom:10px">${esc(n.location)}</p>`;
    h += `<p class="summary">${esc(n.summary)}</p>`;
    if (n.sideNotes) {
      const notes = side ? [n.sideNotes[side]] : Object.values(n.sideNotes);
      h += `<div class="note-card">${notes.map(esc).join('<br>')}</div>`;
    }
    if (n.sexNotes?.length) h += `<div class="note-card">${n.sexNotes.map((x) => `${esc(x.text)}${sexTag(x)}`).join('<br>')}</div>`;
    if (n.noJoints) h += `<div class="note-card">${esc(n.noJoints)}</div>`;
    if (n.listOnly) h += `<div class="note-card">${typeof n.listOnly === 'string' ? esc(n.listOnly) : 'Not drawn on the map yet: it lies deep inside, under other structures.'} You can still reach it through search, the browse list and its connections.</div>`;

    if (n.type === 'joint') {
      const members = lift(keys.flatMap((k) => graph.membersOfJoint(k)), ctx, null);
      h += section('Bones in this joint', chips(members, ctx));
      if (n.movements?.length) h += section('Movements', `<div class="movements">${n.movements.map((m) => `<span>${esc(m)}</span>`).join('')}</div>`);
    } else {
      h += connectsSection(n, keys, ctx);
    }
    h += linksSection(n, keys, ctx, st);
    const does = n.functions || n.actions;
    if (does?.length) h += section('What it does', `<ul class="issues">${does.map((x) => `<li><span>${esc(txt(x))}${sexTag(x)}</span></li>`).join('')}</ul>`);
    if (n.members?.length) {
      const focus = route.member ? normalize(route.member) : null;
      h += section(esc(n.membersLabel || 'Includes'), `<ul class="members">${n.members.map((m) => `<li class="${focus && normalize(m.name) === focus ? 'focus' : ''}"><div><span class="mn">${esc(m.name)}${sexTag(m)}</span>${m.latin && m.latin !== m.name ? `<span class="ml">${esc(m.latin)}</span>` : ''}</div>${m.note ? `<div class="mt">${esc(m.note)}</div>` : ''}</li>`).join('')}</ul>`, ` <span class="n">${n.members.length}</span>`);
    }
    if (n.issues?.length) h += section('Common issues', issuesList(n.issues));
    else {
      const inh = graph.inheritedIssues(n);
      if (inh) h += section('Common issues', issuesList(inh.issues), ` <span class="issues-from">· ${esc(inh.group.name)}</span>`);
    }
    h += disclaimer();
    return h;
  }

  function groupView(route) {
    const g = graph.group(route.id);
    if (!g) return notFound();
    const L = graph.layer(g.layer);
    const anc = graph.ancestry(g.id).slice(0, -1);
    let h = eyebrow([esc(L?.name), ...anc.slice(-2).map((a) => `<button data-nav="g/${encodeURIComponent(a.id)}">${esc(a.name)}</button>`), 'Group']);
    h += `<h2 class="title">${esc(g.name)}</h2>`;
    const ids = graph.groupIds(g.id);
    const count = graph.groupCount(g.id);
    h += facts([[L?.id === 'skeleton' ? 'Bones' : 'Structures', String(L?.id === 'skeleton' ? count : ids.length)], ['Entries', String(ids.length)]]);
    if (g.summary) h += `<p class="summary">${esc(g.summary)}</p>`;
    if (g.children.length) {
      h += section('Sub-groups', `<div class="chips">${g.children.map((c) => `<button class="chip" data-nav="g/${encodeURIComponent(c)}" data-keys="${graph.groupKeys(c).join(' ')}">${esc(graph.group(c).name)}</button>`).join('')}</div>`);
    }
    if (g.members.length) h += section('In this group', chips(g.members, { typeLevel: true }), ` <span class="n">${g.members.length}</span>`);
    if (g.issues?.length) h += section('Common issues', issuesList(g.issues));
    h += disclaimer();
    return h;
  }

  function regionView(route, st) {
    const r = graph.regions.get(route.id);
    if (!r) return notFound();
    const side = r.paired ? route.side : null;
    const ctxSide = r.paired ? side : r.side || null;
    let h = `<button class="crumb" data-nav="hurt">← All areas</button>`;
    h += eyebrow(['Where does it hurt?', r.view === 'back' ? 'Back' : null, side ? `${cap(side)} side` : null]);
    h += `<h2 class="title">${esc(r.name)}${side ? ` <span class="latin" style="font-size:18px">(${side})</span>` : ''}</h2>`;
    if (st.probe && st.probe.rkey === (side ? `${r.id}:${side}` : r.id) && st.probe.keys.length) {
      h += section('Under this spot', `<p class="section-note">Everything beneath where you tapped, in every layer.</p>${chips(st.probe.keys, { side: ctxSide })}`);
    }
    h += section('In this area', chips(graph.regionStructures(r, side), { side: ctxSide }));
    h += section('Common causes of pain here', `<div class="causes">${r.causes.map((c) => {
      const rel = c.related?.length ? chips(graph.regionStructures({ structures: c.related, paired: r.paired, side: r.side }, side), { side: ctxSide }) : '';
      return `<article class="cause"><div class="cause-head"><span class="cause-title">${esc(c.title)}${sexTag(c)}</span><span class="urg" data-u="${esc(c.urgency)}">${esc(URG[c.urgency] || c.urgency)}</span></div><p>${esc(c.signs)}</p>${rel}</article>`;
    }).join('')}</div>`);
    if (r.redFlags?.length) h += section('Get help urgently if', flagsCard('Warning signs for this area', r.redFlags));
    h += section('General warning signs', flagsCard('Call for help straight away with', graph.regionsData.redFlags || [], false));
    h += disclaimer();
    return h;
  }

  function hurtHome(st) {
    let h = eyebrow(['Where does it hurt?']);
    h += `<h2 class="title">Tap where it hurts</h2>`;
    h += `<p class="summary">Pick the area on the figure, or from the list below. Each area lists what lies there, the common causes of pain and when to get help.</p>`;
    h += st.view === 'posterior'
      ? `<div class="note-card">You’re looking at the figure from behind, so its right side is on your right, like your own body. Switch to <b>Front</b> (in settings, or <span class="kbd">B</span>) for the chest, belly and face.</div>`
      : `<div class="note-card">The figure faces you, so its right side is on your left. ${st.mirror ? 'Mirror is on: the figure now matches your own body like a mirror.' : 'Turn on <b>Mirror</b> in settings to match it to your own body.'} Switch to <b>Back</b> (in settings, or <span class="kbd">B</span>) for the back and buttocks.</div>`;
    h += sexHint();
    h += section('How urgent', `<div class="legend-urg">${Object.entries(URG).map(([k, v]) => `<span class="urg" data-u="${k}">${v}</span>`).join('')}</div>`);
    const lists = REGION_GROUPS.map(([name, ids]) => {
      const items = ids.map((id) => graph.regions.get(id)).filter(Boolean);
      if (!items.length) return '';
      return `<div><h4>${esc(name)}</h4><div class="chips">${items.map((r) => `<button class="chip" data-nav="r/${encodeURIComponent(r.id)}" data-rkeys="${graph.regionKeys(r.id).join(' ')}">${esc(r.name)}</button>`).join('')}</div></div>`;
    }).join('');
    h += section('All areas', `<div class="region-list">${lists}</div>`);
    h += section('Call for help straight away with', flagsCard('Emergency warning signs', graph.regionsData.redFlags || []));
    h += disclaimer();
    return h;
  }

  function home() {
    const bones = [...graph.nodes.values()].filter((n) => n.type === 'bone').reduce((s, n) => s + (n.count || 0), 0);
    const joints = [...graph.nodes.values()].filter((n) => n.type === 'joint').length;
    const organs = [...graph.nodes.values()].filter((n) => n.type === 'organ').length;
    const count = (type) => [...graph.nodes.values()].filter((n) => n.type === type).length;
    const muscles = count('muscle'), nerves = count('nerve'), vessels = count('vessel'), lymph = count('lymph'), connective = count('connective');
    const stat = (v, label) => (v ? `<div class="stat"><b>${v}</b><span>${label}</span></div>` : '');
    let edges = 0;
    for (const list of graph.adj.values()) edges += list.length;
    let h = eyebrow(['A connected map of the body']);
    h += `<p class="home-lede">The human body as one system. Tap any bone, joint, ligament, tendon, muscle, organ, nerve, blood vessel or lymph node to see what it is, what it connects to and what commonly goes wrong.</p>`;
    h += `<p class="home-note" role="note"><b>Not a diagnostic tool.</b> ${esc(graph.regionsData.disclaimer || 'Educational only, not medical advice.')} ${esc(graph.regionsData.emergency || '')}</p>`;
    h += sexHint();
    h += `<div class="stats"><div class="stat"><b>${bones}</b><span>bones</span></div><div class="stat"><b>${joints}</b><span>joints</span></div>${stat(muscles, 'muscles')}<div class="stat"><b>${organs}</b><span>organs</span></div>${stat(nerves, 'nerves')}${stat(vessels, 'vessels')}${stat(lymph, 'lymphatics')}${stat(connective, 'ligaments & tendons')}<div class="stat"><b>${Math.round(edges / 2)}</b><span>connections</span></div></div>`;
    h += section('How to use it', `<ul class="howto">
      <li><span class="k">i</span><span><b>Tap</b> a structure. It turns red, everything it connects to turns teal, and the joints between them pulse.</span></li>
      <li><span class="k">ii</span><span><b>Layers</b> (top left): switch on Ligaments, Muscles, Organs, Vessels, Lymphatics or Nerves. The layer you touched last is in focus, and the others stay faintly visible behind it.</span></li>
      <li><span class="k">iii</span><span><b>Search</b> <span class="kbd">/</span> for any bone, muscle, organ, nerve, blood vessel, body area or condition (try “tennis elbow”), or open <b>Browse</b> for the full list.</span></li>
      <li><span class="k">iv</span><span><b>Where does it hurt?</b> Tap a body area to see what lies there, the likely causes, and when to get help.</span></li>
      <li><span class="k">v</span><span><b>Settings</b> (the cog, top right) turn the figure around (<b>Front / Back</b>, or <span class="kbd">B</span>), switch between simple and realistic <b>drawings</b> (<span class="kbd">D</span>), set the <b>biological sex</b>, which adds the reproductive organs and the conditions that only affect one sex (<span class="kbd">S</span>), and turn on <b>Mirror</b> to match the figure to your own body.</span></li>
      <li><span class="k">vi</span><span><b>Zoom</b> with the scroll wheel, a pinch or the + / − buttons, and drag to pan. Small bones are easier to tap when zoomed in.</span></li>
    </ul>`);
    h += section('Legend', `<div class="legend">
      <div><span class="sq sel"></span>Selected</div>
      <div><span class="sq rel"></span>Connected to the selection</div>
      <div><span class="ln artery"></span>Artery</div>
      <div><span class="ln vein"></span>Vein</div>
      <div><span class="ln nerve"></span>Nerve</div>
      <div><span class="ln ligament"></span>Ligament or tendon</div>
      <div><span class="ln lymph"></span><span class="nd"></span>Lymph vessel and nodes</div>
      <div><span class="jdot" data-c="synovial"></span>Synovial joint (freely moving)</div>
      <div><span class="jdot" data-c="cartilaginous"></span>Cartilaginous joint (slightly moving)</div>
      <div><span class="jdot" data-c="fibrous"></span>Fibrous joint (fixed)</div>
    </div>`);
    h += `<p class="disclaimer">The figure stands in the anatomical position (palms forward). From the front the body’s right is on your left; from the back it is on your right.</p>`;
    return h;
  }

  const notFound = () => `<p class="eyebrow">Not found</p><h2 class="title">Nothing here</h2><p class="summary">That link doesn’t match anything on the map. <button class="chip" data-nav="">Back to start</button></p>`;

  return {
    render(st) {
      tagSex = !st.sex || st.sex === 'none';
      const r = st.route;
      let body;
      if (r.view === 'node') body = nodeView(r, st);
      else if (r.view === 'group') body = groupView(r, st);
      else if (r.view === 'region') body = regionView(r, st);
      else if (r.view === 'hurt') body = hurtHome(st);
      else body = home(st);
      return `<div class="panel-inner">${body}</div>`;
    },
    title(st) {
      const r = st.route;
      if (r.view === 'node') return graph.node(r.id)?.name;
      if (r.view === 'group') return graph.group(r.id)?.name;
      if (r.view === 'region') return graph.regions.get(r.id)?.name;
      if (r.view === 'hurt') return 'Where does it hurt?';
      return null;
    },
  };
}
