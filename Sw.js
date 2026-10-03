const C = 'ricemill-v1', F = ['./', 'index.html', 'style.css', 'engine.js', 'app.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(F))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
