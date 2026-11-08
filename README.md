# BlurzProxy

A browser-based web proxy powered by Scramjet.

## Run it

Install [Node.js](https://nodejs.org/), then run:

```bash
git clone https://github.com/blurzayn/BlurzProxyV2.git
cd BlurzProxyV2/BlurzProxy
npm ci
npx playwright install chromium
npm test
npm run check
npm start
```

Open [http://localhost:3000](http://localhost:3000).

`npm test` runs server integration tests. `npm run check` also launches Chromium
and tests homepage-first startup, manual tab restore, proxy navigation,
bookmarks, keyboard shortcuts, keyboard focus, 320px/390px mobile layouts, and
automated WCAG 2.1 AA checks for every theme. On Linux, install Chromium's
system libraries once with:

```bash
npx playwright install-deps chromium
```

The app also exposes health endpoints for local monitoring:

- `/healthz` for basic liveness
- `/readyz` for readiness
- `/api/status` for the current status payload

The browser always opens on its homepage. Previous tabs are not opened
automatically; choose **Restore previous tabs** in Settings or open a saved
session when you want to resume browsing. Closed tabs can be reopened with
`Ctrl+Shift+T`. The browser also includes copying the current address and
per-tab load failure messages.
Remote pages use the host browser's native
download behavior; BlurzProxy does not intercept downloads or provide a separate
download queue.

The HTTP server limits parsed request bodies to 1 MB, returns bounded JSON errors
for malformed or oversized bodies, and applies request/header timeouts. Its
current proxy transport is WebSocket-based, so HTTP upstream retry behavior is
not applicable to proxied page requests.

## GitHub Codespaces

The Codespaces configuration installs dependencies and starts the server whenever
the Codespace starts or resumes, waits for `/api/status` to respond, then forwards
port 3000 as a **private** port. After adding this configuration to an existing
Codespace, rebuild its container once for the startup and port-forwarding
settings to take effect.

If the app still returns 502, check that port 3000 is forwarded in the Codespaces
**Ports** panel, then inspect `/tmp/blurzproxy.log` in the terminal. The app also
shows a Retry button and recovery hint when its server or proxy engine is
unavailable. The private port setting is not a substitute for application access
controls: do not make the port public or deploy the proxy publicly until access
controls have been added.

## Note

The proxy is intended for local or controlled use. Don’t expose it publicly without adding access controls.
