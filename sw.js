/* عامل خدمة نظام إدارة الإيجارات — v20260908-863888 */
var CACHE = "bgc-rental-v20260912-azag3k";
var SHELL = ["./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  /* كل ما ليس GET، وكل ما هو من نطاق آخر (Apps Script) — لا نلمسه */
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (x) { return; }
  if (url.origin !== self.location.origin) return;

  /* التنقّل: الشبكة أولًا لنحصل على أحدث نسخة، والذاكرة عند الانقطاع */
  if (req.mode === "navigate") {
    e.respondWith(
      /* تجاوز ذاكرة المتصفّح صراحةً: GitHub Pages يضع max-age=600، فالطلب
         العادي قد يُخدَم من الذاكرة عشر دقائق بعد الرفع — فيرى المستخدم نسخة
         قديمة ويظنّ أن التعديل لم يصل. reload يذهب إلى الشبكة دائمًا. */
      fetch(req, { cache: "reload" }).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
        return res;
      }).catch(function () {
        return caches.match("./index.html").then(function (m) {
          return m || caches.match("./");
        });
      })
    );
    return;
  }

  /* الأصول: الذاكرة أولًا ثم الشبكة */
  e.respondWith(
    caches.match(req).then(function (m) {
      if (m) return m;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
