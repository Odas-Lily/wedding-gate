/* Invite Gate service worker — offline app shell.
   Caches the page + libraries so the app opens instantly on the
   wedding day even if venue internet is down. Firebase realtime
   traffic is never intercepted. Bump CACHE to force an update. */
const CACHE = "gate-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(SHELL.map((u) => c.add(u)))
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  // never intercept live database traffic
  if (u.hostname.includes("firebasedatabase.app") ||
      u.hostname.includes("firebaseio.com") ||
      u.hostname.includes("googleapis.com")) return;

  // page loads: network first (fresh app), cached shell as offline fallback
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const cp = r.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", cp));
          return r;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // everything else: cache first, then network (and cache it)
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((r) => {
          const cp = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, cp));
          return r;
        })
    )
  );
});
