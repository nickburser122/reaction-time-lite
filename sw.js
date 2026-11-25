const CACHE = 'reaction-time-v1';
const ASSETS = [
  'index.html',
  'css/style.css',
  'css/bold.css',
  'js/app.js',
  'fonts/geist.woff2',
  'fonts/geist-mono.woff2',
  'fonts/jetbrains-mono.woff2',
  'fonts/instrument-serif.woff2',
  'fonts/instrument-serif-italic.woff2'
];
const ROOT = new URL('./', location).href;
const INDEX = ROOT + 'index.html';
const SET = new Set(ASSETS.map(u => ROOT + u));

const plain = r => (r.redirected ? new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers }) : r);
const pull = (c, key, url) => fetch(url, { cache: 'no-cache' }).then(r => {
  if (!r.ok) throw new Error(String(r.status));
  const res = plain(r);
  return c.put(key, res.clone()).then(() => res);
});

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(u => pull(c, ROOT + u, ROOT + u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('reaction-time-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url.split(/[?#]/)[0];
  const key = url === ROOT ? INDEX : url;
  if (!SET.has(key)) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(key);
    const net = pull(c, key, url);
    if (!hit) return net;
    e.waitUntil(net.catch(() => {}));
    return hit;
  }));
});
