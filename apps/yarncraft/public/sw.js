/*
 * Offline shell.
 *
 * Two strategies, chosen by what the request is:
 *
 *  - app shell (HTML, JS, CSS, the worker itself): cache first, so the studio
 *    opens instantly and works with no signal. Vite fingerprints asset names,
 *    so a stale cache cannot serve a stale bundle -- a new build asks for a
 *    filename that was never cached and the network answers.
 *  - API calls: network only. The Python checker is the authority; replaying a
 *    cached verdict would tell you a pattern is fine based on an older parse.
 *    Offline, the app sees a clean failure and says so.
 *
 * Registered from main.tsx. Bump VERSION to invalidate every shell entry.
 */
const VERSION = 'v1';
const SHELL = `studio-shell-${VERSION}`;

/** Fetched at install so the app opens offline after a single visit. */
const CORE = ['./', './manifest.webmanifest', './favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(CORE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isApi(url) {
  return url.pathname.includes('/api/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApi(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Refresh in the background; the cached copy already answered.
        event.waitUntil(
          fetch(request)
            .then((response) => {
              if (response.ok) return caches.open(SHELL).then((cache) => cache.put(request, response.clone()));
              return undefined;
            })
            .catch(() => undefined),
        );
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() =>
          request.mode === 'navigate'
            ? caches.match('./').then((shell) => shell ?? Response.error())
            : Response.error(),
        );
    }),
  );
});
