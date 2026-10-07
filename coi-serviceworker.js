(() => {
  const OWDOS_SW_VERSION = '6';
  const isolated = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp"
  };

  const isWorker = typeof ServiceWorkerGlobalScope !== "undefined" && self instanceof ServiceWorkerGlobalScope;

  if (isWorker) {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
    self.addEventListener("fetch", event => {
      const url = new URL(event.request.url);
      if (url.origin !== self.location.origin) return;
      event.respondWith((async () => {
        const response = await fetch(event.request);
        if (response.status === 0 || response.type === "opaque") return response;
        const headers = new Headers(response.headers);
        for (const [name, value] of Object.entries(isolated)) headers.set(name, value);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      })());
    });
    return;
  }

  if (typeof window !== "undefined" && window.crossOriginIsolated) return;
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("./coi-serviceworker.js?v=6", { scope: "./" }).then(() => {
      if (!navigator.serviceWorker.controller) window.location.reload();
    }).catch(() => {});
  }
})();
