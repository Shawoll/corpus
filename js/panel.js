// Detail panel: renders the current route as HTML. Clicks/hover are handled by delegation in main.js:
//   [data-nav]  → navigate,  [data-keys] → highlight on hover,  [data-expand] → expand a range chip.
import { parseKey, normalize } from './graph.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
// read flow links upstream first: where it comes from, then where it goes
const UPSTREAM_FIRST = new Set(['pumps', 'continues', 'branches', 'drains']);
const URGENCIES = ['self-care', 'doctor', 'urgent'];
// the "Where does it hurt?" list: its groups (titles are regionGroup.<id> in locales/*/ui.json) and their areas in order
const REGION_GROUPS = [
  ['head-neck', ['head', 'face', 'eye', 'ear', 'jaw-teeth', 'throat', 'neck']],
  ['chest', ['chest-center', 'chest-right', 'chest-left']],
  ['abdomen', ['upper-right-abdomen', 'upper-middle-abdomen', 'upper-left-abdomen', 'right-flank', 'around-navel', 'left-flank', 'lower-right-abdomen', 'lower-middle-abdomen', 'lower-left-abdomen']],
  ['arms', ['shoulder', 'armpit', 'upper-arm', 'elbow', 'forearm', 'wrist', 'hand', 'fingers']],
  ['legs', ['hip-groin', 'thigh', 'back-of-thigh', 'knee', 'back-of-knee', 'lower-leg', 'calf', 'ankle', 'top-of-foot', 'toes', 'heel']],
  ['pelvis', ['genitals']],
  ['back', ['upper-back', 'mid-back', 'lower-back', 'tailbone', 'buttock']],
];
// a list item is a string or { text, sex } (functions, red flags)
const txt = (x) => (typeof x === 'string' ? x : x?.text ?? '');

// t: js/i18n.js's createT() for the current language
export function createPanel(graph, t) {
  // a label for an enum value (a bone's kind, a joint's class…) from ui.json, else the value itself
  const label = (key, v) => { const s = t(`${key}.${v}`); return s === `${key}.${v}` ? cap(v) : s; };
  // with no biological sex chosen, sex-specific text is still shown, tagged "female" / "male"
  let tagSex = false;
  const sexTag = (x) => (tagSex && x && typeof x === 'object' && x.sex ? `<span class="sex-tag">${esc(t(`sex.${x.sex}`))}</span>` : '');
  const sexHint = () => (tagSex ? `<div class="note-card">${t.html('panel.sexHintHtml')}</div>` : '');
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
    return `<button class="chip" data-nav="${navFor(k)}" data-keys="${keysAttr(k)}">${dot}${esc(n.name)}${showSide ? `<span class="side">${esc(t(`side.${side}`))}</span>` : ''}</button>`;
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
      return `<span class="chipset"><button class="chip chip-range" data-expand aria-expanded="false" data-keys="${all}" title="${t.html('panel.showEach')}">${esc(rangeText(g, items.map((i) => i.n.ordinal)))}${showSide ? `<span class="side">${esc(t(`side.${side}`))}</span>` : ''}</button><span class="chips-more" hidden>${items.map((i) => chip(i.k, ctx)).join('')}</span></span>`;
    }).join('');
    return `<div class="chips">${html}</div>`;
  }

  const section = (title, body, extra = '') => (body ? `<section class="section"><h3>${title}${extra}</h3>${body}</section>` : '');
  const facts = (list) => `<div class="facts">${list.filter((f) => f[1]).map(([k, v]) => `<div class="fact"><b>${esc(k)}</b>${esc(v)}</div>`).join('')}</div>`;
  const issuesList = (issues) => `<ul class="issues">${issues.map((i) => `<li><strong>${esc(i.name)}${sexTag(i)}</strong><span>${esc(i.note)}</span></li>`).join('')}</ul>`;
  const disclaimer = () => `<p class="disclaimer">${esc(graph.regionsData.disclaimer || t('panel.disclaimerFallback'))} ${esc(graph.regionsData.emergency || '')}</p>`;
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
        const bk = `${e.type}|${e.dir}`;
        if (!byType.has(bk)) byType.set(bk, { type: e.type, dir: e.dir, keys: [], byNote: new Map() });
        const b = byType.get(bk);
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
    const rank = (ty) => (order.includes(ty) ? order.indexOf(ty) : order.length);
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
      const hidden = [...new Set(b.keys.map((k) => graph.node(parseKey(k).id)).filter((x) => x && !x.listOnly).map((x) => x.layer))].filter((l) => st?.visible && !st.visible.has(l));
      const reveal = hidden.map((l) => `<button class="show-layer" data-layer-on="${esc(l)}">${t.html('panel.showLayer', { layer: (graph.layer(l)?.name || l).toLowerCase() })}</button>`).join('');
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
      const to = lift([...targets], ctx, n.id);
      return `<li><div class="jhead"><button class="jlink" data-nav="${navFor(jk)}" data-keys="${keysAttr(jk)}"><span class="jdot" data-c="${esc(jn.class)}"></span>${esc(jn.name)}</button><span class="jtype">${esc(label('joint.class', jn.class))} · ${esc(jn.subtype)}</span></div>${to.length ? chips(to, ctx) : `<span class="jtype">${t.html('panel.jointsInGroup')}</span>`}</li>`;
    }).join('');
    return section(t.html('panel.connectsTo'), `<ul class="conn">${html}</ul>`, ` <span class="n">${t.html('panel.jointCount', { n: rows.size })}</span>`);
  }

  function eyebrow(parts) {
    return `<p class="eyebrow">${parts.filter(Boolean).join(' · ')}</p>`;
  }

  // flip: the figure is shown flipped (Mirror on, or the back view); back: seen from behind
  // model: the 3D view, which turns, so there is no fixed left or right of the figure
  function sideSwitch(n, side, { flip, back, model }) {
    // a radio group (main.js moves through it with the arrow keys); the chosen side is its one Tab stop
    const btn = (s) => {
      const on = (s || null) === (side || null);
      return `<button type="button" role="radio" data-nav="s/${encodeURIComponent(n.id)}${s ? '/' + s : ''}" aria-checked="${on}" tabindex="${on ? 0 : -1}">${t.html(`panel.side.${s || 'both'}`)}</button>`;
    };
    const where = side ? ((side === 'right') !== !!flip ? 'left' : 'right') : null;
    const body = side ? t(`panel.sideBody.${side}`) : '';
    const note = !side ? '' : model ? `<p class="side-note">${t.html('panel.sideNoteModel', { body })}</p>`
      : `<p class="side-note">${t.html('panel.sideNote', { body, where: t(`panel.sideWhere.${where}`), context: back ? t('panel.seenFromBehind') : flip ? t('panel.inMirror') : '' })}</p>`;
    return `<div class="side-switch"><div class="seg" role="radiogroup" aria-label="${t.html('panel.side')}">${btn('right')}${btn('left')}${btn(null)}</div>${note}</div>`;
  }

  function nodeView(route, st) {
    const n = graph.node(route.id);
    if (!n) return notFound();
    const L = graph.layer(n.layer);
    const side = n.paired ? route.side : null;
    const ctx = { side, typeLevel: n.paired && !side };
    const keys = graph.keysFor(n.id, side);

    const crumbs = [esc(L?.name)];
    if (n.type === 'joint') crumbs.push(t.html('panel.joint'));
    else for (const g of graph.ancestry(n.group).slice(-2)) crumbs.push(`<button data-nav="g/${encodeURIComponent(g.id)}">${esc(g.name)}</button>`);

    const aka = firstAka(n);
    let h = '';
    if (st.fromRegion) {
      const r = graph.regions.get(st.fromRegion.id);
      if (r) h += `<button class="crumb" data-back>${t.html('panel.backTo', { name: r.name })}</button>`;
    }
    h += eyebrow(crumbs);
    h += `<h2 class="title">${esc(n.name)}</h2>`;
    h += `<div class="subline">${n.latin && n.latin !== n.name ? `<span class="latin">${esc(n.latin)}</span>` : ''}${aka ? `<span class="aka">${t.html('panel.aka', { aka })}</span>` : ''}</div>`;
    if (n.paired) h += sideSwitch(n, side, { flip: st.view === 'posterior' || st.mirror, back: st.view === 'posterior', model: st.view === '3d' });

    const f = [];
    if (n.type === 'bone') {
      f.push([t('fact.type'), label('kind.bone', n.kind)]);
      f.push([t('fact.count'), n.paired ? t('fact.perSide', { n: n.count, half: n.count / 2 }) : String(n.count)]);
      if (n.ribType) f.push([t('fact.ribType'), label('rib', n.ribType)]);
    } else if (n.type === 'joint') {
      f.push([t('fact.class'), label('joint.class', n.class)]);
      f.push([t('fact.type'), n.subtype]);
    } else if (n.type === 'muscle') {
      f.push([t('fact.type'), n.members?.length ? t('fact.muscleGroup', { n: n.members.length }) : t('fact.skeletalMuscle')]);
      if (n.nerve) f.push([t('fact.nerveSupply'), n.nerve]);
    } else if (n.type === 'nerve') {
      f.push([t('fact.type'), label('kind.nerve', n.kind)]);
      if (n.roots) f.push([t('fact.roots'), n.roots]);
      if (n.carries) f.push([t('fact.carries'), n.carries]);
    } else if (n.type === 'connective') {
      f.push([t('fact.type'), label('kind.connective', n.kind)]);
      if (n.paired) f.push([t('fact.count'), t('fact.oneEachSide')]);
    } else if (n.type === 'lymph') {
      f.push([t('fact.type'), label('kind.lymph', n.kind)]);
      if (n.kind !== 'organ') f.push([t('fact.carries'), t('carries.lymph')]);
    } else if (n.type === 'vessel') {
      f.push([t('fact.type'), label('kind.vessel', n.kind)]);
      f.push([t('fact.carries'), n.carries || (n.kind ? t(`carries.${n.kind}`) : '')]);
      if (n.pulse) f.push([t('fact.pulse'), n.pulse]);
    } else {
      f.push([t('fact.system'), graph.group(n.group)?.name]);
      if (n.paired) f.push([t('fact.count'), n.countLabel || t('fact.oneEachSide')]);
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
    if (n.listOnly) h += `<div class="note-card">${typeof n.listOnly === 'string' ? esc(n.listOnly) : t.html('panel.listOnly')} ${t.html('panel.listOnlyReach')}</div>`;

    if (n.type === 'joint') {
      const members = lift(keys.flatMap((k) => graph.membersOfJoint(k)), ctx, null);
      h += section(t.html('panel.bonesInJoint'), chips(members, ctx));
      if (n.movements?.length) h += section(t.html('panel.movements'), `<div class="movements">${n.movements.map((m) => `<span>${esc(m)}</span>`).join('')}</div>`);
    } else {
      h += connectsSection(n, keys, ctx);
    }
    h += linksSection(n, keys, ctx, st);
    const does = n.functions || n.actions;
    if (does?.length) h += section(t.html('panel.whatItDoes'), `<ul class="issues">${does.map((x) => `<li><span>${esc(txt(x))}${sexTag(x)}</span></li>`).join('')}</ul>`);
    if (n.members?.length) {
      // ?m= names a member in English (search and shared links), or in the language on show
      const focus = route.member ? normalize(route.member) : null;
      const isFocus = (m) => focus && (normalize(m.en ?? m.name) === focus || normalize(m.name) === focus);
      h += section(esc(n.membersLabel || t('panel.includes')), `<ul class="members">${n.members.map((m) => `<li class="${isFocus(m) ? 'focus' : ''}"><div><span class="mn">${esc(m.name)}${sexTag(m)}</span>${m.latin && m.latin !== m.name ? `<span class="ml">${esc(m.latin)}</span>` : ''}</div>${m.note ? `<div class="mt">${esc(m.note)}</div>` : ''}</li>`).join('')}</ul>`, ` <span class="n">${n.members.length}</span>`);
    }
    if (n.issues?.length) h += section(t.html('panel.commonIssues'), issuesList(n.issues));
    else {
      const inh = graph.inheritedIssues(n);
      if (inh) h += section(t.html('panel.commonIssues'), issuesList(inh.issues), ` <span class="issues-from">· ${esc(inh.group.name)}</span>`);
    }
    h += disclaimer();
    return h;
  }

  function groupView(route) {
    const g = graph.group(route.id);
    if (!g) return notFound();
    const L = graph.layer(g.layer);
    const anc = graph.ancestry(g.id).slice(0, -1);
    let h = eyebrow([esc(L?.name), ...anc.slice(-2).map((a) => `<button data-nav="g/${encodeURIComponent(a.id)}">${esc(a.name)}</button>`), t.html('panel.group')]);
    h += `<h2 class="title">${esc(g.name)}</h2>`;
    const ids = graph.groupIds(g.id);
    const count = graph.groupCount(g.id);
    h += facts([[t(L?.id === 'skeleton' ? 'fact.bones' : 'fact.structures'), String(L?.id === 'skeleton' ? count : ids.length)], [t('fact.entries'), String(ids.length)]]);
    if (g.summary) h += `<p class="summary">${esc(g.summary)}</p>`;
    if (g.children.length) {
      h += section(t.html('panel.subGroups'), `<div class="chips">${g.children.map((c) => `<button class="chip" data-nav="g/${encodeURIComponent(c)}" data-keys="${graph.groupKeys(c).join(' ')}">${esc(graph.group(c).name)}</button>`).join('')}</div>`);
    }
    if (g.members.length) h += section(t.html('panel.inGroup'), chips(g.members, { typeLevel: true }), ` <span class="n">${g.members.length}</span>`);
    if (g.issues?.length) h += section(t.html('panel.commonIssues'), issuesList(g.issues));
    h += disclaimer();
    return h;
  }

  function regionView(route, st) {
    const r = graph.regions.get(route.id);
    if (!r) return notFound();
    const side = r.paired ? route.side : null;
    const ctxSide = r.paired ? side : r.side || null;
    let h = `<button class="crumb" data-nav="hurt">${t.html('region.allAreas')}</button>`;
    h += eyebrow([t.html('region.hurt'), r.view === 'back' ? t.html('region.back') : null, side ? t.html(`region.side.${side}`) : null]);
    h += `<h2 class="title">${esc(r.name)}${side ? ` <span class="latin" style="font-size:18px">(${esc(t(`side.${side}`))})</span>` : ''}</h2>`;
    if (st.probe && st.probe.rkey === (side ? `${r.id}:${side}` : r.id) && st.probe.keys.length) {
      h += section(t.html('region.underSpot'), `<p class="section-note">${t.html('region.underSpotNote')}</p>${chips(st.probe.keys, { side: ctxSide })}`);
    }
    h += section(t.html('region.inArea'), chips(graph.regionStructures(r, side), { side: ctxSide }));
    h += section(t.html('region.causes'), `<div class="causes">${r.causes.map((c) => {
      const rel = c.related?.length ? chips(graph.regionStructures({ structures: c.related, paired: r.paired, side: r.side }, side), { side: ctxSide }) : '';
      return `<article class="cause"><div class="cause-head"><span class="cause-title">${esc(c.title)}${sexTag(c)}</span><span class="urg" data-u="${esc(c.urgency)}">${esc(label('urgency', c.urgency))}</span></div><p>${esc(c.signs)}</p>${rel}</article>`;
    }).join('')}</div>`);
    if (r.redFlags?.length) h += section(t.html('region.getHelp'), flagsCard(t('region.areaFlags'), r.redFlags));
    h += section(t.html('region.generalFlags'), flagsCard(t('region.callNow'), graph.regionsData.redFlags || [], false));
    h += disclaimer();
    return h;
  }

  function hurtHome(st) {
    let h = eyebrow([t.html('region.hurt')]);
    h += `<h2 class="title">${t.html('hurt.title')}</h2>`;
    h += `<p class="summary">${t.html('hurt.summary')}</p>`;
    h += st.view === '3d'
      ? `<div class="note-card">${t.html('hurt.note3dHtml')}</div>`
      : st.view === 'posterior'
      ? `<div class="note-card">${t.html('hurt.noteBackHtml')}</div>`
      : `<div class="note-card">${t.html('hurt.noteFrontHtml').replace('{mirror}', st.mirror ? t.html('hurt.mirrorOn') : t.html('hurt.mirrorOffHtml'))}</div>`;
    h += sexHint();
    h += section(t.html('hurt.howUrgent'), `<div class="legend-urg">${URGENCIES.map((k) => `<span class="urg" data-u="${k}">${esc(label('urgency', k))}</span>`).join('')}</div>`);
    const lists = REGION_GROUPS.map(([gid, ids]) => {
      const items = ids.map((id) => graph.regions.get(id)).filter(Boolean);
      if (!items.length) return '';
      return `<div><h4>${t.html(`regionGroup.${gid}`)}</h4><div class="chips">${items.map((r) => `<button class="chip" data-nav="r/${encodeURIComponent(r.id)}" data-rkeys="${graph.regionKeys(r.id).join(' ')}">${esc(r.name)}</button>`).join('')}</div></div>`;
    }).join('');
    h += section(t.html('region.allAreasTitle'), `<div class="region-list">${lists}</div>`);
    h += section(t.html('region.callNow'), flagsCard(t('region.emergencyFlags'), graph.regionsData.redFlags || []));
    h += disclaimer();
    return h;
  }

  function home() {
    const bones = [...graph.nodes.values()].filter((n) => n.type === 'bone').reduce((s, n) => s + (n.count || 0), 0);
    const joints = [...graph.nodes.values()].filter((n) => n.type === 'joint').length;
    const organs = [...graph.nodes.values()].filter((n) => n.type === 'organ').length;
    const count = (type) => [...graph.nodes.values()].filter((n) => n.type === type).length;
    const muscles = count('muscle'), nerves = count('nerve'), vessels = count('vessel'), lymph = count('lymph'), connective = count('connective');
    const stat = (v, key) => (v ? `<div class="stat"><b>${v}</b><span>${t.html(key, { n: v })}</span></div>` : '');
    const statAlways = (v, key) => `<div class="stat"><b>${v}</b><span>${t.html(key, { n: v })}</span></div>`;
    let edges = 0;
    for (const list of graph.adj.values()) edges += list.length;
    let h = eyebrow([t.html('home.eyebrow')]);
    h += `<p class="home-lede">${t.html('home.lede')}</p>`;
    h += `<p class="home-note" role="note"><b>${t.html('home.notDiagnostic')}</b> ${esc(graph.regionsData.disclaimer || t('panel.disclaimerFallback'))} ${esc(graph.regionsData.emergency || '')}</p>`;
    h += sexHint();
    h += `<div class="stats">${statAlways(bones, 'home.stat.bones')}${statAlways(joints, 'home.stat.joints')}${stat(muscles, 'home.stat.muscles')}${statAlways(organs, 'home.stat.organs')}${stat(nerves, 'home.stat.nerves')}${stat(vessels, 'home.stat.vessels')}${stat(lymph, 'home.stat.lymph')}${stat(connective, 'home.stat.connective')}${statAlways(Math.round(edges / 2), 'home.stat.connections')}</div>`;
    const nums = ['i', 'ii', 'iii', 'iv', 'v', 'vi'];
    h += section(t.html('home.howTo'), `<ul class="howto">
      ${nums.map((k, i) => `<li><span class="k">${k}</span><span>${t.html(`home.howTo${i + 1}Html`)}</span></li>`).join('\n      ')}
    </ul>`);
    h += section(t.html('home.legend'), `<div class="legend">
      <div><span class="sq sel"></span>${t.html('home.legend.selected')}</div>
      <div><span class="sq rel"></span>${t.html('home.legend.related')}</div>
      <div><span class="ln artery"></span>${t.html('home.legend.artery')}</div>
      <div><span class="ln vein"></span>${t.html('home.legend.vein')}</div>
      <div><span class="ln nerve"></span>${t.html('home.legend.nerve')}</div>
      <div><span class="ln ligament"></span>${t.html('home.legend.ligament')}</div>
      <div><span class="ln lymph"></span><span class="nd"></span>${t.html('home.legend.lymph')}</div>
      <div><span class="jdot" data-c="synovial"></span>${t.html('home.legend.synovial')}</div>
      <div><span class="jdot" data-c="cartilaginous"></span>${t.html('home.legend.cartilaginous')}</div>
      <div><span class="jdot" data-c="fibrous"></span>${t.html('home.legend.fibrous')}</div>
    </div>`);
    h += `<p class="disclaimer">${t.html('home.position')}</p>`;
    return h;
  }

  const notFound = () => `<p class="eyebrow">${t.html('notFound.eyebrow')}</p><h2 class="title">${t.html('notFound.title')}</h2><p class="summary">${t.html('notFound.text')} <button class="chip" data-nav="">${t.html('notFound.back')}</button></p>`;

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
      if (r.view === 'hurt') return t('region.hurt');
      return null;
    },
  };
}
