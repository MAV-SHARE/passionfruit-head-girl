/* 百香果頭女孩 — Service Worker(離線快取 + 版本更新) */
const CACHE = 'pfhg-v8';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/game.js',
  './js/leaderboard.js',
  './js/firebase-config.js',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (e) => {
  // 只預先快取,不主動接管:等頁面按下「立即更新」再切換,避免遊戲中被中斷
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

// 頁面按下「立即更新」→ 通知新 SW 接管(觸發 controllerchange → 頁面 reload)
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 快取優先,失敗才走網路;新資源順手放入快取
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Firebase 設定檔:網路優先(填入設定後不必等版本更新即可生效)
  if (url.pathname.endsWith('firebase-config.js')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
