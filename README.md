# BlurzProxy

A browser-based web proxy powered by Scramjet.

## Self-hosting: everyone runs their own instance

BlurzProxy is designed to be cloned and run independently. You do not need access to the original developer's Codespace or server, and the project does not send every user's browsing through one centrally hosted BlurzProxy server. Each person or organization runs and maintains their own copy, chooses its own access password, and is responsible for its own hosting and network.

For a private instance on your own computer, follow the local setup below. For an instance other people can reach over the internet, use the Docker + Caddy deployment below on a server you control. Do not expose the Node app's port 3000 directly to the public internet.

### Clone the project

```bash
git clone https://github.com/blurzayn/BlurzProxyV2.git
cd BlurzProxyV2/BlurzProxy
```


## Configure access before starting

The server fails closed unless an administrator password and at least one exact trusted browser origin are configured. From the `BlurzProxy` directory, copy the template to your private local environment file, then edit it. Never commit real secrets:

```bash
cp .env.example .env
```

Set the values in `.env` (not in the template):

```dotenv
ADMIN_PASSWORD=replace-with-a-random-secret-at-least-16-characters-long
ALLOWED_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
```

Use a randomly generated password of at least 16 characters. In production, serve the app over HTTPS and set `COOKIE_SECURE=true`. Add the exact HTTPS origin (scheme, host, and any non-default port) to `ALLOWED_ORIGINS`; separate multiple origins with commas and do not use wildcards. Set `TRUST_PROXY=true` only behind a trusted reverse proxy that overwrites forwarded client-IP headers.

Open `/login` and sign in with `ADMIN_PASSWORD`. Sessions use an HttpOnly, SameSite=Strict cookie with an eight-hour maximum lifetime. Sessions and rate-limit counters are stored in process memory and are cleared on restart. Run a single application instance unless you add shared session and rate-limit storage; otherwise sessions and limits will not be consistent across instances.

**Account model:** this version uses one instance-wide administrator/access password, not separate user accounts. Everyone who uses the same instance signs in with that password. Only share it with people you trust; if you want different people to have separate credentials, that requires a separate account-management feature. The intended self-hosting model is for each person or organization to run their own isolated instance.

## Run it

Install [Node.js](https://nodejs.org/), then run:

```bash
npm ci
npx playwright install chromium
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

## GitHub Codespaces (private development use)

Codespaces is a development environment, not an always-on production host. Use it to develop and test BlurzProxy; do not treat a forwarded port as a permanent public deployment.

1. In the repository on GitHub, open **Settings → Secrets and variables → Codespaces** and create a Codespaces secret named `ADMIN_PASSWORD`. Use a unique random value of at least 16 characters. Do not put the value in this repository, a committed `.env` file, terminal output, or screenshots.
2. Rebuild or restart the Codespace so the secret is available to its environment.
3. The dev container binds to `0.0.0.0` inside the Codespace and configures port 3000 as **Private** with HTTPS forwarding. Keep it Private in the Ports panel; never change it to Public.
4. The startup script derives the exact forwarded origin from GitHub's `CODESPACE_NAME` and `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` variables. You normally do not need to set `ALLOWED_ORIGINS` yourself. If you explicitly set it, it must exactly match the forwarded HTTPS origin.
5. Start or restart the app from `BlurzProxy/` with `npm run start:codespaces`. This command derives the exact forwarded HTTPS origin, binds to `0.0.0.0` inside Codespaces, and writes startup diagnostics to `/tmp/blurzproxy.log`. Do not use plain `npm start` in Codespaces because it does not derive the forwarded origin.
6. Open the forwarded port URL and sign in with the secret value.

GitHub documents that private forwarded ports require GitHub authentication, while public ports can be reached by anyone who knows the URL. The app's own password remains required as a second access control. The unauthenticated `/healthz` and `/readyz` endpoints only report service status and do not grant application access.

Stop the Codespace when finished. Its runtime and forwarded URL are not an always-on service, and in-memory sessions are cleared when the server restarts.


## Production deployment (Docker + Caddy)

The example deployment keeps the Node application off the host's published ports. Only Caddy publishes ports 80/443; Caddy forwards HTTP and WebSocket traffic over the private Docker backend network. Caddy obtains and renews HTTPS certificates automatically.

1. Point your domain's DNS A/AAAA records at the deployment host.
2. Create a deployment-only `.env` file in `BlurzProxy/` (never commit it):

   ```dotenv
   DOMAIN=proxy.example.com
   ADMIN_PASSWORD=replace-with-a-random-secret-at-least-16-characters-long
   ```

3. Start the stack from the `BlurzProxy` directory:

   ```bash
   docker compose up --build -d
   ```

The app container has no `ports` mapping. Its port 3000 is only exposed to the backend Docker network, while Caddy is the only service publishing public web ports. The app binds to `0.0.0.0` only inside that isolated container network so Caddy can reach it; do not publish port 3000 on the host or attach the app to a public ingress network. The default non-container server bind is `127.0.0.1`.

The server-side Wisp policy permits TCP web traffic only on ports 80/443, disables UDP and direct-IP destinations, blocks loopback/private IP destinations, blocks common internal/metadata hostnames, and caps concurrent streams. This is a baseline safeguard, not a replacement for host/cloud egress controls: configure the deployment firewall to deny outbound connections to private, loopback, link-local, multicast, and cloud-metadata ranges, and allow only the DNS and public web egress your deployment needs. Do not attach administrative services or control-plane interfaces to the app's network.

Keep the deployment `.env` outside version control, use a unique high-entropy password, and allow inbound 80/443 only. The app's `/healthz` endpoint is intentionally unauthenticated for container health checks and must not be treated as an application API.
