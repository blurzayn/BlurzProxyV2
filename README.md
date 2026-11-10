# BlurzProxy

A browser-based web proxy powered by Scramjet.

## Configure access before starting

The server fails closed unless an administrator password and at least one exact trusted browser origin are configured. Create `BlurzProxy/.env` from this template and never commit real secrets:

```dotenv
ADMIN_PASSWORD=replace-with-a-random-secret-at-least-16-characters-long
ALLOWED_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
```

Use a randomly generated password of at least 16 characters. In production, serve the app over HTTPS and set `COOKIE_SECURE=true`. Add the exact HTTPS origin (scheme, host, and any non-default port) to `ALLOWED_ORIGINS`; separate multiple origins with commas and do not use wildcards. Set `TRUST_PROXY=true` only behind a trusted reverse proxy that overwrites forwarded client-IP headers.

Open `/login` and sign in with `ADMIN_PASSWORD`. Sessions use an HttpOnly, SameSite=Strict cookie with an eight-hour sliding expiration. Sessions and rate-limit counters are stored in process memory and are cleared on restart. Run a single application instance unless you add shared session and rate-limit storage; otherwise sessions and limits will not be consistent across instances.

## Run it

Install [Node.js](https://nodejs.org/), then run:

```bash
cd BlurzProxyV2/BlurzProxy
npm ci
npx playwright install chromium
npm test
npm run check
npm start
```

Open `http://localhost:3000` and sign in using the configured password.

`npm test` runs server integration tests. `npm run check` also launches Chromium and tests homepage-first startup, manual tab restore, proxy navigation, bookmarks, keyboard shortcuts, keyboard focus, 320px/390px mobile layouts, and automated WCAG 2.1 AA checks for every theme. On Linux, install Chromium's system libraries once with:

```bash
npx playwright install-deps chromium
```

## Security and monitoring

- `/healthz` and `/readyz` are unauthenticated liveness/readiness checks only.
- `/api/status` and `/api/engines` require a valid session.
- The application, vendor assets, API routes, and `/wisp/` WebSocket transport require authentication. WebSocket upgrades additionally require an exact allowlisted `Origin`.
- CORS is restricted to `ALLOWED_ORIGINS`; login and API requests have per-IP rate limits.
- Parsed request bodies are limited to 1 MB and HTTP request/header timeouts are configured.

## GitHub Codespaces

Configure `ADMIN_PASSWORD` and `ALLOWED_ORIGINS` as Codespaces secrets or environment variables before starting the server. Include the exact forwarded Codespaces origin in `ALLOWED_ORIGINS`. Keep port 3000 private. The startup check uses `/healthz`, which intentionally remains public for readiness probes and does not grant application access.

