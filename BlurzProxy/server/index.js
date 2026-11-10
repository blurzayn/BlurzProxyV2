const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { server: wisp } = require("@mercuryworkshop/wisp-js/server");
const { configureWispNetworkPolicy } = require("./network-policy");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const COOKIE = "blurzproxy_session";
const SESSION_TTL = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW = 15 * 60 * 1000;
const LOGIN_MAX = 10;
const API_WINDOW = 60 * 1000;
const API_MAX = 120;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((value) => value.trim()).filter(Boolean);
const ALLOWED_ORIGINS = new Set(configuredOrigins.map((value) => {
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new Error("ALLOWED_ORIGINS must contain valid exact origins."); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== value.replace(/\/$/, "") ||
      parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash ||
      value.includes("*")) {
    throw new Error("ALLOWED_ORIGINS must contain valid exact origins without paths or wildcards.");
  }
  return parsed.origin;
}));
const COOKIE_SECURE = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) throw new RangeError("Invalid PORT.");
if (ADMIN_PASSWORD.length < 16) throw new Error("ADMIN_PASSWORD must be at least 16 characters.");
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
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);

// Enforce outbound restrictions on the server-side Wisp transport.
configureWispNetworkPolicy(wisp);

const sessions = new Map();
const buckets = new Map();
const passwordDigest = crypto.createHash("sha256").update(ADMIN_PASSWORD, "utf8").digest();

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
  if (session.expiresAt <= Date.now()) { sessions.delete(token); return null; }
  session.expiresAt = Date.now() + SESSION_TTL;
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
    if (ALLOWED_ORIGINS.has(origin.replace(/\/$/, ""))) return callback(null, true);
    return callback(new Error("Origin not allowed."));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  maxAge: 600
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

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
  "if(!r.ok)throw Error(r.status===429?'Too many attempts. Try later.':'Sign-in failed.');location.replace('/');",
  "}catch(x){error.textContent=x.message;}finally{button.disabled=false;}});",
  "</script></main></body></html>"
].join("");

app.get("/login", (req, res) => {
  if (getSession(req)) return res.redirect("/");
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(loginPage);
});
app.post("/auth/login", loginLimiter, (req, res) => {
  const origin = req.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin.replace(/\/$/, ""))) {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  const supplied = typeof req.body?.password === "string" ? req.body.password : "";
  const digest = crypto.createHash("sha256").update(supplied, "utf8").digest();
  if (!crypto.timingSafeEqual(passwordDigest, digest)) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL });
  setCookie(res, token);
  res.setHeader("Cache-Control", "no-store");
  return res.json({ authenticated: true, expiresIn: SESSION_TTL });
});
app.get("/auth/session", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ authenticated: Boolean(getSession(req)) });
});
app.post("/auth/logout", (req, res) => {
  const current = getSession(req);
  if (current) sessions.delete(current.token);
  clearCookie(res);
  res.json({ authenticated: false });
});

app.get("/healthz", (req, res) => res.json({
  name: "BlurzProxy", status: "ok", uptime: process.uptime()
}));
app.get("/readyz", (req, res) => {
  const ready = isApplicationReady();
  res.status(ready ? 200 : 503).json({
    name: "BlurzProxy", ready, status: ready ? "ready" : "not_ready"
  });
});

// All app, API and vendor assets require an active session.
app.use((req, res, next) => {
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
function isApplicationReady() {
  const dependenciesReady = packages.every((name) => checkPackage(name).installed);
  const policy = wisp.options;
  const transportReady = typeof wisp.routeRequest === "function" &&
    policy.allow_private_ips === false && policy.allow_loopback_ips === false &&
    policy.allow_direct_ip === false && policy.allow_udp_streams === false &&
    Array.isArray(policy.port_whitelist) &&
    policy.port_whitelist.length === 2 &&
    policy.port_whitelist.includes(80) && policy.port_whitelist.includes(443);
  return dependenciesReady && transportReady;
}
app.get("/api/status", (req, res) => res.json({
  name: "BlurzProxy", status: "online", version: "1.0.0"
}));
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
  if (status >= 500) console.error("Internal HTTP request error.");
  const message = status === 413 ? "Request body exceeds the 1 MB limit."
    : status === 400 ? "Invalid request body." : "Request failed.";
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, HOST, () => {
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : PORT;
  console.log("BlurzProxy running on " + HOST + ":" + port);
});
server.on("error", (error) => {
  console.error("BlurzProxy failed to start: " + error.message);
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
      !ALLOWED_ORIGINS.has(origin.replace(/\/$/, "")) || !current) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  wisp.routeRequest(request, socket, head);
});

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 60000);
cleanup.unref();

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Received " + signal + "; shutting down gracefully.");
  clearInterval(cleanup);
  server.close(() => process.exit(0));
  setTimeout(() => {
    console.log("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
