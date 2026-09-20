const CACHE_VERSION = "v2";
const STATIC_CACHE = `dashads-static-${CACHE_VERSION}`;
const API_CACHE = `dashads-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `dashads-images-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/login",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ── Activate: limpa caches antigos ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, API_CACHE, IMAGE_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estratégia por tipo de recurso ─────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests que não são GET
  if (request.method !== "GET") return;

  // Ignora extensões de dev e chrome-extension
  if (url.protocol === "chrome-extension:") return;

  // Imagens externas (criativos Meta) — StaleWhileRevalidate
  if (
    url.hostname.includes("fbcdn.net") ||
    url.hostname.includes("fbsbx.com")
  ) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, 100));
    return;
  }

  // API routes do próprio app — NetworkFirst com fallback
  if (url.pathname.startsWith("/api/meta/")) {
    event.respondWith(networkFirst(request, API_CACHE, 5 * 60));
    return;
  }

  // Assets estáticos Next.js — CacheFirst
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Fontes Google — CacheFirst longo
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Páginas da app — NetworkFirst
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, STATIC_CACHE, 24 * 60 * 60));
    return;
  }
});

// ── Helpers de estratégia ─────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName, maxAgeSeconds = 300) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName, maxEntries = 50) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(async (response) => {
    if (response.ok) {
      // Limita o número de entradas no cache
      const keys = await cache.keys();
      if (keys.length >= maxEntries) {
        await cache.delete(keys[0]);
      }
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached ?? fetchPromise;
}

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "DashAds Pro", {
        body: data.body || "",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        data: { url: data.url || "/dashboard" },
        vibrate: [100, 50, 100],
      })
    );
  } catch {}
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || "/dashboard";
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
