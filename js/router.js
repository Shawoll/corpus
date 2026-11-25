// Hash routes (GitHub Pages friendly, shareable):
//   #/                      home
//   #/s/<id>[/<side>][?m=…] a structure (bone, joint or organ); ?m= highlights a member (e.g. scaphoid)
//   #/g/<id>                a group (e.g. ribs)
//   #/hurt                  "Where does it hurt?" start
//   #/r/<id>[/<side>]       a body region
export function parse(hash = location.hash) {
  const h = hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  const params = new URLSearchParams(query || '');
  const side = (s) => (s === 'left' || s === 'right' ? s : null);
  switch (parts[0]) {
    case 's': return parts[1] ? { view: 'node', id: parts[1], side: side(parts[2]), member: params.get('m') } : { view: 'home' };
    case 'g': return parts[1] ? { view: 'group', id: parts[1] } : { view: 'home' };
    case 'r': return parts[1] ? { view: 'region', id: parts[1], side: side(parts[2]) } : { view: 'hurt' };
    case 'hurt': return { view: 'hurt' };
    default: return { view: 'home' };
  }
}

export function href(path) { return '#/' + path; }

export function go(path) {
  const h = href(path);
  if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = h;
}

export const isHurt = (route) => route.view === 'hurt' || route.view === 'region';
