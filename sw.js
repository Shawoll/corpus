// Corpus's service worker: offline use (docs/offline.md). Registered by js/offline.js.
//
// Network first, cache as fallback, for every same-origin GET: each answer from the network also refreshes the
// cached copy, so an edit to the data or drawings shows on the next visit and there is no version to bump. With
// no network, or when it takes longer than NETWORK_WAIT to start answering, the cached copy is used (and the
// network still refreshes it in the background). Nothing is cached ahead: the page hands over what it has already
// loaded once this worker is running, and "Save for offline" in the settings fetches the rest.
const CACHE = 'corpus';
const NETWORK_WAIT = 3000; // ms

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.headers.has('range')) return; // partial answers can't be cached whole
  e.respondWith(answer(e, req));
});

// every visit to the app (/, /index.html, /?debug, any hash) is one page: one cache entry
const pageKey = (req) => (req.mode === 'navigate' && /\/(index\.html)?$/.test(new URL(req.url).pathname)
  ? self.registration.scope : req);

async function answer(e, req) {
  const cache = await caches.open(CACHE);
  const key = pageKey(req);
  let stored = Promise.resolve();
  const net = fetch(req).then((res) => {
    if (res.status === 200 && res.type === 'basic') stored = cache.put(key, res.clone());
    return res;
  });
  e.waitUntil(net.then(() => stored, () => {})); // let a background refresh finish
  const copy = await cache.match(key);
  if (!copy) return net;
  const wait = new Promise((resolve) => setTimeout(() => resolve(copy), NETWORK_WAIT));
  // a server error is no better than the copy
  return Promise.race([net.then((res) => (res.status >= 500 ? copy : res), () => copy), wait]);
}
