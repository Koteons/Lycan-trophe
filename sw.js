const CACHE = 'lycan-v1';
const ASSETS = [
  '/Lycan-trophe/lobby.html',
  '/Lycan-trophe/login.html',
  '/Lycan-trophe/profil.html',
  '/Lycan-trophe/game-room.html',
  '/Lycan-trophe/game-start.html',
  '/Lycan-trophe/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Toujours réseau en priorité, cache en fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
