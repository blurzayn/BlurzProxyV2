const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { server: wisp } = require("@mercuryworkshop/wisp-js/server");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
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
      process.cwd(),
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

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`BlurzProxy running on port ${PORT}`);
});

server.on("upgrade", (request, socket, head) => {
  if (request.url?.split("?")[0] !== "/wisp/") {
    socket.destroy();
    return;
  }

  wisp.routeRequest(request, socket, head);
});
