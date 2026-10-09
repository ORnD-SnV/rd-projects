/* Service worker: keeps a copy of the app itself on the device so the dashboard opens
   with no connection. Project data is not handled here (the app stores that itself). */
const BUILD = "__BUILD__"; // replaced with the commit id by the GitHub Actions workflow
const CACHE = "rd-app-" + BUILD;
const SHELL = [
  "./", "index.html", "config.js", "manifest.webmanifest", "css/app.css",
  "js/core.js", "js/backend-google.js", "js/sync.js", "js/ui.js", "js/views-main.js", "js/views-work.js", "js/demo-data.js", "js/app.js",
  "fonts/ibm-plex-sans-latin-400-normal.woff2", "fonts/ibm-plex-sans-latin-500-normal.woff2", "fonts/ibm-plex-sans-latin-600-normal.woff2",
  "fonts/ibm-plex-sans-condensed-latin-500-normal.woff2", "fonts/ibm-plex-sans-condensed-latin-600-normal.woff2",
  "fonts/ibm-plex-mono-latin-400-normal.woff2", "fonts/ibm-plex-mono-latin-500-normal.woff2",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.indexOf("rd-app-") === 0 && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return; // Google calls always go to the network
  // Network first, so a new version is picked up as soon as there is a connection; cache when offline.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
