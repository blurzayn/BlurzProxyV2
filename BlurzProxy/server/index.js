const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { server: wisp } = require("@mercuryworkshop/wisp-js/server");
const { configureWispNetworkPolicy } = require("./network-policy");
const { evaluateReadiness } = require("./readiness");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_CODESPACES = process.env.CODESPACES === "true" ||
  Boolean(process.env.CODESPACE_NAME);
const HOST = process.env.HOST || (IS_CODESPACES ? "0.0.0.0" : "127.0.0.1");
const COOKIE = "blurzproxy_session";
const SESSION_TTL = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW = 15 * 60 * 1000;
const LOGIN_MAX = 10;
const API_WINDOW = 60 * 1000;
const API_MAX = 120;
// Authentication may be skipped only for local development. Codespaces and every
// other environment keep the authentication gate enabled.
const AUTH_REQUIRED = process.env.NODE_ENV !== "development" || IS_CODESPACES;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((value) => value.trim()).filter(Boolean);

// Add the exact Codespaces forwarded origin even when the server is started
// directly with "npm start" instead of the Codespaces helper script.
if (IS_CODESPACES && process.env.CODESPACE_NAME &&
    process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
  const codespaceName = process.env.CODESPACE_NAME;
  const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (!/^[a-z0-9-]+$/i.test(codespaceName) ||
      !/^[a-z0-9.-]+$/i.test(forwardingDomain)) {
    throw new Error("Invalid Codespaces forwarded-origin environment.");
  }
  configuredOrigins.push(
    `https://${codespaceName}-3000.${forwardingDomain}`
  );
  // Some Codespaces browser/port-forwarding clients expose the forwarded
  // application as this exact loopback origin. Never trust this insecure
  // origin when NODE_ENV=production.
  if (process.env.NODE_ENV !== "production") {
    configuredOrigins.push("http://localhost:3000");
  }
}
const ALLOWED_ORIGINS = new Set(configuredOrigins.map((value) => {
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new Error("ALLOWED_ORIGINS must contain valid exact origins."); }
  if (!["http:", "https:"].includes(parsed.protocol) ||
      (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") || parsed.origin !== value.replace(/\/$/, "") ||
      parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash ||
      value.includes("*")) {
    throw new Error("ALLOWED_ORIGINS must contain valid exact origins without paths or wildcards.");
  }
  return parsed.origin;
}));
// Codespaces forwards the app over HTTPS, so its session cookie must be Secure
// regardless of a local .env file's COOKIE_SECURE setting.
const COOKIE_SECURE = IS_CODESPACES ? true : process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) throw new RangeError("Invalid PORT.");
if (AUTH_REQUIRED && ADMIN_PASSWORD.length < 16) {
  throw new Error("ADMIN_PASSWORD must be at least 16 characters.");
}
if (process.env.NODE_ENV === "production" &&
    /^(replace-with-|change-me|changeme|password$|test-only)/i.test(ADMIN_PASSWORD)) {
  throw new Error("ADMIN_PASSWORD must be replaced with a unique production secret.");
}
if (!ALLOWED_ORIGINS.size) throw new Error("ALLOWED_ORIGINS must contain exact trusted origins.");
if (process.env.COOKIE_SECURE && !["true", "false"].includes(process.env.COOKIE_SECURE)) {
  throw new Error("COOKIE_SECURE must be true or false.");
}
if (process.env.NODE_ENV === "production" && !COOKIE_SECURE) {
  throw new Error("Production requires COOKIE_SECURE=true and HTTPS.");
}

app.disable("x-powered-by");
app.disable("etag");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);

// Enforce outbound restrictions on the server-side Wisp transport.
configureWispNetworkPolicy(wisp);

const sessions = new Map();
const buckets = new Map();
const websocketSockets = new Set();
const sessionSockets = new Map();
const MAX_WEBSOCKETS_PER_SESSION = 4;
const MAX_WEBSOCKETS_TOTAL = 64;

function closeSessionSockets(token) {
  const sockets = sessionSockets.get(token);
  if (!sockets) return;
  sessionSockets.delete(token);
  for (const socket of sockets) {
    websocketSockets.delete(socket);
    socket.destroy();
  }
}

function logEvent(level, event, details = {}) {
  const record = { timestamp: new Date().toISOString(), level, event, ...details };
  console[level](JSON.stringify(record));
}
// OWASP-recommended scrypt profile: N=2^17, r=8, p=1 (128 MiB).
// Keep verification asynchronous and cap concurrent derivations below.
const SCRYPT_OPTIONS = Object.freeze({
  N: 1 << 17,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024
});
const passwordSalt = AUTH_REQUIRED ? crypto.randomBytes(16) : null;
const passwordDigest = AUTH_REQUIRED
  ? crypto.scryptSync(ADMIN_PASSWORD, passwordSalt, 64, SCRYPT_OPTIONS)
  : null;
let activePasswordChecks = 0;
const MAX_ACTIVE_PASSWORD_CHECKS = 2;

function cookies(header) {
  const result = Object.create(null);
  for (const item of (header || "").split(";")) {
    const index = item.indexOf("=");
    if (index < 1) continue;
    try { result[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim()); }
    catch { /* Ignore malformed cookie values. */ }
  }
  return result;
}
function getSession(req) {
  const token = cookies(req.headers.cookie)[COOKIE];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = sessions.get(token);
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
    sessions.delete(token);
    closeSessionSockets(token);
    return null;
  }
  session.expiresAt = Math.min(now + SESSION_TTL, session.absoluteExpiresAt);
  return { token, session };
}
function setCookie(res, token) {
  res.cookie(COOKIE, token, { httpOnly: true, secure: COOKIE_SECURE,
    sameSite: "strict", path: "/", maxAge: SESSION_TTL });
}
function clearCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, secure: COOKIE_SECURE, sameSite: "strict", path: "/" });
}
function limiter(windowMs, max, prefix) {
  return (req, res, next) => {
    const key = prefix + ":" + (req.ip || req.socket.remoteAddress || "unknown");
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      logEvent("warn", "rate_limit_exceeded", { route: prefix, method: req.method });
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    next();
  };
}
const loginLimiter = limiter(LOGIN_WINDOW, LOGIN_MAX, "login");
const apiLimiter = limiter(API_WINDOW, API_MAX, "api");

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, false);
    if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed."));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  maxAge: 600
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Browser state-changing requests must carry an exact trusted Origin.
app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: "A trusted Origin header is required." });
  }
  next();
});

const loginPage = [
  "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
  "<meta name='viewport' content='width=device-width,initial-scale=1'>",
  "<title>BlurzProxy sign in</title><style>",
  "body{margin:0;min-height:100vh;display:grid;place-items:center;background:#10131b;color:#f4f6fb;font:16px system-ui}",
  "main{width:min(360px,calc(100% - 40px));padding:30px;border:1px solid #303747;border-radius:16px;background:#191f2b}",
  "input,button{box-sizing:border-box;width:100%;padding:12px;border-radius:8px;font:inherit;margin-top:12px}",
  "input{border:1px solid #48536a;background:#10131b;color:white}button{border:0;background:#7c9cff;font-weight:700}",
  "#error{color:#ff9d9d;min-height:20px}</style></head><body><main><h1>BlurzProxy</h1>",
  "<p>Sign in to access this application.</p><form id='login'><label for='password'>Access password</label>",
  "<input id='password' type='password' autocomplete='current-password' required>",
  "<button>Sign in</button><p id='error' role='alert'></p></form><script>",
  "document.getElementById('login').addEventListener('submit',async e=>{e.preventDefault();",
  "const error=document.getElementById('error');const button=e.currentTarget.querySelector('button');",
  "button.disabled=true;error.textContent='';try{const r=await fetch('/auth/login',{method:'POST',",
  "headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('password').value})});",
  "const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||(r.status===429?'Too many attempts. Try later.':'Sign-in failed.'));location.replace('/');",
  "}catch(x){error.textContent=x.message;}finally{button.disabled=false;}});",
  "</script></main></body></html>"
].join("");

app.get("/login", (req, res) => {
  if (!AUTH_REQUIRED || getSession(req)) return res.redirect("/");
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(loginPage);
});
app.post("/auth/login", loginLimiter, async (req, res) => {
  if (!AUTH_REQUIRED) return res.status(404).json({ error: "Authentication is disabled in local development." });
  const origin = req.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    logEvent("warn", "authentication_failed", { reason: "origin_not_allowed" });
    return res.status(403).json({ error: "Origin not allowed." });
  }
  const supplied = typeof req.body?.password === "string" ? req.body.password : "";
  if (activePasswordChecks >= MAX_ACTIVE_PASSWORD_CHECKS) {
    res.setHeader("Retry-After", "2");
    return res.status(429).json({ error: "Authentication is busy. Try again shortly." });
  }

  activePasswordChecks += 1;
  let digest;
  try {
    digest = await new Promise((resolve, reject) => {
      crypto.scrypt(supplied, passwordSalt, 64, SCRYPT_OPTIONS, (error, derivedKey) => {
        if (error) return reject(error);
        resolve(derivedKey);
      });
    });
  } finally {
    activePasswordChecks -= 1;
  }

  if (!crypto.timingSafeEqual(passwordDigest, digest)) {
    logEvent("warn", "authentication_failed", { reason: "invalid_credentials" });
    return res.status(401).json({ error: "Invalid credentials." });
  }
  const token = crypto.randomBytes(32).toString("hex");
  const createdAt = Date.now();
  sessions.set(token, {
    createdAt,
    expiresAt: createdAt + SESSION_TTL,
    absoluteExpiresAt: createdAt + SESSION_TTL
  });
  setCookie(res, token);
  res.setHeader("Cache-Control", "no-store");
  return res.json({ authenticated: true, expiresIn: SESSION_TTL });
});
app.get("/auth/session", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ authenticated: !AUTH_REQUIRED || Boolean(getSession(req)) });
});
app.post("/auth/logout", (req, res) => {
  const current = getSession(req);
  if (current) {
    sessions.delete(current.token);
    closeSessionSockets(current.token);
  }
  clearCookie(res);
  res.json({ authenticated: false });
});

app.get("/healthz", (req, res) => res.json({
  name: "BlurzProxy", status: "ok", uptime: process.uptime()
}));
app.get("/readyz", (req, res) => {
  const ready = evaluateReadiness({ packages, checkPackage, wisp });
  res.status(ready ? 200 : 503).json({
    name: "BlurzProxy", ready, status: ready ? "ready" : "not_ready"
  });
});

// Codespaces and production always require a session. Only local development
// may serve the app without one.
app.use((req, res, next) => {
  if (!AUTH_REQUIRED) return next();
  if (["/healthz", "/readyz", "/login", "/auth/login", "/auth/session", "/auth/logout"].includes(req.path)) {
    return next();
  }
  if (!getSession(req)) {
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Authentication required." });
    return res.redirect(302, "/login");
  }
  if (req.path.startsWith("/api/")) return apiLimiter(req, res, next);
  next();
});

const packages = [
  "@useinterstellar/scramjet",
  "@titaniumnetwork-dev/ultraviolet",
  "@mercuryworkshop/wisp-js",
  "@mercuryworkshop/bare-mux",
  "@mercuryworkshop/epoxy-transport",
  "@mercuryworkshop/libcurl-transport"
];
function checkPackage(name) {
  try {
    const packagePath = path.join(__dirname, "..", "node_modules", name, "package.json");
    const metadata = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return { name, installed: true, version: metadata.version };
  } catch {
    return { name, installed: false, version: null };
  }
}
app.get("/api/status", (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    name: "BlurzProxy", status: "online", version: "1.0.0",
    uptimeSeconds: process.uptime(),
    memoryBytes: { rss: memory.rss, heapUsed: memory.heapUsed }
  });
});
app.get("/api/engines", (req, res) => res.json({
  components: packages.map(checkPackage)
}));

app.use("/vendor/scramjet", express.static(
  path.join(__dirname, "../node_modules/@useinterstellar/scramjet/dist")
));
app.use("/vendor/bare-mux", express.static(
  path.join(__dirname, "../node_modules/@mercuryworkshop/bare-mux/dist")
));
app.use("/vendor/epoxy", express.static(
  path.join(__dirname, "../node_modules/@mercuryworkshop/epoxy-transport/dist")
));
app.use(express.static(path.join(__dirname, "../public"), {
  index: "index.html",
  setHeaders(res) { res.setHeader("Cache-Control", "private, no-store"); }
}));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.message === "Origin not allowed." ? 403
    : Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status : 500;
  if (error.message === "Origin not allowed.") {
    logEvent("warn", "cors_origin_rejected", {
      method: req.method, path: req.path, origin: req.get("origin") || null
    });
  } else if (status >= 500) {
    logEvent("error", "http_request_error", {
      method: req.method, path: req.path, status
    });
  }
  const message = error.message === "Origin not allowed." ? "Origin not allowed."
    : status === 413 ? "Request body exceeds the 1 MB limit."
    : status === 400 ? "Invalid request body." : "Request failed.";
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, HOST, () => {
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : PORT;
  logEvent("info", "server_started", { host: HOST, port });
});
server.on("error", (error) => {
  logEvent("error", "server_start_failed", { message: error.message });
  process.exitCode = 1;
});
server.keepAliveTimeout = 15000;
server.headersTimeout = 20000;
server.requestTimeout = 20000;
server.setTimeout(20000);

server.on("upgrade", (request, socket, head) => {
  const origin = request.headers.origin;
  const current = getSession({ headers: request.headers });
  if (request.url?.split("?")[0] !== "/wisp/" || !origin ||
      !ALLOWED_ORIGINS.has(origin) || (AUTH_REQUIRED && !current)) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  let sockets = current ? sessionSockets.get(current.token) : null;
  if (websocketSockets.size >= MAX_WEBSOCKETS_TOTAL ||
      (sockets && sockets.size >= MAX_WEBSOCKETS_PER_SESSION)) {
    socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nRetry-After: 60\r\n\r\n");
    socket.destroy();
    return;
  }
  websocketSockets.add(socket);
  if (current) {
    if (!sockets) {
      sockets = new Set();
      sessionSockets.set(current.token, sockets);
    }
    sockets.add(socket);
  }
  socket.once("close", () => {
    websocketSockets.delete(socket);
    if (!current) return;
    const activeSockets = sessionSockets.get(current.token);
    if (activeSockets) {
      activeSockets.delete(socket);
      if (!activeSockets.size) sessionSockets.delete(current.token);
    }
  });
  wisp.routeRequest(request, socket, head);
});

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      sessions.delete(token);
      closeSessionSockets(token);
    }
  }
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 60000);
cleanup.unref();

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logEvent("info", "server_shutdown_started", { signal });
  clearInterval(cleanup);
  for (const socket of websocketSockets) socket.destroy();
  websocketSockets.clear();
  server.close(() => {
    logEvent("info", "server_shutdown_complete", { signal });
    process.exit(0);
  });
  setTimeout(() => {
    logEvent("error", "server_shutdown_timeout", { signal });
    process.exit(1);
  }, 10000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
