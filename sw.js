// Offline shell. Bump VERSION when app files change.
const VERSION = 'tiger-v7';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'logic.js', 'md.js', 'program.js', 'manifest.webmanifest', 'icon.svg', 'img/home.webp', 'img/train.webp', 'img/progress.webp', 'img/skills.webp', 'img/body.webp', 'img/den.webp'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// network-first so updates land immediately; cache when offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
