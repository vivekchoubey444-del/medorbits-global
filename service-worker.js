/* MedOrbits root PWA service worker.
   Cache only same-origin GET pages/assets; never cache account/admin/API submissions. */
const CACHE_VERSION = "medorbits-pwa-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const CORE_URLS = [
  "/", "/index.html", "/education/", "/education/index.html",
  "/education/courses.html", "/education/admissions.html",
  "/education/colleges.html", "/education/universities.html",
  "/education/study-in-india.html", "/education/scholarships.html",
  "/education/fees.html", "/education/entrance-exams.html",
  "/education/eligibility.html", "/offline.html", "/manifest.json",
  "/assets/pwa/icon-192.png", "/assets/pwa/icon-512.png",
  "/assets/pwa/icon-maskable-512.png"
];
const NEVER_CACHE = /\/(admin|account|api|auth|login|logout|register|payments?|checkout|upload|uploads|submit|application-status|password|sessions?)(\/|\.|$)/i;
const CACHEABLE_PUBLIC_PAGES = new Set([
  "/", "index.html", "about.html", "contact.html", "courses.html",
  "colleges.html", "universities.html", "scholarships.html", "fees.html",
  "admissions.html", "study-in-india.html", "careers.html", "jobs.html",
  "education", "education/index.html", "education/courses.html",
  "education/admissions.html", "education/colleges.html",
  "education/universities.html", "education/study-in-india.html",
  "education/scholarships.html", "education/fees.html",
  "education/entrance-exams.html", "education/eligibility.html",
  "education/compare.html"
]);
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(CORE_URLS.map(async path => {
      try {
        const response = await fetch(path, { cache: "reload" });
        if (response.ok && response.type === "basic") await cache.put(path, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE]);
    await Promise.all((await caches.keys())
      .filter(name => name.startsWith("medorbits-pwa-") && !keep.has(name))
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
function allowed(request, url) {
  return request.method === "GET" &&
    url.origin === self.location.origin &&
    !NEVER_CACHE.test(url.pathname) &&
    !url.searchParams.has("nocache") &&
    !url.searchParams.has("token");
}
async function pageStrategy(request, url) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  } catch (_) {
    const exact = await cache.match(request);
    if (exact) return exact;
    const clean = new URL(request.url); clean.search = "";
    const hit = await cache.match(clean.href) || await caches.match(clean.href);
    if (hit) return hit;
    const fallback = await caches.match("/offline.html");
    return fallback || new Response("You are offline. Reconnect and try again.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
async function assetStrategy(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response.ok && response.type === "basic") cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await network || new Response("", { status: 504 });
}
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!allowed(req, url)) return;
  if (req.mode === "navigate" || req.destination === "document") {
    const rel = url.pathname.replace(/^\/+/, "");
    const leaf = url.pathname.split("/").filter(Boolean).pop() || "index.html";
    if (CACHEABLE_PUBLIC_PAGES.has(rel) || CACHEABLE_PUBLIC_PAGES.has(leaf) || url.pathname.endsWith("/")) {
      event.respondWith(pageStrategy(req, url));
    }
    return;
  }
  if (["style", "script", "image", "font"].includes(req.destination) ||
      /\.(?:css|js|mjs|png|jpe?g|webp|svg|ico|woff2?|ttf)$/i.test(url.pathname)) {
    event.respondWith(assetStrategy(req));
  }
});
