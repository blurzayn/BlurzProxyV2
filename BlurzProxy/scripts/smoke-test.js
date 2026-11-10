const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const net = require("node:net");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { configureWispNetworkPolicy } = require("../server/network-policy");
const { evaluateReadiness } = require("../server/readiness");

const serverPath = path.join(__dirname, "..", "server", "index.js");
let server;
let baseUrl;
let serverOutput = "";
let sessionCookiePromise;

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

async function getTestSessionCookie() {
  if (!sessionCookiePromise) {
    sessionCookiePromise = (async () => {
      const login = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: baseUrl },
        body: JSON.stringify({ password: "test-only-password-12345" })
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.get("set-cookie")?.split(";")[0];
      assert.ok(cookie, "login should issue a session cookie");
      return cookie;
    })();
  }
  return sessionCookiePromise;
}

async function authenticatedFetch(url, options = {}) {
  const cookie = await getTestSessionCookie();
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), cookie }
  });
}

async function websocketUpgrade(origin, cookie) {
  const port = Number(new URL(baseUrl).port);
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    let response = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error("WebSocket upgrade timed out."));
    }, 3000);

    socket.once("connect", () => {
      const headers = [
        "GET /wisp/ HTTP/1.1",
        `Host: 127.0.0.1:${port}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
        "Sec-WebSocket-Version: 13",
        `Origin: ${origin}`
      ];
      if (cookie) headers.push(`Cookie: ${cookie}`);
      socket.write(headers.join("\r\n") + "\r\n\r\n");
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (!response.includes("\r\n\r\n") || settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ response, socket });
    });
    socket.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    socket.once("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error("Socket closed before the upgrade response."));
    });
  });
}

async function launchIsolatedServer(port) {
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      ADMIN_PASSWORD: "test-only-password-12345",
      ALLOWED_ORIGINS: url,
      COOKIE_SECURE: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Isolated server exited.\n${output}`);
    try {
      const response = await fetch(`${url}/healthz`, {
        cache: "no-store",
        signal: AbortSignal.timeout(500)
      });
      if (response.ok) return { child, url, getOutput: () => output };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  child.kill("SIGKILL");
  throw new Error(`Isolated server did not become healthy.\n${output}`);
}

async function stopIsolatedServer(instance) {
  if (instance.child.exitCode !== null || instance.child.signalCode !== null) return;
  instance.child.kill("SIGTERM");
  await Promise.race([
    once(instance.child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 4000))
  ]);
  if (instance.child.exitCode === null && instance.child.signalCode === null) {
    instance.child.kill("SIGKILL");
    await once(instance.child, "exit");
  }
}


test("readiness fails when a required dependency or restricted transport is unavailable", () => {
  const packages = ["required-package"];
  const checkPackage = () => ({ installed: true });
  const wisp = {
    routeRequest() {},
    options: {
      allow_private_ips: false,
      allow_loopback_ips: false,
      allow_direct_ip: false,
      allow_udp_streams: false,
      port_whitelist: [80, 443]
    }
  };

  assert.equal(evaluateReadiness({ packages, checkPackage, wisp }), true);
  assert.equal(evaluateReadiness({
    packages, checkPackage: () => ({ installed: false }), wisp
  }), false);
  assert.equal(evaluateReadiness({
    packages, checkPackage, wisp: { options: wisp.options }
  }), false);
  assert.equal(evaluateReadiness({
    packages, checkPackage, wisp: {
      ...wisp,
      options: { ...wisp.options, allow_private_ips: true }
    }
  }), false);
});

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
  assert.equal(options.dns_ttl, 30);
  assert.equal(options.dns_cache_size, 1024);
  assert.equal(options.parse_real_ip, false);
  assert.deepEqual(options.parse_real_ip_from, []);
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

  const insecureOrigin = spawnSync(process.execPath, [serverPath], {
    cwd: path.join(__dirname, ".."),
    env: { ...baseEnv, ADMIN_PASSWORD: "a-unique-production-secret-long-enough", ALLOWED_ORIGINS: "http://proxy.example.com" },
    encoding: "utf8",
    timeout: 3000
  });
  assert.notEqual(insecureOrigin.status, 0);
  assert.match(insecureOrigin.stderr, /exact origins/);
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


test("Wisp WebSocket upgrades require an approved origin and an authenticated session", async () => {
  const rejectedOrigin = await websocketUpgrade("https://untrusted.example");
  assert.match(rejectedOrigin.response, /^HTTP\/1\.1 403/);
  rejectedOrigin.socket.destroy();

  const missingSession = await websocketUpgrade(baseUrl);
  assert.match(missingSession.response, /^HTTP\/1\.1 403/);
  missingSession.socket.destroy();

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ password: "test-only-password-12345" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const accepted = await websocketUpgrade(baseUrl, cookie);
  assert.match(accepted.response, /^HTTP\/1\.1 101/);
  accepted.socket.destroy();
});

test("logging out immediately closes WebSockets authenticated by that session", async () => {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ password: "test-only-password-12345" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const active = await websocketUpgrade(baseUrl, cookie);
  assert.match(active.response, /^HTTP\\/1\\.1 101/);
  const closed = once(active.socket, "close");
  const logout = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { cookie, origin: baseUrl }
  });
  assert.equal(logout.status, 200);
  await Promise.race([
    closed,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Session logout did not close its WebSocket.")), 2000))
  ]);
});

test("Wisp limits concurrent WebSockets per authenticated session", async () => {
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ password: "test-only-password-12345" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const sockets = [];
  try {
    for (let count = 0; count < 4; count += 1) {
      const upgraded = await websocketUpgrade(baseUrl, cookie);
      assert.match(upgraded.response, /^HTTP\\/1\\.1 101/);
      sockets.push(upgraded.socket);
    }
    const limited = await websocketUpgrade(baseUrl, cookie);
    assert.match(limited.response, /^HTTP\\/1\\.1 429/);
    limited.socket.destroy();
  } finally {
    for (const socket of sockets) socket.destroy();
  }
});

test("server shuts down cleanly and can restart on the same port", async () => {
  const port = await getFreePort();
  const first = await launchIsolatedServer(port);
  await stopIsolatedServer(first);
  assert.equal(first.child.exitCode, 0);
  assert.match(first.getOutput(), /"event":"server_shutdown_complete"/);

  const second = await launchIsolatedServer(port);
  try {
    const response = await fetch(`${second.url}/healthz`);
    assert.equal(response.status, 200);
  } finally {
    await stopIsolatedServer(second);
  }
  assert.equal(second.child.exitCode, 0);
});

test("CORS rejects non-exact Origin values", async () => {
  const response = await fetch(`${baseUrl}/api/status`, {
    headers: { origin: `${baseUrl}/` }
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.has("access-control-allow-origin"), false);
});

test("state-changing requests reject missing and untrusted origins", async () => {
  const missingOrigin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "test-only-password-12345" })
  });
  assert.equal(missingOrigin.status, 403);

  const untrustedOrigin = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { origin: "https://untrusted.example" }
  });
  assert.equal(untrustedOrigin.status, 403);
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
    method: "POST", headers: { cookie, origin: baseUrl }
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
  const status = await authenticatedStatus.json();
  assert.equal(status.name, "BlurzProxy");
  assert.equal(status.status, "online");
  assert.equal(status.version, "1.0.0");
  assert.equal(typeof status.uptimeSeconds, "number");
  assert.equal(typeof status.memoryBytes.rss, "number");
  assert.equal(typeof status.memoryBytes.heapUsed, "number");
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
    status: "ready"
  });
  assert.equal(healthResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(healthResponse.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(healthResponse.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(healthResponse.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
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
