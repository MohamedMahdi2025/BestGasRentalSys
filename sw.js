/* عامل خدمة نظام إدارة الإيجارات — v20260908-863888 */
var CACHE = "bgc-rental-v20261027-1s1wdqk";
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

/* إشعارات الدفع: الخادم يرسل {t, b, be, go, tag} مشفّرًا، والمتصفح يفكّه هنا.
   يجب أن يُعرض إشعارٌ لكل دفعة — Safari وChrome يسحبان الإذن ممن لا يعرض. */
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) {
    try { d = { t: e.data.text() }; } catch (y) { d = {}; }
  }
  /* لغة الجهاز يرسلها الخادم (l) كما اختارها المستخدم في النظام */
  var en = d.l === "en";
  if (!d.l) try { en = String((self.navigator && self.navigator.language) || "").indexOf("ar") !== 0; } catch (x) {}
  var title = d.t || (en ? "Rental system" : "نظام إدارة الإيجارات");
  var body = (en && d.be) ? d.be : (d.b || "");
  e.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: d.tag ? "bgc-" + d.tag + "-" + Date.now() : undefined,
    lang: en ? "en" : "ar",
    dir: "auto",
    data: { go: d.go || "" }
  }));
});

/* الضغط على الإشعار: نافذة النظام المفتوحة تنتقل إلى الشاشة، وإلا تُفتح */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var go = (e.notification.data && e.notification.data.go) || "";
  var url = new URL("./" + (go ? "#go=" + go : ""), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.registration.scope) === 0 && "focus" in c) {
        try { c.postMessage({ type: "bgc-go", go: go }); } catch (x) {}
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
