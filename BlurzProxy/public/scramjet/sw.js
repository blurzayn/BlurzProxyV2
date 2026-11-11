importScripts("/vendor/scramjet/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Poki's /f=auto/ thumbnails are served from its image CDN, not poki.com.
function rewritePokiImageRequest(request) {
  const proxyUrl = new URL(request.url);
  const prefix = "/scramjet/";
  if (!proxyUrl.pathname.startsWith(prefix)) return request;

  let destination;
  try {
    destination = new URL(decodeURIComponent(proxyUrl.pathname.slice(prefix.length)));
  } catch {
    return request;
  }

  if (destination.protocol !== "https:" || destination.hostname !== "poki.com") {
    return request;
  }

  // Poki uses several asset identifiers (hex hashes, UUIDs, and filenames).
  // Match the whole /f=auto/ asset path instead of assuming one hash format.
  const assetPath = destination.pathname.match(/^\/f=auto\/(.+)$/i)?.[1];
  if (!assetPath || assetPath.includes("..")) return request;

  destination.hostname = "img.poki-cdn.com";
  destination.pathname =
    `/cdn-cgi/image/q=78,scq=50,width=277,height=277,fit=cover,f=auto/${assetPath}`;

  const rewrittenProxyUrl = new URL(request.url);
  rewrittenProxyUrl.pathname = prefix + encodeURIComponent(destination.href);
  return new Request(rewrittenProxyUrl.href, request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    await scramjet.loadConfig();

    const originalRequest = event.request;
    const request = rewritePokiImageRequest(originalRequest);

    // Preserve the real FetchEvent (including its browser-owned getters) while
    // substituting only the request URL that Scramjet routes.
    const routedEvent = request === originalRequest
      ? event
      : new Proxy(event, {
          get(target, property) {
            if (property === "request") return request;
            return Reflect.get(target, property, target);
          }
        });

    if (scramjet.route(routedEvent)) {
      return scramjet.fetch(routedEvent);
    }

    return fetch(originalRequest);
  })());
});
