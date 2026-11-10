/* ============================================================
   SERVICE WORKER — app instalável
   Estratégia "rede primeiro": sempre busca a versão nova do site;
   só usa a cópia guardada se o celular estiver sem internet.
   Dados do Firebase (outros domínios) nunca passam por aqui.
   Ao mudar arquivos do sistema, não precisa mexer neste arquivo.
============================================================ */
var CACHE = 'impresul-mkt-v1';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Firebase, fontes, CDNs: direto
  if (url.pathname.indexOf('/api/') === 0) return;   // funções da Vercel: direto

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copia = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) {
        return r || (req.mode === 'navigate' ? caches.match('./') : undefined);
      });
    })
  );
});
