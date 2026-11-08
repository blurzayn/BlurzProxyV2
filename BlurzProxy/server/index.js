const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { server: wisp } = require("@mercuryworkshop/wisp-js/server");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new RangeError("PORT must be an integer between 0 and 65535.");
}

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../public")));

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
    const packagePath = path.join(
      __dirname,
      "..",
      "node_modules",
      name,
      "package.json"
    );

    const metadata = JSON.parse(fs.readFileSync(packagePath, "utf8"));

    return {
      name,
      installed: true,
      version: metadata.version
    };
  } catch {
    return {
      name,
      installed: false,
      version: null
    };
  }
}

app.get("/api/status", (req, res) => {
  res.json({
    name: "BlurzProxy",
    status: "online",
    version: "1.0.0"
  });
});

app.get("/healthz", (req, res) => {
  res.json({
    name: "BlurzProxy",
    status: "ok",
    uptime: process.uptime()
  });
});

app.get("/readyz", (req, res) => {
  res.json({
    name: "BlurzProxy",
    ready: true,
    status: "online"
  });
});

app.get("/api/engines", (req, res) => {
  res.json({
    components: packages.map(checkPackage)
  });
});
app.use(
  "/vendor/scramjet",
  express.static(
    path.join(
      __dirname,
      "../node_modules/@useinterstellar/scramjet/dist"
    )
  )
);
app.use(
  "/vendor/bare-mux",
  express.static(
    path.join(__dirname, "../node_modules/@mercuryworkshop/bare-mux/dist")
  )
);
app.use(
  "/vendor/epoxy",
  express.static(
    path.join(__dirname, "../node_modules/@mercuryworkshop/epoxy-transport/dist")
  )
);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500;
  if (status >= 500) {
    console.error("Internal HTTP request error.");
  }

  const message = status === 413
    ? "Request body exceeds the 1 MB limit."
    : status === 400
      ? "Invalid request body."
      : "Request failed.";
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, HOST, () => {
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : PORT;
  console.log(`BlurzProxy running on ${HOST}:${port}`);
});

server.on("error", (error) => {
  console.error(`BlurzProxy failed to start: ${error.message}`);
  process.exitCode = 1;
});

server.keepAliveTimeout = 15000;
server.headersTimeout = 20000;
server.requestTimeout = 20000;
server.setTimeout(20000);

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down gracefully.`);
  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    console.log("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.on("upgrade", (request, socket, head) => {
  if (request.url?.split("?")[0] !== "/wisp/") {
    socket.destroy();
    return;
  }

  wisp.routeRequest(request, socket, head);
});
