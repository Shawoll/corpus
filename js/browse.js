// Browse drawer: every layer, group, structure, joint and body area as an accessible tree.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function buildBrowse(container, graph) {
  const item = (n) =>
    `<li><button data-nav="s/${encodeURIComponent(n.id)}">${esc(n.name)}${n.listOnly ? '<span class="muted">list only</span>' : n.paired ? '<span class="muted">L · R</span>' : ''}</button></li>`;
  const tree = (g) => {
    if (!graph.groupIds(g.id).length) return ''; // e.g. a group left empty by the biological sex filter
    const members = g.members.map((id) => graph.node(id)).filter(Boolean);
    const count = g.layer === 'skeleton' ? graph.groupCount(g.id) : graph.groupIds(g.id).length;
    return `<li><details><summary>${esc(g.name)}<span class="count">${count}</span></summary><ul>
      <li><button class="group-link" data-nav="g/${encodeURIComponent(g.id)}">Show the whole group</button></li>
      ${g.children.map((c) => tree(graph.group(c))).join('')}
      ${members.map(item).join('')}
    </ul></details></li>`;
  };

  let html = '<h2>Browse</h2>';
  for (const L of [...graph.layers].reverse()) {
    const roots = [...graph.groups.values()].filter((g) => g.layer === L.id && !g.parent);
    const nodes = [...graph.nodes.values()].filter((n) => n.layer === L.id);
    const joints = nodes.filter((n) => n.type === 'joint');
    const total = L.id === 'skeleton'
      ? `${nodes.filter((n) => n.type === 'bone').reduce((s, n) => s + n.count, 0)} bones`
      : `${nodes.length}`;
    html += `<details open><summary>${esc(L.name)}<span class="count">${total}</span></summary><ul>
      ${roots.map(tree).join('')}
      ${joints.length ? `<li><details><summary>Joints<span class="count">${joints.length}</span></summary><ul>${joints.map(item).join('')}</ul></details></li>` : ''}
    </ul></details>`;
  }
  const regions = [...graph.regions.values()];
  html += `<details><summary>Where does it hurt?<span class="count">${regions.length}</span></summary><ul>
    ${regions.map((r) => `<li><button data-nav="r/${encodeURIComponent(r.id)}">${esc(r.name)}${r.view === 'back' ? '<span class="muted">back</span>' : ''}</button></li>`).join('')}
  </ul></details>`;
  container.innerHTML = html;
}
