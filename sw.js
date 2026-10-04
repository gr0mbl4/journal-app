// Офлайн-оболочка журнала: страница и скрипт берутся из кэша, если нет сети.
// Данные (api.github.com) сюда не попадают — они в localStorage приложения.
const CACHE = 'bj-shell-20261004h';
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
    // только старые оболочки: кэши аудиокниг (bj-audio) и видео упражнений (bj-media) не трогаем
    for (const k of await caches.keys()) if (k.startsWith('bj-shell-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  if (u.searchParams.has('vcheck')) return; // проверка новой версии — всегда сеть, мимо кэша
  if (r.mode === 'navigate') {
    // Сразу из кэша (журнал открывается мгновенно даже при плохой сети), свежая версия — в фоне, со следующего открытия.
    const cp = caches.open(CACHE);
    const net = fetch(r, { cache: 'no-store' }).then(async res => { if (res.ok) await (await cp).put('./index.html', res.clone()); return res; }).catch(() => null);
    e.waitUntil(net.then(() => {}));
    e.respondWith((async () => (await (await cp).match('./index.html')) || (await net) || Response.error())());
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
