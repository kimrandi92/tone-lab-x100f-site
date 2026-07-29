const CACHE_NAME = "tone-lab-offline-v13";
const APP_ROOT = new URL("./", self.registration.scope).toString();
const CORE_FILES = [
  APP_ROOT,
  new URL("manifest.webmanifest", APP_ROOT).toString(),
  new URL("icon.svg", APP_ROOT).toString(),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const response = await fetch(APP_ROOT);
      await cache.put(APP_ROOT, response.clone());

      const html = await response.text();
      const linkedFiles = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((url) => url.startsWith("/") && !url.startsWith("/api/"));

      await cache.addAll([...new Set([...CORE_FILES.slice(1), ...linkedFiles])]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const scopePath = new URL(APP_ROOT).pathname;
  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(scopePath) ||
    url.pathname.includes("/api/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_ROOT, response.clone());
          return response;
        })
        .catch(async () => (await caches.match(APP_ROOT)) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        }),
    ),
  );
});
