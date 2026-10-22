// Service worker: guarda os arquivos do app para funcionar offline.
const CACHE = 'sinapse-v42';
const SHELL = [
  './',
  './index.html',
  './termos.html',
  './baixar/',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/cloud.js',
  './js/biometric.js',
  './js/fx.js',
  './js/match.js',
  './js/plan.js',
  './js/plans.js',
  './js/tools.js',
  './js/questions.js',
  './js/data.js',
  './js/fsrs.js',
  './js/store.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Rede primeiro (para pegar atualizações); sem internet, usa o cache.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const sameOrigin = new URL(event.request.url).origin === self.location.origin;
  event.respondWith(
    // 'no-cache' faz o navegador confirmar com o servidor se o arquivo mudou,
    // em vez de usar a cópia guardada por até 10 minutos.
    fetch(event.request, sameOrigin ? { cache: 'no-cache' } : undefined)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./index.html'))),
  );
});
