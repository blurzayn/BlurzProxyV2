const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const net = require("node:net");
const path = require("node:path");
const { after, before, test } = require("node:test");

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
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
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
      const response = await fetch(`${baseUrl}/api/status`, {
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

test("status, liveness, and readiness endpoints return healthy payloads", async () => {
  const [statusResponse, healthResponse, readyResponse] = await Promise.all([
    fetch(`${baseUrl}/api/status`),
    fetch(`${baseUrl}/healthz`),
    fetch(`${baseUrl}/readyz`)
  ]);

  assert.equal(statusResponse.status, 200);
  assert.deepEqual(await statusResponse.json(), {
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
  const response = await fetch(`${baseUrl}/api/engines`);
  assert.equal(response.status, 200);
  const { components } = await response.json();
  assert.ok(Array.isArray(components));
  assert.ok(components.length >= 5);
  assert.ok(components.every((component) => component.installed && component.version));
});

test("homepage and browser assets are served with the new browser actions", async () => {
  const [homeResponse, appResponse, cssResponse, workerResponse] = await Promise.all([
    fetch(`${baseUrl}/`),
    fetch(`${baseUrl}/js/app.js`),
    fetch(`${baseUrl}/css/style.css`),
    fetch(`${baseUrl}/sw.js`)
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
    /<select id="theme-select">[\s\S]*?value="red"[\s\S]*?value="orange"[\s\S]*?value="yellow"[\s\S]*?value="green"[\s\S]*?value="blue"[\s\S]*?value="purple" selected/
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
  const malformedResponse = await fetch(`${baseUrl}/api/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid"
  });
  assert.equal(malformedResponse.status, 400);
  assert.deepEqual(await malformedResponse.json(), { error: "Invalid request body." });

  const oversizedResponse = await fetch(`${baseUrl}/api/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: "x".repeat(1024 * 1024) })
  });
  assert.equal(oversizedResponse.status, 413);
  assert.deepEqual(await oversizedResponse.json(), {
    error: "Request body exceeds the 1 MB limit."
  });
});
