const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const net = require("node:net");
const { after, before, test } = require("node:test");

const PASSWORD = "test-only-password-12345";
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
  server = spawn(process.execPath, ["server/index.js"], {
    cwd: require("node:path").join(__dirname, ".."),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      ADMIN_PASSWORD: PASSWORD,
      ALLOWED_ORIGINS: baseUrl,
      CODESPACES: "true",
      CODESPACE_NAME: "test-codespace",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
      COOKIE_SECURE: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

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

async function login() {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ password: PASSWORD })
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "login should issue a session cookie");
  return cookie;
}

function websocketStatus({ origin, cookie, path = "/wisp/" }) {
  const target = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const socket = net.connect({
      host: target.hostname,
      port: Number(target.port)
    });
    let response = "";
    let settled = false;
    const finish = (error, status) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(status);
    };

    socket.setTimeout(3000, () => {
      finish(new Error("WebSocket upgrade did not receive an HTTP response."));
    });
    socket.on("connect", () => {
      const headers = [
        `GET ${path} HTTP/1.1`,
        `Host: ${target.host}`,
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
      response += chunk.toString();
      if (response.includes("\r\n\r\n")) {
        finish(null, response.split("\r\n", 1)[0]);
      }
    });
    socket.on("error", (error) => {
      if (response) finish(null, response.split("\r\n", 1)[0]);
      else finish(error);
    });
    socket.on("close", () => {
      if (!settled && response) finish(null, response.split("\r\n", 1)[0]);
      else if (!settled) finish(new Error("Socket closed without an HTTP response."));
    });
  });
}

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

test("WebSocket upgrades reject missing sessions and untrusted origins", async () => {
  const unauthenticated = await websocketStatus({ origin: baseUrl });
  assert.match(unauthenticated, /^HTTP\/1\.1 403\b/);

  const cookie = await login();
  const untrustedOrigin = await websocketStatus({
    origin: "https://untrusted.example",
    cookie
  });
  assert.match(untrustedOrigin, /^HTTP\/1\.1 403\b/);

  const wrongPath = await websocketStatus({
    origin: baseUrl,
    cookie,
    path: "/wisp/extra"
  });
  assert.match(wrongPath, /^HTTP\/1\.1 403\b/);
});

test("CORS allows configured and exact Codespaces origins, and rejects untrusted origins", async () => {
  const cookie = await login();
  const allowedOrigins = [
    baseUrl,
    "https://localhost:3000",
    "https://test-codespace-3000.app.github.dev"
  ];

  for (const origin of allowedOrigins) {
    const allowed = await fetch(`${baseUrl}/api/status`, {
      headers: { cookie, origin }
    });
    assert.equal(allowed.status, 200, `expected ${origin} to be allowed`);
    assert.equal(allowed.headers.get("access-control-allow-origin"), origin);
    assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
  }

  const denied = await fetch(`${baseUrl}/api/status`, {
    headers: { cookie, origin: "https://untrusted.example" }
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.has("access-control-allow-origin"), false);
});

test("login rate limiter returns 429 after ten attempts in the window", async () => {
  // Two successful logins above consumed two slots in this test process.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ password: "incorrect-password" })
    });
    assert.equal(response.status, 401);
  }

  const limited = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ password: "incorrect-password" })
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
});
