const CACHE_NAME = 'doc-scan-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];
// 图标尽力缓存：缺失也不影响核心离线功能
const OPTIONAL_ASSETS = [
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// OCR 组件所在 CDN：首次在线使用后缓存，之后 OCR 可离线
const RUNTIME_CACHE_HOSTS = [
  'cdn.jsdelivr.net',
  'tessdata.projectnaptha.com',
  'unpkg.com'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS).then(() =>
        Promise.all(OPTIONAL_ASSETS.map(u => cache.add(u).catch(() => null)))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (RUNTIME_CACHE_HOSTS.includes(url.hostname) && e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      }))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
