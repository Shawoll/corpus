// Type-ahead search over names, Latin names, alternative names, group members and body areas.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createSearch({ input, list, graph, onChoose }) {
  let results = [];
  let active = -1;

  const navOf = (e) => {
    const id = encodeURIComponent(e.id);
    if (e.kind === 'member') return `s/${id}?m=${encodeURIComponent(e.member)}`;
    if (e.kind === 'group') return `g/${id}`;
    if (e.kind === 'region') return `r/${id}`;
    if (e.kind === 'issue') return `s/${id}`;
    return `s/${id}`;
  };
  const mark = (label, q) => {
    const w = q.trim().split(/\s+/)[0]?.toLowerCase();
    const i = w ? label.toLowerCase().indexOf(w) : -1;
    if (i < 0) return esc(label);
    return esc(label.slice(0, i)) + '<mark>' + esc(label.slice(i, i + w.length)) + '</mark>' + esc(label.slice(i + w.length));
  };

  function open(show) {
    list.hidden = !show;
    input.setAttribute('aria-expanded', String(show));
  }
  function render() {
    if (!input.value.trim()) { open(false); return; }
    if (!results.length) {
      list.innerHTML = `<li class="r-empty" role="option" aria-disabled="true">No matches for “${esc(input.value.trim())}”</li>`;
      open(true);
      return;
    }
    list.innerHTML = results.map((e, i) =>
      `<li role="option" id="opt-${i}" data-i="${i}" aria-selected="${i === active}"><span class="r-name">${mark(e.label, input.value)}</span><span class="r-meta">${esc(e.meta)}</span></li>`).join('');
    input.setAttribute('aria-activedescendant', active >= 0 ? `opt-${active}` : '');
    open(true);
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  function choose(i) {
    const e = results[i];
    if (!e) return;
    input.value = '';
    results = [];
    open(false);
    input.blur();
    onChoose(navOf(e));
  }

  input.addEventListener('input', () => {
    results = graph.search(input.value);
    active = results.length ? 0 : -1;
    render();
  });
  input.addEventListener('focus', () => { if (input.value.trim()) render(); });
  input.addEventListener('blur', () => setTimeout(() => open(false), 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); active = (active + 1) % results.length; render(); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); active = (active - 1 + results.length) % results.length; render(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { input.value = ''; results = []; open(false); input.blur(); }
  });
  list.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    e.preventDefault();
    choose(+li.dataset.i);
  });

  return { focus: () => input.focus() };
}
