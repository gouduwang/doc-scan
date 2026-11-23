const CACHE_NAME = 'doc-scan-v6';
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
  'fastly.jsdelivr.net',
  'gcore.jsdelivr.net',
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
  // 页面导航：网络优先（拿到新版就顺手更新缓存），断网时回落缓存。
  // 若沿用 cache-first，改了 index.html 而忘记 bump CACHE_NAME 时，
  // 老用户会长期停在旧版。
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return resp;
      }).catch(() =>
        caches.match(e.request).then(r => r || caches.match('./index.html'))
      )
    );
    return;
  }
  // 自托管 OCR 大文件：首次在线取用后缓存，此后 OCR 可离线
  const isOwnOcr = url.origin === location.origin && url.pathname.includes('/ocr/');
  if ((isOwnOcr || RUNTIME_CACHE_HOSTS.includes(url.hostname)) && e.request.method === 'GET') {
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
