importScripts("/vendor/scramjet/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Poki serves its game thumbnails from its image CDN. Its older /f=auto
// image paths return 404 when requested from poki.com through the proxy.
function rewritePokiImageRequest(request) {
  if (request.destination !== "image") return request;

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

  const match = destination.pathname.match(/^\/f=auto\/([a-f0-9]{32}\/.+)$/i);
  if (!match) return request;

  destination.hostname = "img.poki-cdn.com";
  destination.pathname =
    `/cdn-cgi/image/q=78,scq=50,width=277,height=277,fit=cover,f=auto/${match[1]}`;

  const rewrittenProxyUrl = new URL(request.url);
  rewrittenProxyUrl.pathname = prefix + encodeURIComponent(destination.href);
  return new Request(rewrittenProxyUrl.href, request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    await scramjet.loadConfig();

    const request = rewritePokiImageRequest(event.request);
    const routedEvent = request === event.request
      ? event
      : { request, clientId: event.clientId };

    if (scramjet.route(routedEvent)) {
      return scramjet.fetch(routedEvent);
    }

    return fetch(event.request);
  })());
});
