/*
  sw.js — service worker for offline use.

  The whole site is a few hundred KB of static files and every tool is pure
  client-side JavaScript, so there is nothing stopping it from working with no
  connection at all. Precache everything on install; after that the network is
  only needed to pick up a new version.

  Bump CACHE when you change any cached file — the old cache is deleted on
  activate, so a stale tool can't linger.
*/

const CACHE = 'json-studio-v9';

const PRECACHE = [
  './',
  'index.html',
  'tools.html',
  'presentation.html',
  'privacy.html',
  'terms.html',
  'about.html',
  'format.html',
  'tool.html',
  'diff.html',
  'jsonpath.html',
  'jwt.html',
  'json-schema.html',
  'validate.html',
  'mock.html',
  'code.html',
  'csv.html',
  'yaml-json.html',
  'xml.html',
  'jsonl.html',
  'sql.html',
  'manifest.webmanifest',
  'assets/css/styles.css',
  'assets/css/tool.css',
  'assets/css/convert.css',
  'assets/css/present.css',
  'assets/css/workbench.css',
  'assets/css/home.css',
  'assets/css/tool-focus.css',
  'assets/css/editor.css',
  'assets/js/site.js',
  'assets/js/tool-kit.js',
  'assets/js/infer.js',
  'assets/js/tools-hub.js',
  'assets/js/share.js',
  'assets/js/payload-link.js',
  'assets/js/history.js',
  'assets/js/gutter.js',
  'assets/js/editor.js',
  'assets/js/present.js',
  'assets/js/workbench.js',
  'assets/js/diagram.js',
  'assets/js/export.js',
  'assets/js/ai-assist.js',
  'assets/js/format.js',
  'assets/js/diff.js',
  'assets/js/jsonpath.js',
  'assets/js/jwt.js',
  'assets/js/json-schema.js',
  'assets/js/validate.js',
  'assets/js/mock.js',
  'assets/js/code.js',
  'assets/js/csv.js',
  'assets/js/yaml-json.js',
  'assets/js/xml.js',
  'assets/js/jsonl.js',
  'assets/js/sql.js',
  'assets/img/favicon.svg',
  'assets/img/og-cover.png',
  'assets/img/icon-192.png',
  'assets/img/icon-512.png',
  'assets/img/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll is all-or-nothing; cache entries individually so one 404 during
      // development doesn't leave the site with no offline support at all.
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Third-party assets (fonts, the js-yaml CDN bundle): try the network, fall
  // back to whatever we cached last time so the YAML page survives offline.
  if (!sameOrigin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Navigations: prefer the network so a deployed change shows up immediately,
  // but fall back to the cached page when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  // Everything else: cache first, refreshing in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
