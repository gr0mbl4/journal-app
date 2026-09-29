// Офлайн-оболочка журнала: страница и скрипт берутся из кэша, если нет сети.
// Данные (api.github.com) сюда не попадают — они в localStorage приложения.
const CACHE = 'bj-shell-20260929f';
const STATIC = ['./manifest.webmanifest', './icon-192.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const res = await fetch('./index.html', { cache: 'no-store' });
    const html = await res.clone().text();
    await c.put('./index.html', res);
    const scripts = Array.from(html.matchAll(/<script src="([^"]+)"/g)).map(m => './' + m[1]);
    await c.addAll(scripts.concat(STATIC));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('bj-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  if (r.mode === 'navigate') {
    // Сначала сеть (свежая версия), при плохой связи — через 4 с кэш.
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(r, { cache: 'no-store' }), timeout(4000)]);
        if (res.ok) c.put('./index.html', res.clone());
        return res;
      } catch (_) {
        return (await c.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  // Скрипт и иконки версионированы — кэш, потом сеть.
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(r);
    if (hit) return hit;
    const res = await fetch(r);
    if (res.ok) c.put(r, res.clone());
    return res;
  })());
});
