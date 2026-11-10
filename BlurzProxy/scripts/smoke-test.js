const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const net = require("node:net");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { configureWispNetworkPolicy } = require("../server/network-policy");

const serverPath = path.join(__dirname, "..", "server", "index.js");
let server;
let baseUrl;
let serverOutput = "";

async function getFreePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => {
    probe.close((error) => error ? reject(error) : resolve());
  });
  return port;
}

async function startServer() {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), ADMIN_PASSWORD: "test-only-password-12345", ALLOWED_ORIGINS: baseUrl, COOKIE_SECURE: "false" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited during startup.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/healthz`, {
        cache: "no-store",
        signal: AbortSignal.timeout(1000)
      });
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Server did not become ready.\n${serverOutput}`);
}

async function authenticatedFetch(url, options = {}) {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ password: "test-only-password-12345" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "login should issue a session cookie");
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), cookie }
  });
}

test("Wisp transport blocks private infrastructure and non-web services", () => {
  const wisp = { options: {} };
  const options = configureWispNetworkPolicy(wisp);

  assert.equal(options.allow_private_ips, false);
  assert.equal(options.allow_loopback_ips, false);
  assert.equal(options.allow_direct_ip, false);
  assert.equal(options.allow_udp_streams, false);
  assert.equal(options.allow_tcp_streams, true);
  assert.deepEqual(options.port_whitelist, [80, 443]);
  assert.equal(options.stream_limit_per_host, 16);
  assert.equal(options.stream_limit_total, 64);
  assert.ok(options.hostname_blacklist.some((pattern) => pattern.test("localhost")));
  assert.ok(options.hostname_blacklist.some((pattern) => pattern.test("metadata.google.internal")));
  assert.ok(options.hostname_blacklist.some((pattern) => pattern.test("service.internal")));
});

test("production startup rejects placeholder secrets and wildcard origins", () => {
  const baseEnv = {
    ...process.env,
    NODE_ENV: "production",
    ADMIN_PASSWORD: "replace-with-a-random-secret-at-least-16-characters-long",
    ALLOWED_ORIGINS: "https://proxy.example.com",
    COOKIE_SECURE: "true"
  };
  const placeholder = spawnSync(process.execPath, [serverPath], {
    cwd: path.join(__dirname, ".."),
    env: baseEnv,
    encoding: "utf8",
    timeout: 3000
  });
  assert.notEqual(placeholder.status, 0);
  assert.match(placeholder.stderr, /unique production secret/);

  const wildcard = spawnSync(process.execPath, [serverPath], {
    cwd: path.join(__dirname, ".."),
    env: { ...baseEnv, ADMIN_PASSWORD: "a-unique-production-secret-long-enough", ALLOWED_ORIGINS: "https://*.example.com" },
    encoding: "utf8",
    timeout: 3000
  });
  assert.notEqual(wildcard.status, 0);
  assert.match(wildcard.stderr, /exact origins/);
});

before(startServer);

after(async () => {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;

  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 3000))
  ]);
  if (server.exitCode === null && server.signalCode === null) {
    server.kill("SIGKILL");
    await once(server, "exit");
  }
});

test("authentication rejects bad credentials and manages session cookies", async () => {
  const deniedOrigin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://untrusted.example" },
    body: JSON.stringify({ password: "test-only-password-12345" })
  });
  assert.equal(deniedOrigin.status, 403);

  const badLogin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ password: "incorrect-password" })
  });
  assert.equal(badLogin.status, 401);

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ password: "test-only-password-12345" })
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  assert.match(setCookie, /Path=\//i);
  const cookie = setCookie.split(";")[0];

  const session = await fetch(`${baseUrl}/auth/session`, { headers: { cookie } });
  assert.deepEqual(await session.json(), { authenticated: true });

  const logout = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST", headers: { cookie }
  });
  assert.deepEqual(await logout.json(), { authenticated: false });
  const afterLogout = await fetch(`${baseUrl}/api/status`, { headers: { cookie } });
  assert.equal(afterLogout.status, 401);
});

test("status, liveness, and readiness endpoints return healthy payloads", async () => {
  const [statusResponse, healthResponse, readyResponse] = await Promise.all([
    fetch(`${baseUrl}/api/status`),
    fetch(`${baseUrl}/healthz`),
    fetch(`${baseUrl}/readyz`)
  ]);

  assert.equal(statusResponse.status, 401);
  const authenticatedStatus = await authenticatedFetch(`${baseUrl}/api/status`);
  assert.equal(authenticatedStatus.status, 200);
  assert.deepEqual(await authenticatedStatus.json(), {
    name: "BlurzProxy",
    status: "online",
    version: "1.0.0"
  });
  assert.equal(statusResponse.headers.has("x-powered-by"), false);

  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.name, "BlurzProxy");
  assert.equal(health.status, "ok");
  assert.equal(typeof health.uptime, "number");
  assert.ok(health.uptime >= 0);

  assert.equal(readyResponse.status, 200);
  assert.deepEqual(await readyResponse.json(), {
    name: "BlurzProxy",
    ready: true,
    status: "online"
  });
});

test("engine status lists required browser dependencies", async () => {
  const response = await authenticatedFetch(`${baseUrl}/api/engines`);
  assert.equal(response.status, 200);
  const { components } = await response.json();
  assert.ok(Array.isArray(components));
  assert.ok(components.length >= 5);
  assert.ok(components.every((component) => component.installed && component.version));
});

test("homepage and browser assets are served with the new browser actions", async () => {
  const [homeResponse, appResponse, cssResponse, workerResponse] = await Promise.all([
    authenticatedFetch(`${baseUrl}/`),
    authenticatedFetch(`${baseUrl}/js/app.js`),
    authenticatedFetch(`${baseUrl}/css/style.css`),
    authenticatedFetch(`${baseUrl}/sw.js`)
  ]);
  assert.equal(homeResponse.status, 200);
  assert.equal(appResponse.status, 200);
  assert.equal(cssResponse.status, 200);
  assert.equal(workerResponse.status, 200);

  const [home, app, css, worker] = await Promise.all([
    homeResponse.text(),
    appResponse.text(),
    cssResponse.text(),
    workerResponse.text()
  ]);
  assert.doesNotMatch(home, /id="(?:duplicate-tab|reopen-tab)"/);
  assert.match(home, /id="copy-address"/);
  assert.match(
    home,
    /<select id="theme-select">[\s\S]*?value="purple" selected[\s\S]*?value="blue"[\s\S]*?value="red"[\s\S]*?value="orange"[\s\S]*?value="yellow"[\s\S]*?value="green"/
  );
  assert.match(home, /BlurzProxy always opens on the homepage/);
  assert.match(home, /id="restore-open-tabs"/);
  assert.match(worker, /blurz-app-v11/);
  assert.match(app, /async function reopenClosedTab\(\)/);
  assert.match(app, /keys: "Ctrl\+Shift\+T"/);
  assert.match(app, /async function copyCurrentAddress\(\)/);
  assert.doesNotMatch(app, /if \(restoredOpenTabs\.length\)/);
  assert.match(css, /\.browser-action-feedback/);
});

test("malformed and oversized JSON requests receive bounded error responses", async () => {
  const malformedResponse = await authenticatedFetch(`${baseUrl}/api/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid"
  });
  assert.equal(malformedResponse.status, 400);
  assert.deepEqual(await malformedResponse.json(), { error: "Invalid request body." });

  const oversizedResponse = await authenticatedFetch(`${baseUrl}/api/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: "x".repeat(1024 * 1024) })
  });
  assert.equal(oversizedResponse.status, 413);
  assert.deepEqual(await oversizedResponse.json(), {
    error: "Request body exceeds the 1 MB limit."
  });
});
