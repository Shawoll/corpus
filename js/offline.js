// Offline use (docs/offline.md). sw.js answers every request from the network first and keeps a copy of each
// answer in the "corpus" cache, used when there is no network. This module registers it, hands it what the page
// loaded before it was running (the first visit), and backs "Save for offline" in the settings: everything a visit
// fetches only on demand (the realistic drawings, the 3D view: three.js and every model), fetched now.
const CACHE = 'corpus'; // the same name as in sw.js

// file:// and plain http (other than localhost) have no service workers
export const supported = 'serviceWorker' in navigator && 'caches' in window && window.isSecureContext;

// enough room for every file a visit can load, so none drops out of the list handOver() reads
try { performance.setResourceTimingBufferSize(600); } catch { /* not supported: the default (250) is enough */ }

let registration = null;

// Start the worker once the page has loaded, and copy what the page has already fetched into the cache.
export async function register() {
  if (!supported) return;
  try {
    registration = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    await handOver();
  } catch (err) {
    console.warn('[Corpus] offline use is not available', err);
  }
}

// every same-origin file this page has fetched so far, and the page itself, into the cache (skipping what is there)
async function handOver() {
  const cache = await caches.open(CACHE);
  const here = new URL('./', location.href).href;
  const urls = new Set([registration?.scope || here]);
  for (const e of performance.getEntriesByType('resource')) {
    const u = new URL(e.name);
    if (u.origin === location.origin && !u.pathname.endsWith('/sw.js')) urls.add(u.origin + u.pathname);
  }
  await Promise.all([...urls].map(async (u) => {
    if (await cache.match(u)) return;
    try {
      const res = await fetch(u);
      if (res.status === 200) await cache.put(u, res);
    } catch { /* offline right now: the worker will cache it on a later visit */ }
  }));
}

// The files a visit fetches only on demand, from the manifest: every view's drawings in every style, the 3D models,
// the skin, the 3D keys and the model licence. (The data and the default drawings load on every visit.)
export function onDemandFiles(manifest) {
  const out = new Set();
  const add = (spec) => {
    if (typeof spec === 'string') out.add(spec);
    else if (spec && typeof spec === 'object') Object.values(spec).forEach(add);
  };
  for (const l of manifest.layers) { add(l.svg); add(l.styles); add(l.model); }
  add(manifest.regions?.svg);
  add(manifest.model3d);
  return [...out].map((p) => new URL(p, location.href).href);
}
// three.js and the 3D view's own module, which only load with the 3D view
const MODULES = ['js/model3d.js', 'js/vendor/three/three.module.min.js'];

// true when every on-demand file (and the 3D view's modules) is in the cache
export async function savedAll(manifest) {
  if (!supported) return false;
  const cache = await caches.open(CACHE);
  const urls = [...onDemandFiles(manifest), ...MODULES.map((p) => new URL(p, location.href).href)];
  for (const u of urls) if (!(await cache.match(u))) return false;
  return true;
}

// Fetch and cache every on-demand file. onProgress(done, total) after each one. Resolves to the number that failed.
export async function saveAll(manifest, onProgress = () => {}) {
  const cache = await caches.open(CACHE);
  const urls = onDemandFiles(manifest);
  const total = urls.length + 1;
  let done = 0, failed = 0;
  // the 3D view's module pulls in three.js and its add-ons; handOver() below copies them into the cache
  try { await import('./model3d.js'); } catch { failed++; }
  onProgress(++done, total);
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: 'no-cache' });
      if (res.status === 200) await cache.put(u, res);
      else failed++;
    } catch { failed++; }
    onProgress(++done, total);
  }
  await handOver();
  return failed;
}
