
const form = document.getElementById("proxy-form");
const input = document.getElementById("url-input");
const home = document.getElementById("home");
const browser = document.getElementById("browser");
const message = document.getElementById("message");
const address = document.getElementById("current-address");
const statuses = document.querySelectorAll(".engine-status-text");
const descriptions = document.querySelectorAll(".engine-description");
const tabList = document.getElementById("tab-list");
const frameHost = document.getElementById("frame-host");
const welcome = document.getElementById("browser-welcome");
const homeButton = document.getElementById("home-button");
const backButton = document.getElementById("back-button");
const forwardButton = document.getElementById("forward-button");
const reloadButton = document.getElementById("reload-button");
const navigateButton = document.getElementById("navigate-button");
const newTabButton = document.getElementById("new-tab");
const fullscreenButton = document.getElementById("fullscreen-button");

let controller;
let tabs = [];
let activeTabId = null;
let nextTabId = 1;
let engineError;

function setEngineStatus(message, details) {
  statuses.forEach((status) => {
    status.textContent = message;
  });
  descriptions.forEach((description) => {
    description.textContent = details;
  });
}

function waitForServiceWorker(registration) {
  const worker =
    registration.active || registration.waiting || registration.installing;

  if (!worker) {
    return Promise.reject(new Error("Scramjet service worker did not install."));
  }

  if (worker.state === "activated") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.removeEventListener("statechange", handleStateChange);
      reject(new Error("Timed out waiting for the browser service worker to start."));
    }, 15000);

    const handleStateChange = () => {
      if (worker.state === "activated") {
        clearTimeout(timeout);
        worker.removeEventListener("statechange", handleStateChange);
        resolve();
      } else if (worker.state === "redundant") {
        clearTimeout(timeout);
        worker.removeEventListener("statechange", handleStateChange);
        reject(new Error("Scramjet service worker failed to activate."));
      }
    };

    worker.addEventListener("statechange", handleStateChange);
    handleStateChange();
  });
}

function ensureScramjetDatabase() {
  const stores = [
    "config",
    "cookies",
    "redirectTrackers",
    "referrerPolicies",
    "publicSuffixList"
  ];

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("$scramjet", 1);

      request.onupgradeneeded = () => {
        const database = request.result;
        stores.forEach((store) => {
          if (!database.objectStoreNames.contains(store)) {
            database.createObjectStore(store);
          }
        });
      };

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const missingStore = stores.find(
          (store) => !database.objectStoreNames.contains(store)
        );
        database.close();

        if (missingStore) {
          reject(new Error(`Scramjet database is missing its "${missingStore}" store.`));
          return;
        }

        resolve();
      };
    });
  }

  function deleteDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase("$scramjet");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(
        new Error("Close other Blurz tabs and reload to repair the browser database.")
      );
    });
  }

  return openDatabase().catch(async (error) => {
    if (
      !(error instanceof Error) ||
      !error.message.startsWith("Scramjet database is missing")
    ) {
      throw error;
    }

    await deleteDatabase();
    return openDatabase();
  });
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId);
}

function renderTabs() {
  tabList.replaceChildren();

  tabs.forEach((tab) => {
    const item = document.createElement("div");
    item.className = `tab-item${tab.id === activeTabId ? " active" : ""}`;

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "tab";
    selectButton.setAttribute("role", "tab");
    selectButton.setAttribute("aria-selected", String(tab.id === activeTabId));
    selectButton.textContent = tab.title;
    selectButton.addEventListener("click", () => activateTab(tab.id));

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "tab-close";
    closeButton.setAttribute("aria-label", `Close ${tab.title}`);
    closeButton.title = `Close ${tab.title}`;
    closeButton.textContent = "×";
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTab(tab.id);
    });

    item.append(selectButton, closeButton);
    tabList.append(item);
  });
}

function activateTab(id) {
  const tab = tabs.find((candidate) => candidate.id === id);
  if (!tab) return;

  activeTabId = id;
  tabs.forEach((candidate) => {
    candidate.container.hidden = candidate.id !== id || !candidate.url;
  });

  address.value = tab.url;
  welcome.hidden = Boolean(tab.url);
  browser.hidden = false;
  home.hidden = true;
  renderTabs();
}

function createTab() {
  const id = nextTabId++;
  const container = document.createElement("div");
  container.className = "browser-frame";
  container.hidden = true;

  const iframe = document.createElement("iframe");
  iframe.title = "Blurz browser tab";
  iframe.referrerPolicy = "no-referrer";
  iframe.setAttribute("scrolling", "yes");
  container.append(iframe);
  frameHost.append(container);

  const tab = {
    id,
    title: "New Tab",
    url: "",
    container,
    iframe,
    frame: controller.createFrame(iframe)
  };

  tab.frame.addEventListener("urlchange", (event) => {
    tab.url = event.url;
    try {
      tab.title = new URL(event.url).hostname || "New Tab";
    } catch {
      tab.title = "New Tab";
    }

    if (activeTabId === tab.id) {
      tab.container.hidden = false;
      address.value = tab.url;
      welcome.hidden = true;
    }

    renderTabs();
  });

  tabs.push(tab);
  activateTab(id);
  address.value = "";
  address.focus();
  return tab;
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;

  const [tab] = tabs.splice(index, 1);
  tab.iframe.src = "about:blank";
  tab.container.remove();

  if (activeTabId === id) {
    const replacement = tabs[Math.min(index, tabs.length - 1)];
    if (replacement) {
      activateTab(replacement.id);
    } else {
      createTab();
    }
  } else {
    renderTabs();
  }
}

async function initializeEngine() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }

  setEngineStatus("Preparing browser engine...", "Checking the browser database.");
  await ensureScramjetDatabase();

  const { ScramjetController } = window.$scramjetLoadController();
  controller = new ScramjetController({
    prefix: "/scramjet/",
    files: {
      wasm: "/vendor/scramjet/scramjet.wasm.wasm",
      all: "/vendor/scramjet/scramjet.all.js",
      sync: "/vendor/scramjet/scramjet.sync.js"
    }
  });
  await controller.init();

  setEngineStatus("Starting browser engine...", "Connecting to the proxy transport.");
  const registration = await navigator.serviceWorker.register(
    "/scramjet/sw.js",
    { scope: "/scramjet/" }
  );
  await waitForServiceWorker(registration);

  const { BareMuxConnection } = window.BareMux || {};
  if (!BareMuxConnection) {
    throw new Error("BareMux failed to load. Reload the page and check /vendor/bare-mux/index.js.");
  }

  const mux = new BareMuxConnection("/vendor/bare-mux/worker.js");
  const websocketProtocol = location.protocol === "https:" ? "wss:" : "ws:";
  await mux.setTransport("/js/epoxy-transport.js", [{
    wisp: `${websocketProtocol}//${location.host}/wisp/`
  }]);

  createTab();
  browser.hidden = true;
  home.hidden = false;
  setEngineStatus("Browser engine ready", "Enter a website or search term to get started.");
  return controller;
}

const engineReady = initializeEngine().catch((error) => {
  engineError = error;
  setEngineStatus("Browser engine unavailable", error.message);
  return null;
});

// Convert input into a valid HTTP or HTTPS URL
function getDestination(value) {
  value = value.trim();

  if (!value) return null;

  let destination;

  try {
    if (/^https?:\/\//i.test(value)) {
      destination = new URL(value);
    } else if (
      /^(localhost|(?:[\w-]+\.)+[\w-]{2,}|(?:\d{1,3}\.){3}\d{1,3})(:\d+)?(?:\/\S*)?$/i.test(value)
    ) {
      destination = new URL("https://" + value);
    } else {
      destination = new URL(
        "https://www.google.com/search?q=" +
        encodeURIComponent(value)
      );
    }

    if (!["http:", "https:"].includes(destination.protocol)) {
      throw new Error("Unsupported address");
    }

    return destination;
  } catch {
    return null;
  }
}

async function navigate(value) {
  const destination = getDestination(value);

  if (!destination) {
    message.textContent = "Please enter a valid website address.";
    return;
  }

  message.textContent = "";
  home.hidden = true;
  browser.hidden = false;
  setEngineStatus("Opening website...", "Waiting for the browser engine.");

  try {
    await engineReady;
    if (!controller) {
      throw engineError || new Error("The browser engine could not start.");
    }

    home.hidden = true;
    browser.hidden = false;
    let tab = getActiveTab();
    if (!tab) {
      tab = createTab();
    }

    welcome.hidden = true;
    address.value = destination.href;
    tab.frame.go(destination.href);
  } catch (error) {
    setEngineStatus("Navigation failed", error.message);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  navigate(input.value);
});

navigateButton.addEventListener("click", () => navigate(address.value));
address.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    navigate(address.value);
  }
});

backButton.addEventListener("click", () => getActiveTab()?.frame.back());
forwardButton.addEventListener("click", () => getActiveTab()?.frame.forward());
reloadButton.addEventListener("click", () => getActiveTab()?.frame.reload());

newTabButton.addEventListener("click", async () => {
  try {
    await engineReady;
    if (!controller) throw engineError || new Error("The browser engine could not start.");
    createTab();
  } catch (error) {
    setEngineStatus("Browser engine unavailable", error.message);
  }
});

homeButton.addEventListener("click", async () => {
  const tab = getActiveTab();
  if (tab) {
    tab.iframe.src = "about:blank";
    tab.url = "";
    tab.title = "New Tab";
    tab.container.hidden = true;
    address.value = "";
    welcome.hidden = false;
    renderTabs();
    return;
  }

  try {
    await engineReady;
    if (!controller) throw engineError || new Error("The browser engine could not start.");
    createTab();
  } catch (error) {
    setEngineStatus("Browser engine unavailable", error.message);
  }
});

document.querySelectorAll(".site-link").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.url));
});

fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await browser.requestFullscreen();
    }
  } catch (error) {
    setEngineStatus("Fullscreen unavailable", error.message);
  }
});

document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement === browser;
  fullscreenButton.textContent = isFullscreen ? "×" : "⛶";
  fullscreenButton.title = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
  fullscreenButton.setAttribute(
    "aria-label",
    isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
  );
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch (error) {
      console.error("App service worker registration failed:", error);
    }
  });
}
