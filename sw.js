// ============================================================
// octano-pdv  -  Service Worker (PWA)
// ============================================================
// Estrategia:
//  - Arquivos do proprio app (HTML/JS/CSS/icones): cache-first com
//    atualizacao em segundo plano (stale-while-revalidate).
//  - Supabase, SEFAZ e qualquer API externa: SEMPRE rede (nunca cacheia),
//    para nunca servir venda/preco/dado desatualizado.
// Para forcar atualizacao do app, basta subir o index com nova versao
// (?v=N) nos scripts: o SW revalida em segundo plano.

const CACHE = "octano-pdv-v1";

// arquivos essenciais do app (o "casca" do PDV)
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // so trata GET
  if (req.method !== "GET") return;

  // NUNCA cacheia chamadas externas (Supabase, SEFAZ, CDNs de dados, QR, etc.)
  // Deixa passar direto pela rede.
  const ehMesmaOrigem = url.origin === self.location.origin;
  if (!ehMesmaOrigem) return;

  // Arquivos do proprio app: stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cacheado = await cache.match(req);
      const rede = fetch(req)
        .then((resp) => {
          // guarda copia atualizada (so respostas validas)
          if (resp && resp.status === 200 && resp.type === "basic") {
            cache.put(req, resp.clone());
          }
          return resp;
        })
        .catch(() => null);

      // devolve o cache imediatamente se existir; senao espera a rede
      return cacheado || (await rede) || new Response("Offline", { status: 503 });
    })
  );
});
