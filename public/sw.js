/* FlowSpace service worker
 *
 * Goals:
 *  - Cache the app shell + static assets so the UI loads instantly on
 *    repeat visits and renders an offline placeholder when there's no
 *    network.
 *  - Pass through API calls (never cache user data — bad staleness vs
 *    privacy tradeoff). The app already handles loading states.
 *
 * Updating: we bump CACHE_VERSION whenever the cached set must change.
 * Old caches are deleted on activate.
 */

const CACHE_VERSION = "flowspace-v1"
const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  // Same-origin only.
  if (url.origin !== self.location.origin) return
  // Never intercept API routes, server actions, or Next.js internals.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.includes("?_rsc=")
  ) {
    return
  }

  // Network-first for HTML navigations; cache-first for static assets.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache successful HTML for offline-first refresh.
          const copy = res.clone()
          caches
            .open(CACHE_VERSION)
            .then((cache) => cache.put(req, copy))
            .catch(() => undefined)
          return res
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/")),
        ),
    )
    return
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches
                .open(CACHE_VERSION)
                .then((cache) => cache.put(req, copy))
                .catch(() => undefined)
            }
            return res
          }),
      ),
    )
  }
})

// ─── Push notifications (scaffolded, opt-in by future feature flag) ───
self.addEventListener("push", (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "FlowSpace", body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "FlowSpace", {
      body: payload.body || "",
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: payload.url ? { url: payload.url } : undefined,
      tag: payload.tag,
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clients) => {
        for (const client of clients) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url)
        }
      },
    ),
  )
})
