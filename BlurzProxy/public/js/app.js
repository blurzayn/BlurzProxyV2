
const form = document.getElementById("proxy-form");
const input = document.getElementById("url-input");
const home = document.getElementById("home");
const browser = document.getElementById("browser");
const message = document.getElementById("message");
const address = document.getElementById("current-address");
const statuses = document.querySelectorAll(".engine-status-text");
const descriptions = document.querySelectorAll(".engine-description");
const tabList = document.getElementById("tab-list");
const tabSearch = document.getElementById("tab-search");
const tabSearchStatus = document.getElementById("tab-search-status");
const frameHost = document.getElementById("frame-host");
const welcome = document.getElementById("browser-welcome");
const homeButton = document.getElementById("home-button");
const backButton = document.getElementById("back-button");
const forwardButton = document.getElementById("forward-button");
const reloadButton = document.getElementById("reload-button");
const navigateButton = document.getElementById("navigate-button");
const newTabButton = document.getElementById("new-tab");
const fullscreenButton = document.getElementById("fullscreen-button");
const bookmarkButton = document.getElementById("bookmark-button");
const bookmarkList = document.getElementById("bookmark-list");
const bookmarkEmpty = document.getElementById("bookmark-empty");
const bookmarkSearch = document.getElementById("bookmark-search");
const bookmarkFolderFilter = document.getElementById("bookmark-folder-filter");
const bookmarkFolderSelect = document.getElementById("bookmark-folder-select");
const bookmarkFolderSettings = document.getElementById("bookmark-folder-settings");
const newBookmarkFolderInput = document.getElementById("new-bookmark-folder");
const addBookmarkFolderButton = document.getElementById("add-bookmark-folder");
const recentHistoryList = document.getElementById("recent-history-list");
const recentHistoryEmpty = document.getElementById("recent-history-empty");
const clearHistoryButton = document.getElementById("clear-history");
const clearHistoryOnExitSetting = document.getElementById("clear-history-on-exit");
const savedSessionSelect = document.getElementById("saved-session-select");
const savedSessionNameInput = document.getElementById("saved-session-name");
const saveSessionButton = document.getElementById("save-session");
const loadSessionButton = document.getElementById("load-session");
const deleteSessionButton = document.getElementById("delete-session");
const shortcutBindingList = document.getElementById("shortcut-binding-list");
const closeBrowserButton = document.getElementById("close-browser");
const bookmarkFeedback = document.getElementById("bookmark-feedback");
const copyAddressButton = document.getElementById("copy-address");
const browserActionFeedback = document.getElementById("browser-action-feedback");
const settingsButton = document.getElementById("settings-button");
const settingsPanel = document.getElementById("settings-panel");
const restoreOpenTabsButton = document.getElementById("restore-open-tabs");
const themeSelect = document.getElementById("theme-select");
const accentColorPicker = document.getElementById("accent-color-picker");
const searchEngineSelect = document.getElementById("search-engine-select");
const linkBehaviorSelect = document.getElementById("link-behavior-select");
const reduceMotionSetting = document.getElementById("reduce-motion-setting");
const popularSiteSettings = document.getElementById("popular-site-settings");
const customShortcutForm = document.getElementById("custom-shortcut-form");
const shortcutNameInput = document.getElementById("shortcut-name");
const shortcutUrlInput = document.getElementById("shortcut-url");
const clearProxyDataButton = document.getElementById("clear-proxy-data");
const clearDataScope = document.getElementById("clear-data-scope");
const exportSettingsButton = document.getElementById("export-settings");
const importSettingsButton = document.getElementById("import-settings");
const settingsFileInput = document.getElementById("settings-file");
const settingsMessage = document.getElementById("settings-message");
const proxyStatus = document.getElementById("proxy-status");
const proxyStatusText = document.getElementById("proxy-status-text");
const proxyRetryButton = document.getElementById("proxy-retry");
const proxyRecovery = document.getElementById("proxy-recovery");
const proxyConnectionTestButton = document.getElementById("proxy-connection-test");
const proxyConnectionResult = document.getElementById("proxy-connection-result");
const sidebarToggle = document.getElementById("sidebar-toggle");
const browserWorkspace = document.querySelector(".browser-workspace");
const browserSidebar = document.getElementById("browser-sidebar");
const closeOtherTabsButton = document.getElementById("close-other-tabs");
let siteButtons = Array.from(browserSidebar.querySelectorAll(".site-link"));
const builtInSiteIds = siteButtons.map((button) => button.dataset.siteId);
let siteIds = [...builtInSiteIds];

let controller;
let tabs = [];
let closedTabs = [];
let activeTabId = null;
let nextTabId = 1;
let engineError;
let serverOnline = null;
let serverError;
let engineState = "starting";
let retryingProxy = false;
let reopeningTab = false;
let checkingServer = false;
let checkingProxyConnection = false;
let bookmarkFeedbackTimeout;
let restoredOpenTabs = [];
let siteOrder = [...siteIds];
let hiddenSiteIds = new Set();
let customSites = [];
let bookmarks = [];
let bookmarkFolders = ["Unfiled"];
let recentHistory = [];
let savedSessions = [];
let shortcutBindings = {};
let recordingShortcutAction = null;
let restoringTabs = false;
let customSiteCounter = 1;
const themes = new Set(["red", "orange", "yellow", "green", "blue", "purple"]);
const searchEngines = new Set(["google", "bing", "duckduckgo"]);
const linkBehaviors = new Set(["current", "new"]);
const settingsStorageKeys = [
  "blurz-theme",
  "blurz-custom-accent",
  "blurz-bookmarks",
  "blurz-bookmark-folders",
  "blurz-saved-sessions",
  "blurz-shortcut-bindings",
  "blurz-search-engine",
  "blurz-link-behavior",
  "blurz-reduce-motion",
  "blurz-clear-history-on-exit",
  "blurz-sidebar-collapsed",
  "blurz-popular-sites",
  "blurz-custom-sites",
  "blurz-open-tabs"
];
const shortcutActions = [
  { id: "focusAddress", label: "Focus address bar", keys: "Ctrl+L" },
  { id: "newTab", label: "New tab", keys: "Ctrl+T" },
  { id: "searchTabs", label: "Search open tabs", keys: "Ctrl+Shift+A" },
  { id: "closeTab", label: "Close active tab", keys: "Ctrl+W" },
  { id: "reopenTab", label: "Reopen closed tab", keys: "Ctrl+Shift+T" },
  { id: "nextTab", label: "Next tab", keys: "Ctrl+Tab" },
  { id: "previousTab", label: "Previous tab", keys: "Ctrl+Shift+Tab" },
  { id: "reloadTab", label: "Reload active tab", keys: "Ctrl+R" },
  { id: "reloadApp", label: "Reload app and restore tabs", keys: "Ctrl+Shift+R" },
  { id: "bookmark", label: "Toggle current bookmark", keys: "Ctrl+D" },
  { id: "goBack", label: "Go back", keys: "Alt+ArrowLeft" },
  { id: "goForward", label: "Go forward", keys: "Alt+ArrowRight" },
  { id: "newTabPage", label: "New tab page", keys: "Alt+Home" },
  { id: "escape", label: "Close settings / exit fullscreen", keys: "Escape" }
];

function showSettingsMessage(text) {
  settingsMessage.textContent = text;
  settingsMessage.hidden = !text;
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    showSettingsMessage(`Preference changed, but could not be saved: ${error.message}`);
    return false;
  }
}

function readStoredValue(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch (error) {
    showSettingsMessage(`Could not read preference ${key}: ${error.message}`);
    return "";
  }
}

function readStoredJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored);
  } catch (error) {
    showSettingsMessage(`Could not read preference ${key}: ${error.message}`);
    return fallback;
  }
}

function setCustomAccent(color) {
  const root = document.documentElement;
  if (color) {
    root.dataset.customAccent = "true";
    root.style.setProperty("--accent", color);
    accentColorPicker.value = color;
    return;
  }

  delete root.dataset.customAccent;
  root.style.removeProperty("--accent");
  accentColorPicker.value = getComputedStyle(root).getPropertyValue("--accent").trim();
}

function savePopularSites() {
  return saveSetting(
    "blurz-popular-sites",
    JSON.stringify({ order: siteOrder, hidden: [...hiddenSiteIds] })
  );
}

function saveCustomSites() {
  return saveSetting("blurz-custom-sites", JSON.stringify(customSites));
}

function saveOpenTabs() {
  const openUrls = tabs
    .map((tab) => ({
      url: tab.url,
      pinned: tab.pinned,
      active: tab.id === activeTabId
    }))
    .filter((tab) => typeof tab.url === "string" && /^https?:\/\//i.test(tab.url));

  // A blank/new-tab page must not erase the last useful restore snapshot.
  if (!openUrls.length) return false;
  return saveSetting("blurz-open-tabs", JSON.stringify(openUrls));
}
function normalizeShortcutUrl(value) {
  const input = value.trim();
  if (!input) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function createSiteButton(site) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "site-link";
  button.dataset.siteId = site.id;
  button.dataset.url = site.url;
  button.append(document.createTextNode(site.name));

  const detail = document.createElement("span");
  detail.textContent = new URL(site.url).hostname;
  button.append(detail);
  return button;
}

function saveBookmarkFolders() {
  return saveSetting("blurz-bookmark-folders", JSON.stringify(bookmarkFolders));
}

function renderBookmarkFolders() {
  const fillSelect = (select, includeAll) => {
    const previousValue = select.value;
    select.replaceChildren();
    if (includeAll) {
      const allOption = document.createElement("option");
      allOption.value = "";
      allOption.textContent = "All folders";
      select.append(allOption);
    }
    bookmarkFolders.forEach((folder) => {
      const option = document.createElement("option");
      option.value = folder;
      option.textContent = folder;
      select.append(option);
    });
    if ([...select.options].some((option) => option.value === previousValue)) {
      select.value = previousValue;
    } else if (includeAll) {
      select.value = "";
    }
  };
  fillSelect(bookmarkFolderSelect, false);
  fillSelect(bookmarkFolderFilter, true);

  bookmarkFolderSettings.replaceChildren();
  bookmarkFolders.filter((folder) => folder !== "Unfiled").forEach((folder) => {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = `Delete ${folder}`;
    removeButton.setAttribute("aria-label", `Delete bookmark folder ${folder}`);
    removeButton.addEventListener("click", () => {
      bookmarkFolders = bookmarkFolders.filter((candidate) => candidate !== folder);
      bookmarks = bookmarks.map((bookmark) => ({
        ...bookmark,
        folder: bookmark.folder === folder ? "Unfiled" : bookmark.folder
      }));
      saveBookmarkFolders();
      saveSetting("blurz-bookmarks", JSON.stringify(bookmarks));
      renderBookmarkFolders();
      renderBookmarks();
    });
    bookmarkFolderSettings.append(removeButton);
  });
}

function renderBookmarks() {
  bookmarkList.replaceChildren();
  const query = bookmarkSearch.value.trim().toLowerCase();
  const folder = bookmarkFolderFilter.value;
  const filteredBookmarks = bookmarks.filter((bookmark) =>
    (!folder || bookmark.folder === folder) &&
    `${bookmark.name} ${bookmark.url}`.toLowerCase().includes(query)
  );
  bookmarkEmpty.hidden = filteredBookmarks.length > 0;
  bookmarkEmpty.textContent = bookmarks.length
    ? "No bookmarks match this search."
    : "Pages you bookmark will appear here.";

  filteredBookmarks.forEach((bookmark) => {
    const entry = document.createElement("div");
    entry.className = "bookmark-entry";

    const openButton = createSiteButton({
      id: "bookmark",
      name: bookmark.name,
      url: bookmark.url
    });
    openButton.classList.add("bookmark-link");
    openButton.setAttribute("aria-label", `Open bookmark ${bookmark.name}`);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-bookmark";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remove bookmark ${bookmark.name}`);
    removeButton.addEventListener("click", () => {
      bookmarks = bookmarks.filter((item) => item.url !== bookmark.url);
      saveSetting("blurz-bookmarks", JSON.stringify(bookmarks));
      renderBookmarks();
      updateBookmarkButton();
    });

    const folderSelect = document.createElement("select");
    folderSelect.className = "bookmark-folder-assignment";
    folderSelect.setAttribute("aria-label", `Folder for ${bookmark.name}`);
    bookmarkFolders.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      folderSelect.append(option);
    });
    folderSelect.value = bookmark.folder || "Unfiled";
    folderSelect.addEventListener("change", () => {
      bookmark.folder = folderSelect.value;
      saveSetting("blurz-bookmarks", JSON.stringify(bookmarks));
      renderBookmarks();
    });

    entry.append(openButton, folderSelect, removeButton);
    bookmarkList.append(entry);
  });
}

function renderRecentHistory() {
  recentHistoryList.replaceChildren();
  recentHistoryEmpty.hidden = recentHistory.length > 0;
  recentHistory.forEach((entry) => {
    const button = createSiteButton({
      id: "",
      name: entry.name,
      url: entry.url
    });
    button.setAttribute("aria-label", `Visit ${entry.name}`);
    recentHistoryList.append(button);
  });
}

function recordVisit(url) {
  if (restoringTabs) return;
  const existing = recentHistory.find((entry) => entry.url === url);
  const name = existing?.name || new URL(url).hostname;
  recentHistory = [
    { url, name },
    ...recentHistory.filter((entry) => entry.url !== url)
  ].slice(0, 50);
  saveSetting("blurz-recent-history", JSON.stringify(recentHistory));
  renderRecentHistory();
}

function renderSavedSessions() {
  const selected = savedSessionSelect.value;
  savedSessionSelect.replaceChildren();
  savedSessions.forEach((session, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = session.name;
    savedSessionSelect.append(option);
  });
  if ([...savedSessionSelect.options].some((option) => option.value === selected)) {
    savedSessionSelect.value = selected;
  }
  const hasSessions = savedSessions.length > 0;
  loadSessionButton.disabled = !hasSessions;
  deleteSessionButton.disabled = !hasSessions;
}

function renderShortcutBindings() {
  shortcutBindingList.replaceChildren();
  shortcutActions.forEach((action) => {
    const row = document.createElement("div");
    row.className = "shortcut-binding";
    const label = document.createElement("span");
    label.textContent = action.label;
    const binding = shortcutBindings[action.id] || action.keys;
    const keyLabel = document.createElement("kbd");
    keyLabel.textContent = binding.replace(/^Ctrl(?=\+)/, "Ctrl/⌘");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.shortcutAction = action.id;
    button.textContent = recordingShortcutAction === action.id ? "Press keys…" : "Change";
    button.setAttribute("aria-label", `Change shortcut for ${action.label}`);
    button.addEventListener("click", () => {
      recordingShortcutAction = action.id;
      renderShortcutBindings();
      shortcutBindingList.querySelector(
        `[data-shortcut-action="${action.id}"]`
      )?.focus();
    });
    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.textContent = "Reset";
    resetButton.setAttribute("aria-label", `Reset shortcut for ${action.label}`);
    resetButton.addEventListener("click", () => {
      const duplicate = shortcutActions.find((candidate) =>
        candidate.id !== action.id &&
        (shortcutBindings[candidate.id] || candidate.keys) === action.keys
      );
      if (duplicate) {
        showSettingsMessage(`Reset would conflict with ${duplicate.label}. Change that shortcut first.`);
        return;
      }
      const previous = shortcutBindings[action.id];
      delete shortcutBindings[action.id];
      if (!saveSetting("blurz-shortcut-bindings", JSON.stringify(shortcutBindings))) {
        if (previous) shortcutBindings[action.id] = previous;
        return;
      }
      recordingShortcutAction = null;
      showSettingsMessage("");
      renderShortcutBindings();
    });
    row.append(label, keyLabel, button, resetButton);
    shortcutBindingList.append(row);
  });
}

function formatShortcutEvent(event) {
  const modifiers = [];
  if (event.ctrlKey || event.metaKey) modifiers.push("Ctrl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  const key = event.key === " " ? "Space" :
    event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (["Control", "Alt", "Shift", "Meta"].includes(key)) return null;
  if (!(event.ctrlKey || event.metaKey || event.altKey) && key !== "Escape") return null;
  return [...modifiers, key].join("+");
}

function matchesShortcut(event, shortcut) {
  const parts = shortcut.split("+");
  const key = parts.pop();
  const modifiers = new Set(parts);
  const hasControl = event.ctrlKey || event.metaKey;
  const eventKey = event.key === " " ? "Space" : event.key;
  return eventKey.toLowerCase() === key.toLowerCase() &&
    hasControl === modifiers.has("Ctrl") &&
    event.altKey === modifiers.has("Alt") &&
    event.shiftKey === modifiers.has("Shift");
}

function normalizeSavedTabEntry(entry) {
  if (!entry || typeof entry !== "object" || typeof entry.url !== "string") return null;

  const rawUrl = entry.url.trim();
  const normalizedUrl = rawUrl ? normalizeShortcutUrl(rawUrl) : "";
  if (rawUrl && !normalizedUrl) return null;

  return {
    url: normalizedUrl,
    pinned: entry.pinned === true,
    active: entry.active === true
  };
}

function currentTabSnapshot() {
  return tabs.map((tab) => ({
    url: tab.url,
    pinned: tab.pinned,
    active: tab.id === activeTabId
  }));
}

function saveSessions() {
  return saveSetting("blurz-saved-sessions", JSON.stringify(savedSessions));
}

async function openTabSnapshot(snapshot) {
  await engineReady;
  if (!controller) throw engineError || new Error("The browser engine could not start.");

  const entries = Array.isArray(snapshot) ? snapshot.map(normalizeSavedTabEntry).filter(Boolean) : [];
  if (!entries.length) {
    const emptyTab = createTab();
    emptyTab.title = "New Tab";
    activateTab(emptyTab.id);
    saveOpenTabs();
    renderTabs();
    return;
  }

  restoringTabs = true;
  tabs.forEach((tab) => {
    window.clearTimeout(tab.loadTimeout);
    tab.iframe.src = "about:blank";
    tab.container.remove();
  });
  tabs = [];
  activeTabId = null;
  let activeTab = null;
  try {
    for (const [index, entry] of entries.entries()) {
      const tab = createTab();
      tab.pinned = entry.pinned === true;
      if (entry.url) {
        const navigated = await navigate(entry.url, false);
        if (!navigated) {
          setTabLoadState(tab, "error", `Could not restore ${entry.url}.`);
          continue;
        }
      }
      if (entry.active || (!entries.some((candidate) => candidate.active) && index === entries.length - 1)) {
        activeTab = tab;
      }
    }
  } finally {
    restoringTabs = false;
  }
  tabs.sort((left, right) => Number(right.pinned) - Number(left.pinned));
  if (activeTab && tabs.includes(activeTab)) activateTab(activeTab.id);
  saveOpenTabs();
  renderTabs();
}

function setShortcutBinding(actionId, binding) {
  const duplicate = shortcutActions.find((action) =>
    action.id !== actionId && (shortcutBindings[action.id] || action.keys) === binding
  );
  if (duplicate) {
    showSettingsMessage(`That shortcut is already assigned to ${duplicate.label}.`);
    return false;
  }
  const previous = shortcutBindings[actionId];
  shortcutBindings[actionId] = binding;
  if (!saveSetting("blurz-shortcut-bindings", JSON.stringify(shortcutBindings))) {
    if (previous) shortcutBindings[actionId] = previous;
    else delete shortcutBindings[actionId];
    return false;
  }
  showSettingsMessage("Keyboard shortcut saved.");
  return true;
}

function runShortcutAction(actionId) {
  if (actionId === "focusAddress") {
    engineReady.then((readyController) => {
      if (!readyController) return;
      if (!getActiveTab()) createTab();
      home.hidden = true;
      browser.hidden = false;
      address.focus();
      address.select();
    });
  } else if (actionId === "newTab") {
    newTabButton.click();
  } else if (actionId === "searchTabs") {
    browser.hidden = false;
    home.hidden = true;
    tabSearch.focus();
    tabSearch.select();
  } else if (actionId === "closeTab") {
    const activeTab = getActiveTab();
    if (activeTab) closeTab(activeTab.id);
  } else if (actionId === "reopenTab") {
    reopenClosedTab();
  } else if (actionId === "nextTab") {
    activateAdjacentTab(1);
  } else if (actionId === "previousTab") {
    activateAdjacentTab(-1);
  } else if (actionId === "reloadTab") {
    getActiveTab()?.frame.reload();
  } else if (actionId === "reloadApp") {
    window.location.reload();
  } else if (actionId === "bookmark") {
    bookmarkButton.click();
  } else if (actionId === "goBack") {
    getActiveTab()?.frame.back();
  } else if (actionId === "goForward") {
    getActiveTab()?.frame.forward();
  } else if (actionId === "newTabPage") {
    homeButton.click();
  } else if (actionId === "escape") {
    if (!settingsPanel.hidden) {
      settingsPanel.hidden = true;
      settingsButton.setAttribute("aria-expanded", "false");
      settingsButton.focus();
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch((error) => {
        setEngineStatus("Could not exit fullscreen", error.message);
      });
    }
  }
}

function syncSiteLists() {
  browserSidebar.querySelectorAll(".site-link[data-site-id]").forEach((button) => {
    if (!builtInSiteIds.includes(button.dataset.siteId)) {
      button.remove();
    }
  });
  siteIds = [...builtInSiteIds, ...customSites.map((site) => site.id)];
  siteButtons = [
    ...Array.from(browserSidebar.querySelectorAll(".site-link[data-site-id]"))
      .filter((button) => builtInSiteIds.includes(button.dataset.siteId)),
    ...customSites.map(createSiteButton)
  ];

  customSites.forEach((site) => {
    const button = siteButtons.find((candidate) => candidate.dataset.siteId === site.id);
    browserSidebar.append(button);
  });
}

function updateTabActionButtons() {
  const activeTab = getActiveTab();
  closeOtherTabsButton.disabled = !tabs.some((tab) =>
    tab.id !== activeTab?.id && !tab.pinned
  );
}

function showBrowserActionFeedback(text, isError = false) {
  browserActionFeedback.textContent = text;
  browserActionFeedback.dataset.state = isError ? "error" : "ready";
  browserActionFeedback.hidden = !text;
}

function updateBookmarkButton() {
  const tab = getActiveTab();
  const url = tab && normalizeShortcutUrl(tab.url);
  const bookmarked = Boolean(url && bookmarks.some((item) => item.url === url));
  bookmarkButton.disabled = !url;
  bookmarkButton.setAttribute("aria-pressed", String(bookmarked));
  bookmarkButton.title = !url
    ? "Open a page to bookmark it"
    : bookmarked ? "Remove bookmark" : "Bookmark current page";
}

function showBookmarkFeedback(text, isError = false) {
  window.clearTimeout(bookmarkFeedbackTimeout);
  bookmarkFeedback.dataset.state = isError ? "error" : "ready";
  bookmarkFeedback.textContent = text;
  bookmarkFeedback.hidden = false;
  bookmarkFeedbackTimeout = window.setTimeout(() => {
    bookmarkFeedback.hidden = true;
  }, 5000);
}

function setTabLoadState(tab, state, text = "") {
  window.clearTimeout(tab.loadTimeout);
  tab.loading = state === "loading";
  tab.loadStatus.dataset.state = state;
  tab.loadStatus.textContent = text;
  tab.loadStatus.hidden = !text;
  if (tab.loading) {
    tab.loadTimeout = window.setTimeout(() => {
      setTabLoadState(tab, "error", "Page load timed out. Try reloading.");
    }, 30000);
  }
}

function updateProxyStatus() {
  let state = "checking";
  let text = "Checking proxy…";

  if (serverOnline === false || engineState === "unavailable") {
    state = "unavailable";
    text = serverOnline === false ? "Server unavailable" : "Proxy engine unavailable";
  } else if (serverOnline && engineState === "ready") {
    state = "ready";
    text = "Engine ready";
  } else if (serverOnline) {
    text = "Starting proxy engine…";
  }

  proxyStatus.dataset.state = state;
  proxyStatusText.textContent = text;
  const unavailable = state === "unavailable";
  proxyRetryButton.hidden = !unavailable;
  proxyRetryButton.disabled = retryingProxy;
  proxyRetryButton.textContent = retryingProxy ? "Checking…" : "Retry";
  proxyRecovery.hidden = !unavailable;
  proxyRecovery.textContent = serverOnline === false
    ? `Could not reach /api/status${serverError ? ` (${serverError})` : ""}. Check port 3000 and /tmp/blurzproxy.log in Codespaces.`
    : "The proxy engine failed to start. Retry to restart it; if it still fails, reload the page and check /tmp/blurzproxy.log.";
}

async function checkProxyServer() {
  if (checkingServer) return serverOnline;
  checkingServer = true;
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
    const status = await response.json();
    serverOnline = status.status === "online";
    serverError = serverOnline ? "" : "unexpected status response";
  } catch (error) {
    serverOnline = false;
    serverError = error.message;
  } finally {
    checkingServer = false;
    updateProxyStatus();
  }
  return serverOnline;
}

async function retryProxy() {
  if (retryingProxy) return;
  retryingProxy = true;
  updateProxyStatus();
  try {
    if (await checkProxyServer()) {
      window.location.reload();
    }
  } finally {
    retryingProxy = false;
    updateProxyStatus();
  }
}

async function testProxyConnection() {
  if (checkingProxyConnection) return;
  checkingProxyConnection = true;
  proxyConnectionTestButton.disabled = true;
  proxyConnectionResult.hidden = false;
  proxyConnectionResult.dataset.state = "checking";
  proxyConnectionResult.textContent = "Testing WebSocket connection…";

  try {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socketUrl = `${protocol}//${location.host}/wisp/`;
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(socketUrl);
      let opened = false;
      const timeout = window.setTimeout(() => {
        socket.close();
        reject(new Error("The proxy WebSocket did not respond within 8 seconds."));
      }, 8000);

      socket.addEventListener("open", () => {
        opened = true;
        window.clearTimeout(timeout);
        socket.close(1000, "Connection test complete");
        resolve();
      }, { once: true });

      socket.addEventListener("error", () => {
        window.clearTimeout(timeout);
        reject(new Error("Could not connect to the proxy WebSocket endpoint."));
      }, { once: true });

      socket.addEventListener("close", () => {
        if (!opened) {
          window.clearTimeout(timeout);
          reject(new Error("The proxy WebSocket closed before connecting."));
        }
      }, { once: true });
    });
    proxyConnectionResult.dataset.state = "ready";
    proxyConnectionResult.textContent = "Proxy transport connection succeeded.";
  } catch (error) {
    proxyConnectionResult.dataset.state = "error";
    proxyConnectionResult.textContent = `Proxy transport connection failed: ${error.message}`;
  } finally {
    checkingProxyConnection = false;
    proxyConnectionTestButton.disabled = false;
  }
}

function setSidebarCollapsed(collapsed) {
  browserWorkspace.classList.toggle("sidebar-collapsed", collapsed);
  browserSidebar.hidden = collapsed;
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.title = collapsed ? "Expand popular sites" : "Collapse popular sites";
}

function applySiteOrder() {
  siteOrder.forEach((siteId) => {
    const button = siteButtons.find((candidate) => candidate.dataset.siteId === siteId);
    if (button) {
      button.hidden = hiddenSiteIds.has(siteId);
      browserSidebar.append(button);
    }
  });
}

function renderPopularSiteSettings() {
  popularSiteSettings.replaceChildren();

  siteOrder.forEach((siteId, index) => {
    const siteButton = siteButtons.find((candidate) => candidate.dataset.siteId === siteId);
    if (!siteButton) return;

    const row = document.createElement("div");
    row.className = "popular-site-setting";

    const label = document.createElement("label");
    label.className = "setting-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !hiddenSiteIds.has(siteId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        hiddenSiteIds.delete(siteId);
      } else {
        hiddenSiteIds.add(siteId);
      }
      siteButton.hidden = !checkbox.checked;
      savePopularSites();
    });
    label.append(checkbox, document.createTextNode(siteButton.firstChild.textContent.trim()));

    const controls = document.createElement("div");
    controls.className = "site-order-controls";
    [
      { label: "Move up", text: "↑", offset: -1 },
      { label: "Move down", text: "↓", offset: 1 }
    ].forEach(({ label: controlLabel, text, offset }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.setAttribute("aria-label", `${controlLabel} ${siteButton.firstChild.textContent.trim()}`);
      button.disabled = index + offset < 0 || index + offset >= siteOrder.length;
      button.addEventListener("click", () => {
        const nextIndex = index + offset;
        [siteOrder[index], siteOrder[nextIndex]] = [siteOrder[nextIndex], siteOrder[index]];
        applySiteOrder();
        renderPopularSiteSettings();
        savePopularSites();
      });
      controls.append(button);
    });

    if (siteId.startsWith("custom-")) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-shortcut";
      removeButton.textContent = "×";
      removeButton.setAttribute("aria-label", `Remove ${siteButton.firstChild.textContent.trim()}`);
      removeButton.addEventListener("click", () => {
        customSites = customSites.filter((site) => site.id !== siteId);
        hiddenSiteIds.delete(siteId);
        siteOrder = siteOrder.filter((id) => id !== siteId);
        siteButton.remove();
        syncSiteLists();
        applySiteOrder();
        renderPopularSiteSettings();
        saveCustomSites();
        savePopularSites();
      });
      controls.append(removeButton);
    }

    row.append(label, controls);
    popularSiteSettings.append(row);
  });
}

function setReduceMotion(enabled) {
  reduceMotionSetting.checked = enabled;
  if (enabled) {
    document.documentElement.dataset.reduceMotion = "true";
  } else {
    delete document.documentElement.dataset.reduceMotion;
  }
}

try {
  const savedCustomSites = JSON.parse(localStorage.getItem("blurz-custom-sites") || "[]");
  if (Array.isArray(savedCustomSites)) {
    customSites = savedCustomSites.filter((site) => {
      if (!site ||
          typeof site.id !== "string" ||
          typeof site.name !== "string" ||
          typeof site.url !== "string") return false;
      const url = normalizeShortcutUrl(site.url);
      return site.id.startsWith("custom-") && site.name.trim() && url;
    }).map((site) => ({
      id: site.id,
      name: site.name.trim().slice(0, 40),
      url: normalizeShortcutUrl(site.url)
    }));
    customSites = [...new Map(customSites.map((site) => [site.id, site])).values()];
  }
  syncSiteLists();

  const savedTheme = readStoredValue("blurz-theme");
  const activeTheme = themes.has(savedTheme) ? savedTheme : themeSelect.value;
  if (themes.has(activeTheme)) {
    document.documentElement.dataset.theme = activeTheme;
    themeSelect.value = activeTheme;
  }
  const savedAccent = readStoredValue("blurz-custom-accent");
  if (/^#[0-9a-f]{6}$/i.test(savedAccent || "")) {
    setCustomAccent(savedAccent);
  } else {
    setCustomAccent("");
  }
  try {
    const savedBookmarks = JSON.parse(localStorage.getItem("blurz-bookmarks") || "[]");
    if (Array.isArray(savedBookmarks)) {
      bookmarks = savedBookmarks
        .filter((item) => item && typeof item.name === "string" && typeof item.url === "string")
        .map((item) => ({
          name: item.name.trim().slice(0, 100),
          url: normalizeShortcutUrl(item.url),
          folder: typeof item.folder === "string" ? item.folder : "Unfiled"
        }))
        .filter((item) => item.name && item.url)
        .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index)
        .slice(0, 100);
    }
  } catch (error) {
    showSettingsMessage(`Could not load bookmarks: ${error.message}`);
  }
  try {
    const savedFolders = JSON.parse(localStorage.getItem("blurz-bookmark-folders") || "[\"Unfiled\"]");
    if (Array.isArray(savedFolders)) {
      bookmarkFolders = [
        "Unfiled",
        ...new Set(savedFolders.filter((folder) =>
          typeof folder === "string" && folder.trim() && folder.trim() !== "Unfiled"
        ).map((folder) => folder.trim().slice(0, 30)))
      ].slice(0, 30);
    }
    bookmarks = bookmarks.map((bookmark) => ({
      ...bookmark,
      folder: bookmarkFolders.includes(bookmark.folder) ? bookmark.folder : "Unfiled"
    }));
  } catch (error) {
    showSettingsMessage(`Could not load bookmark folders: ${error.message}`);
  }
  try {
    const savedHistory = JSON.parse(localStorage.getItem("blurz-recent-history") || "[]");
    if (Array.isArray(savedHistory)) {
      recentHistory = savedHistory
        .filter((item) => item && typeof item.name === "string" && typeof item.url === "string")
        .map((item) => ({
          name: item.name.trim().slice(0, 100),
          url: normalizeShortcutUrl(item.url)
        }))
        .filter((item) => item.name && item.url)
        .slice(0, 50);
    }
  } catch (error) {
    showSettingsMessage(`Could not load recent history: ${error.message}`);
  }
  const savedSearchEngine = readStoredValue("blurz-search-engine");
  if (searchEngines.has(savedSearchEngine)) {
    searchEngineSelect.value = savedSearchEngine;
  }
  const savedLinkBehavior = localStorage.getItem("blurz-link-behavior");
  if (linkBehaviors.has(savedLinkBehavior)) {
    linkBehaviorSelect.value = savedLinkBehavior;
  }
  setReduceMotion(readStoredValue("blurz-reduce-motion") === "true");
  clearHistoryOnExitSetting.checked =
    localStorage.getItem("blurz-clear-history-on-exit") === "true";
  setSidebarCollapsed(localStorage.getItem("blurz-sidebar-collapsed") === "true");
  const savedLastVisitedUrl = localStorage.getItem("blurz-last-visited-url");
  if (savedLastVisitedUrl) {
    const url = new URL(savedLastVisitedUrl);
    if (["http:", "https:"].includes(url.protocol)) {
      lastVisitedUrl = url.href;
    }
  }
  try {
    const savedOpenTabs = JSON.parse(localStorage.getItem("blurz-open-tabs") || "[]");
    if (Array.isArray(savedOpenTabs)) {
      restoredOpenTabs = savedOpenTabs
        .map((entry) => {
          if (typeof entry === "string") {
            const url = normalizeShortcutUrl(entry);
            return url ? { url, pinned: false } : null;
          }
          return normalizeSavedTabEntry(entry);
        })
        .filter(Boolean)
        .slice(0, 50);
    }
  } catch (error) {
    showSettingsMessage(`Could not load the saved tab session: ${error.message}`);
  }
  try {
    const storedSessions = JSON.parse(localStorage.getItem("blurz-saved-sessions") || "[]");
    if (Array.isArray(storedSessions)) {
      savedSessions = storedSessions
        .filter((session) => session && typeof session.name === "string" && Array.isArray(session.tabs))
        .map((session) => ({
          name: session.name.trim().slice(0, 40),
          tabs: session.tabs
            .map((entry) => {
              if (typeof entry === "string") {
                const url = normalizeShortcutUrl(entry);
                return url ? { url, pinned: false } : null;
              }
              return normalizeSavedTabEntry(entry);
            })
            .filter(Boolean)
            .slice(0, 50)
        }))
        .filter((session) => session.name)
        .slice(0, 20);
    }
  } catch (error) {
    showSettingsMessage(`Could not load saved sessions: ${error.message}`);
  }
  restoreOpenTabsButton.disabled = restoredOpenTabs.length === 0;
  try {
    const savedBindings = readStoredJson("blurz-shortcut-bindings", {});
    if (savedBindings && typeof savedBindings === "object" && !Array.isArray(savedBindings)) {
      shortcutActions.forEach((action) => {
        const value = savedBindings[action.id];
        if (typeof value === "string" && /^[A-Za-z]+(?:\+[A-Za-z]+)*$/.test(value)) {
          shortcutBindings[action.id] = value;
        }
      });
    }
  } catch (error) {
    showSettingsMessage(`Could not load keyboard shortcuts: ${error.message}`);
  }

  const savedSites = readStoredJson("blurz-popular-sites", null);
  if (savedSites && typeof savedSites === "object") {
    const savedOrder = Array.isArray(savedSites.order) ? savedSites.order : [];
    const validSavedOrder = [...new Set(savedOrder)].filter((siteId) => siteIds.includes(siteId));
    siteOrder = [
      ...validSavedOrder,
      ...siteIds.filter((siteId) => !validSavedOrder.includes(siteId))
    ];
    if (Array.isArray(savedSites.hidden)) {
      hiddenSiteIds = new Set(savedSites.hidden.filter((siteId) => siteIds.includes(siteId)));
    }
  }
} catch (error) {
  showSettingsMessage(`Could not load saved preferences: ${error.message}`);
}
applySiteOrder();
renderPopularSiteSettings();
renderBookmarkFolders();
renderBookmarks();
renderRecentHistory();
renderSavedSessions();
renderShortcutBindings();
updateTabActionButtons();
updateBookmarkButton();
updateProxyStatus();
checkProxyServer();
window.setInterval(checkProxyServer, 15000);

proxyConnectionTestButton.addEventListener("click", testProxyConnection);
proxyRetryButton.addEventListener("click", retryProxy);

bookmarkButton.addEventListener("click", () => {
  const tab = getActiveTab();
  const url = tab && normalizeShortcutUrl(tab.url);
  if (!tab || !url) {
    showBookmarkFeedback("Open a website before bookmarking it.", true);
    return;
  }

  const existing = bookmarks.find((bookmark) => bookmark.url === url);
  if (existing) {
    bookmarks = bookmarks.filter((bookmark) => bookmark.url !== url);
    const saved = saveSetting("blurz-bookmarks", JSON.stringify(bookmarks));
    renderBookmarks();
    updateBookmarkButton();
    showBookmarkFeedback(saved
      ? `${existing.name} removed from bookmarks.`
      : "Bookmark removed for this session, but could not be saved.",
    !saved);
    return;
  }

  const name = tab.title.trim().slice(0, 40) || new URL(url).hostname;
  bookmarks.unshift({ name, url, folder: bookmarkFolderSelect.value || "Unfiled" });
  bookmarks = bookmarks.slice(0, 100);
  const saved = saveSetting("blurz-bookmarks", JSON.stringify(bookmarks));
  renderBookmarks();
  updateBookmarkButton();
  showBookmarkFeedback(saved
    ? `${name} added to bookmarks.`
    : `${name} added for this session, but could not be saved.`,
  !saved);
});

bookmarkSearch.addEventListener("input", renderBookmarks);
bookmarkFolderFilter.addEventListener("change", renderBookmarks);
bookmarkFolderSelect.addEventListener("change", renderBookmarks);

addBookmarkFolderButton.addEventListener("click", () => {
  const name = newBookmarkFolderInput.value.trim().slice(0, 30);
  if (!name || name.toLowerCase() === "unfiled") {
    showSettingsMessage("Enter a folder name other than Unfiled.");
    return;
  }
  if (bookmarkFolders.some((folder) => folder.toLowerCase() === name.toLowerCase())) {
    showSettingsMessage("That bookmark folder already exists.");
    return;
  }
  if (bookmarkFolders.length >= 30) {
    showSettingsMessage("You can create up to 30 bookmark folders.");
    return;
  }
  bookmarkFolders.push(name);
  const saved = saveBookmarkFolders();
  renderBookmarkFolders();
  bookmarkFolderSelect.value = name;
  newBookmarkFolderInput.value = "";
  showSettingsMessage(saved ? "Bookmark folder created." : "");
});

saveSessionButton.addEventListener("click", () => {
  const name = savedSessionNameInput.value.trim().slice(0, 40);
  if (!name) {
    showSettingsMessage("Enter a name for this saved session.");
    savedSessionNameInput.focus();
    return;
  }
  const session = {
    name,
    tabs: currentTabSnapshot()
  };
  const existingIndex = savedSessions.findIndex((entry) =>
    entry.name.toLowerCase() === name.toLowerCase()
  );
  if (existingIndex >= 0) savedSessions[existingIndex] = session;
  else if (savedSessions.length < 20) savedSessions.push(session);
  else {
    showSettingsMessage("You can save up to 20 sessions.");
    return;
  }
  const saved = saveSessions();
  renderSavedSessions();
  savedSessionSelect.value = String(savedSessions.findIndex((entry) => entry.name === name));
  showSettingsMessage(saved ? `Session "${name}" saved.` : "");
});

loadSessionButton.addEventListener("click", async () => {
  const session = savedSessions[Number(savedSessionSelect.value)];
  if (!session) return;
  try {
    await openTabSnapshot(session.tabs);
    browser.hidden = false;
    home.hidden = true;
    settingsPanel.hidden = true;
    settingsButton.setAttribute("aria-expanded", "false");
    showSettingsMessage(`Session "${session.name}" opened.`);
  } catch (error) {
    showSettingsMessage(`Could not open saved session: ${error.message}`);
  }
});

restoreOpenTabsButton.addEventListener("click", async () => {
  if (!restoredOpenTabs.length) return;
  try {
    await openTabSnapshot(restoredOpenTabs);
    browser.hidden = false;
    home.hidden = true;
    settingsPanel.hidden = true;
    settingsButton.setAttribute("aria-expanded", "false");
    showSettingsMessage("");
  } catch (error) {
    showSettingsMessage(`Could not restore previous tabs: ${error.message}`);
  }
});

deleteSessionButton.addEventListener("click", () => {
  const index = Number(savedSessionSelect.value);
  if (!savedSessions[index]) return;
  const [removed] = savedSessions.splice(index, 1);
  const saved = saveSessions();
  renderSavedSessions();
  showSettingsMessage(saved ? `Session "${removed.name}" deleted.` : "");
});

clearHistoryButton.addEventListener("click", () => {
  recentHistory = [];
  const cleared = saveSetting("blurz-recent-history", "[]");
  renderRecentHistory();
  if (cleared) showSettingsMessage("Browsing history cleared.");
});

clearHistoryOnExitSetting.addEventListener("change", () => {
  if (saveSetting("blurz-clear-history-on-exit", String(clearHistoryOnExitSetting.checked))) {
    showSettingsMessage("");
  }
});

window.addEventListener("beforeunload", () => {
  try {
    if (tabs.some((tab) => tab.url)) saveOpenTabs();
  } catch (error) {
    console.error("Could not save open tabs before exit:", error);
  }
});

window.addEventListener("pagehide", () => {
  try {
    if (tabs.some((tab) => tab.url)) saveOpenTabs();
  } catch (error) {
    console.error("Could not save open tabs before page hide:", error);
  }
  if (clearHistoryOnExitSetting.checked) {
    try {
      localStorage.removeItem("blurz-recent-history");
    } catch (error) {
      console.error("Could not clear browsing history on exit:", error);
    }
  }
});

recentHistoryList.addEventListener("click", (event) => {
  const button = event.target.closest(".site-link");
  if (!button || !recentHistoryList.contains(button)) return;
  settingsPanel.hidden = true;
  settingsButton.setAttribute("aria-expanded", "false");
  navigate(button.dataset.url);
});

customShortcutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = shortcutNameInput.value.trim();
  const url = normalizeShortcutUrl(shortcutUrlInput.value);
  if (!name || !url) {
    showSettingsMessage("Enter a shortcut name and a valid HTTP or HTTPS website address.");
    return;
  }
  if (customSites.some((site) => site.name.toLowerCase() === name.toLowerCase() ||
      site.url === url)) {
    showSettingsMessage("That shortcut is already in your popular sites.");
    return;
  }

  const id = `custom-${Date.now()}-${customSiteCounter++}`;
  customSites.push({ id, name: name.slice(0, 40), url });
  siteOrder.push(id);
  hiddenSiteIds.delete(id);
  syncSiteLists();
  applySiteOrder();
  renderPopularSiteSettings();
  saveCustomSites();
  savePopularSites();
  customShortcutForm.reset();
  showSettingsMessage("");
});

settingsButton.addEventListener("click", () => {
  const expanded = settingsButton.getAttribute("aria-expanded") === "true";
  settingsButton.setAttribute("aria-expanded", String(!expanded));
  settingsPanel.hidden = expanded;
  if (!expanded) {
    settingsPanel.querySelector("select, input:not([type='hidden']), button")?.focus();
  }
});

themeSelect.addEventListener("change", () => {
  const theme = themeSelect.value;
  if (!themes.has(theme)) {
    showSettingsMessage("That theme is not available.");
    return;
  }

  document.documentElement.dataset.theme = theme;
  setCustomAccent("");
  const themeSaved = saveSetting("blurz-theme", theme);
  const accentSaved = saveSetting("blurz-custom-accent", "");
  if (themeSaved && accentSaved) showSettingsMessage("");
});

accentColorPicker.addEventListener("input", () => {
  setCustomAccent(accentColorPicker.value);
  if (saveSetting("blurz-custom-accent", accentColorPicker.value)) {
    showSettingsMessage("");
  }
});

sidebarToggle.addEventListener("click", () => {
  const collapsed = sidebarToggle.getAttribute("aria-expanded") === "true";
  setSidebarCollapsed(collapsed);
  if (saveSetting("blurz-sidebar-collapsed", String(collapsed))) showSettingsMessage("");
});

clearProxyDataButton.addEventListener("click", async () => {
  const scope = clearDataScope.value;
  const confirmations = {
    cookies: "Clear all saved cookies for proxied sites? Your settings will be kept.",
    proxy: "Clear all proxy data? The proxy database will be deleted; reload the page afterward.",
    all: "Clear all app data and settings? This also removes the saved theme, shortcuts, and app cache."
  };
  if (!confirmations[scope] || !window.confirm(confirmations[scope])) {
    return;
  }

  clearProxyDataButton.disabled = true;
  try {
    if (scope === "cookies") {
      const cleared = await clearSavedProxyCookies();
      showSettingsMessage(cleared
        ? "Saved proxy cookies cleared."
        : "No saved proxy cookies were found.");
      return;
    }

    await deleteScramjetDatabase();
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));

    if (scope === "all") {
      localStorage.clear();
      sessionStorage.clear();
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      showSettingsMessage("All site data cleared. Reloading…");
      window.setTimeout(() => location.reload(), 500);
      return;
    }

    showSettingsMessage("Proxy data cleared. Reload the page to restart the proxy engine.");
  } catch (error) {
    showSettingsMessage(`Could not clear selected data: ${error.message}`);
  } finally {
    clearProxyDataButton.disabled = false;
  }
});

exportSettingsButton.addEventListener("click", () => {
  try {
    exportSettings();
    showSettingsMessage("Settings exported.");
  } catch (error) {
    showSettingsMessage(`Could not export settings: ${error.message}`);
  }
});

importSettingsButton.addEventListener("click", () => settingsFileInput.click());
settingsFileInput.addEventListener("change", async () => {
  const [file] = settingsFileInput.files || [];
  if (!file) return;

  try {
    if (file.size > 1024 * 1024) {
      throw new Error("The settings file is larger than 1 MB.");
    }
    const payload = JSON.parse(await file.text());
    const imported = validateImportedSettings(payload);
    if (!window.confirm("Import these settings and replace matching preferences? The page will reload.")) {
      return;
    }

    const previous = new Map(
      Object.keys(imported).map((key) => [key, localStorage.getItem(key)])
    );
    try {
      Object.entries(imported).forEach(([key, value]) => localStorage.setItem(key, value));
    } catch (error) {
      previous.forEach((value, key) => {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      });
      throw error;
    }

    location.reload();
  } catch (error) {
    showSettingsMessage(`Could not import settings: ${error.message}`);
  } finally {
    settingsFileInput.value = "";
  }
});

searchEngineSelect.addEventListener("change", () => {
  if (searchEngines.has(searchEngineSelect.value) &&
      saveSetting("blurz-search-engine", searchEngineSelect.value)) {
    showSettingsMessage("");
  }
});

linkBehaviorSelect.addEventListener("change", () => {
  if (linkBehaviors.has(linkBehaviorSelect.value) &&
      saveSetting("blurz-link-behavior", linkBehaviorSelect.value)) {
    showSettingsMessage("");
  }
});

reduceMotionSetting.addEventListener("change", () => {
  setReduceMotion(reduceMotionSetting.checked);
  if (saveSetting("blurz-reduce-motion", String(reduceMotionSetting.checked))) {
    showSettingsMessage("");
  }
});

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

function clearSavedProxyCookies() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("$scramjet");
    request.onerror = () => reject(request.error || new Error("Could not open the proxy database."));
    request.onblocked = () => reject(new Error("Close other Blurz tabs and try again."));
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("cookies")) {
        database.close();
        resolve(false);
        return;
      }

      let transaction;
      try {
        transaction = database.transaction("cookies", "readwrite");
        transaction.objectStore("cookies").clear();
      } catch (error) {
        database.close();
        reject(error);
        return;
      }

      transaction.oncomplete = () => {
        database.close();
        resolve(true);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error("Could not clear saved proxy cookies."));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error("Clearing saved proxy cookies was cancelled."));
      };
    };
  });
}

function deleteScramjetDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("$scramjet");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not delete the proxy database."));
    request.onblocked = () => reject(new Error("Close other Blurz tabs and try again."));
  });
}

function validateImportedSettings(payload) {
  if (!payload || payload.format !== "blurz-settings" || payload.version !== 1 ||
      !payload.settings || typeof payload.settings !== "object" ||
      Array.isArray(payload.settings)) {
    throw new Error("This is not a supported Blurz settings file.");
  }

  const imported = {};
  const values = payload.settings;
  const parseValue = (key) => {
    if (typeof values[key] !== "string") {
      throw new Error(`Invalid value for ${key}.`);
    }
    try {
      return JSON.parse(values[key]);
    } catch {
      return values[key];
    }
  };
  const validateChoice = (key, choices) => {
    const value = parseValue(key);
    if (!choices.has(value)) throw new Error(`Unsupported setting value for ${key}.`);
    imported[key] = value;
  };

  if ("blurz-theme" in values) validateChoice("blurz-theme", themes);
  if ("blurz-custom-accent" in values) {
    const color = parseValue("blurz-custom-accent");
    if (color !== "" && (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) {
      throw new Error("The imported custom accent color is invalid.");
    }
    imported["blurz-custom-accent"] = color;
  }
  let validBookmarkFolders = bookmarkFolders;
  if ("blurz-bookmark-folders" in values) {
    const value = parseValue("blurz-bookmark-folders");
    if (!Array.isArray(value) || value.length > 30 ||
        value.some((folder) => typeof folder !== "string" || !folder.trim())) {
      throw new Error("The imported bookmark folders are invalid.");
    }
    validBookmarkFolders = [...new Set([
      "Unfiled",
      ...value.map((folder) => folder.trim().slice(0, 30))
    ])];
    imported["blurz-bookmark-folders"] = validBookmarkFolders;
  }
  if ("blurz-bookmarks" in values) {
    const value = parseValue("blurz-bookmarks");
    if (!Array.isArray(value) || value.length > 100) {
      throw new Error("The bookmark list must contain 100 or fewer pages.");
    }
    const seenUrls = new Set();
    imported["blurz-bookmarks"] = value.map((bookmark) => {
      const name = bookmark && typeof bookmark.name === "string"
        ? bookmark.name.trim().slice(0, 100)
        : "";
      const url = bookmark && typeof bookmark.url === "string"
        ? normalizeShortcutUrl(bookmark.url)
        : null;
      const folder = bookmark && typeof bookmark.folder === "string"
        ? bookmark.folder
        : "Unfiled";
      if (!name || !url || seenUrls.has(url) || !validBookmarkFolders.includes(folder)) {
        throw new Error("The imported bookmark list contains an invalid entry.");
      }
      seenUrls.add(url);
      return { name, url, folder };
    });
  }
  if ("blurz-saved-sessions" in values) {
    const value = parseValue("blurz-saved-sessions");
    if (!Array.isArray(value) || value.length > 20) {
      throw new Error("The imported sessions must contain 20 or fewer entries.");
    }
    imported["blurz-saved-sessions"] = value.map((session) => {
      if (!session || typeof session.name !== "string" || !Array.isArray(session.tabs) ||
          !session.name.trim() || session.tabs.length > 50) {
        throw new Error("The imported sessions contain an invalid entry.");
      }
      const tabsToRestore = session.tabs.map((entry) => {
        const url = entry && entry.url === ""
          ? ""
          : entry && typeof entry.url === "string"
            ? normalizeShortcutUrl(entry.url)
            : null;
        if (url === null) throw new Error("A saved session contains an invalid website address.");
        return {
          url,
          pinned: entry.pinned === true,
          active: entry.active === true
        };
      });
      return {
        name: session.name.trim().slice(0, 40),
        tabs: tabsToRestore
      };
    });
  }
  if ("blurz-open-tabs" in values) {
    const value = parseValue("blurz-open-tabs");
    if (!Array.isArray(value) || value.length > 50) {
      throw new Error("The imported tab session must contain 50 or fewer entries.");
    }
    imported["blurz-open-tabs"] = value.map((entry) => {
      if (typeof entry === "string") {
        const url = normalizeShortcutUrl(entry);
        if (!url) throw new Error("The imported tab list contains an invalid website address.");
        return { url, pinned: false, active: false };
      }
      if (!entry || typeof entry !== "object") {
        throw new Error("The imported tab list contains an invalid entry.");
      }
      const url = entry.url === "" ? "" :
        typeof entry.url === "string" ? normalizeShortcutUrl(entry.url) : null;
      if (url === null) {
        throw new Error("The imported tab list contains an invalid website address.");
      }
      return {
        url,
        pinned: entry.pinned === true,
        active: entry.active === true
      };
    });
  }
  if ("blurz-shortcut-bindings" in values) {
    const value = parseValue("blurz-shortcut-bindings");
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("The imported keyboard shortcuts are invalid.");
    }
    const validBindings = {};
    for (const [actionId, binding] of Object.entries(value)) {
      if (!shortcutActions.some((action) => action.id === actionId) ||
          typeof binding !== "string" ||
          !/^(?:(?:Ctrl|Alt|Shift)\+)*(?:[A-Za-z0-9]+|Arrow(?:Left|Right|Up|Down)|Escape)$/.test(binding)) {
        throw new Error("The imported keyboard shortcuts contain an invalid binding.");
      }
      validBindings[actionId] = binding;
    }
    const effectiveBindings = shortcutActions.map((action) =>
      validBindings[action.id] || shortcutBindings[action.id] || action.keys
    );
    if (new Set(effectiveBindings).size !== effectiveBindings.length) {
      throw new Error("The imported keyboard shortcuts contain duplicates.");
    }
    imported["blurz-shortcut-bindings"] = validBindings;
  }
  if ("blurz-search-engine" in values) validateChoice("blurz-search-engine", searchEngines);
  if ("blurz-link-behavior" in values) validateChoice("blurz-link-behavior", linkBehaviors);

  for (const key of [
    "blurz-reduce-motion",
    "blurz-sidebar-collapsed",
    "blurz-clear-history-on-exit"
  ]) {
    if (key in values) {
      const value = parseValue(key);
      if (typeof value !== "boolean") throw new Error(`Invalid value for ${key}.`);
      imported[key] = value;
    }
  }

  let importedCustomSites = customSites;
  if ("blurz-custom-sites" in values) {
    const value = parseValue("blurz-custom-sites");
    if (!Array.isArray(value) || value.length > 100) {
      throw new Error("The shortcut list must contain 100 or fewer sites.");
    }
    const seenIds = new Set();
    importedCustomSites = value.map((site, index) => {
      const url = site && typeof site.url === "string"
        ? normalizeShortcutUrl(site.url)
        : null;
      const name = site && typeof site.name === "string" ? site.name.trim().slice(0, 40) : "";
      const id = site && typeof site.id === "string" ? site.id : `custom-import-${index}`;
      if (!id.startsWith("custom-") || seenIds.has(id) || !name || !url) {
        throw new Error("The imported shortcut list contains an invalid entry.");
      }
      seenIds.add(id);
      return { id, name, url };
    });
    imported["blurz-custom-sites"] = importedCustomSites;
  }

  const validSiteIds = new Set([
    ...builtInSiteIds,
    ...importedCustomSites.map((site) => site.id)
  ]);
  if ("blurz-popular-sites" in values) {
    const value = parseValue("blurz-popular-sites");
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        !Array.isArray(value.order) || !Array.isArray(value.hidden)) {
      throw new Error("The imported popular-sites settings are invalid.");
    }
    const order = [...new Set(value.order.filter((id) =>
      typeof id === "string" && validSiteIds.has(id)
    ))];
    imported["blurz-popular-sites"] = {
      order: [...order, ...[...validSiteIds].filter((id) => !order.includes(id))],
      hidden: [...new Set(value.hidden.filter((id) =>
        typeof id === "string" && validSiteIds.has(id)
      ))]
    };
  }

  return Object.fromEntries(Object.entries(imported).map(([key, value]) => [
    key,
    JSON.stringify(value)
  ]));
}

function exportSettings() {
  const settings = {};
  settingsStorageKeys.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  });

  const file = new Blob([JSON.stringify({
    format: "blurz-settings",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings
  }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "blurz-settings.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId);
}

function renderTabs() {
  tabList.replaceChildren();
  const query = tabSearch.value.trim().toLowerCase();
  let visibleTabs = 0;

  tabs.forEach((tab) => {
    const matches = !query || `${tab.title} ${tab.url}`.toLowerCase().includes(query);
    if (matches) visibleTabs++;
    const item = document.createElement("div");
    item.className = `tab-item${tab.id === activeTabId ? " active" : ""}${tab.pinned ? " pinned" : ""}`;
    item.hidden = !matches;

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "tab";
    selectButton.id = `tab-trigger-${tab.id}`;
    selectButton.setAttribute("role", "tab");
    selectButton.setAttribute("aria-selected", String(tab.id === activeTabId));
    selectButton.setAttribute("aria-controls", `tab-panel-${tab.id}`);
    selectButton.textContent = tab.title;
    selectButton.addEventListener("click", () => activateTab(tab.id));

    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = "tab-pin";
    pinButton.textContent = tab.pinned ? "●" : "○";
    pinButton.setAttribute("aria-pressed", String(tab.pinned));
    pinButton.setAttribute("aria-label", `${tab.pinned ? "Unpin" : "Pin"} ${tab.title}`);
    pinButton.title = `${tab.pinned ? "Unpin" : "Pin"} tab`;
    pinButton.addEventListener("click", (event) => {
      event.stopPropagation();
      tab.pinned = !tab.pinned;
      tabs.sort((left, right) => Number(right.pinned) - Number(left.pinned));
      saveOpenTabs();
      renderTabs();
    });

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

    item.append(selectButton, pinButton, closeButton);
    tabList.append(item);
  });

  tabSearchStatus.hidden = !query || visibleTabs > 0;
  tabSearchStatus.textContent = visibleTabs ? "" : "No matching tabs.";
  updateTabActionButtons();
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
  updateBookmarkButton();
  browser.hidden = false;
  home.hidden = true;
  renderTabs();
  saveOpenTabs();
}

function activateAdjacentTab(offset) {
  if (tabs.length < 2) return;
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
  const nextIndex = (activeIndex + offset + tabs.length) % tabs.length;
  activateTab(tabs[nextIndex].id);
}

function createTab({ activate = true, persist = true } = {}) {
  const id = nextTabId++;
  const container = document.createElement("div");
  container.className = "browser-frame";
  container.id = `tab-panel-${id}`;
  container.setAttribute("role", "tabpanel");
  container.setAttribute("aria-labelledby", `tab-trigger-${id}`);
  container.hidden = true;

  const iframe = document.createElement("iframe");
  iframe.title = "Blurz browser tab";
  iframe.referrerPolicy = "no-referrer";
  iframe.setAttribute("scrolling", "yes");
  const loadStatus = document.createElement("p");
  loadStatus.className = "tab-load-status";
  loadStatus.setAttribute("role", "status");
  loadStatus.setAttribute("aria-live", "polite");
  loadStatus.hidden = true;
  loadStatus.dataset.state = "idle";
  container.append(loadStatus);
  container.append(iframe);
  frameHost.append(container);

  const tab = {
    id,
    title: "New Tab",
    url: "",
    pinned: false,
    container,
    iframe,
    loadStatus,
    loading: false,
    loadTimeout: null,
    frame: controller.createFrame(iframe)
  };

  iframe.addEventListener("load", () => {
    const framePath = iframe.getAttribute("src")
      ? new URL(iframe.getAttribute("src"), location.href).pathname
      : "";
    if (tab.loading && framePath.startsWith("/scramjet/")) {
      setTabLoadState(tab, "loaded");
    }
  });
  iframe.addEventListener("error", () => {
    if (tab.loading) {
      setTabLoadState(tab, "error", "Could not load this page. Check the address and connection.");
    }
  });
  tab.frame.addEventListener("navigate", () => {
    setTabLoadState(tab, "loading", "Loading page…");
  });

  tab.frame.addEventListener("urlchange", (event) => {
    tab.url = event.url;
    saveOpenTabs();
    try {
      tab.title = new URL(event.url).hostname || "New Tab";
    } catch {
      tab.title = "New Tab";
    }

    if (activeTabId === tab.id) {
      tab.container.hidden = false;
      address.value = tab.url;
      welcome.hidden = true;
      updateBookmarkButton();
    }

    renderTabs();
  });

  tabs.push(tab);
  if (activate) {
    activateTab(id);
    address.value = "";
    address.focus();
  } else {
    if (!getActiveTab()) activeTabId = id;
    renderTabs();
  }
  updateBookmarkButton();
  if (persist) saveOpenTabs();
  return tab;
}

function closeTab(id, remember = true) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;

  const closedTab = tabs[index];
  if (remember) {
    closedTabs.push({ url: closedTab.url });
    if (closedTabs.length > 20) closedTabs.shift();
  }

  const [tab] = tabs.splice(index, 1);
  window.clearTimeout(tab.loadTimeout);
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
  saveOpenTabs();
}

function closeOtherTabs() {
  const activeTab = getActiveTab();
  if (!activeTab) return;

  tabs
    .filter((tab) => tab.id !== activeTab.id && !tab.pinned)
    .map((tab) => tab.id)
    .forEach((id) => closeTab(id));
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

  engineState = "ready";
  updateProxyStatus();
  createTab({ activate: false, persist: false });
  browser.hidden = true;
  home.hidden = false;
  setEngineStatus("Browser engine ready", "Enter a website or search term to get started.");
  return controller;
}

const engineReady = initializeEngine().catch((error) => {
  engineError = error;
  engineState = "unavailable";
  updateProxyStatus();
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
      const searchUrls = {
        google: "https://www.google.com/search?q=",
        bing: "https://www.bing.com/search?q=",
        duckduckgo: "https://duckduckgo.com/?q="
      };
      destination = new URL(searchUrls[searchEngineSelect.value] + encodeURIComponent(value));
    }

    if (!["http:", "https:"].includes(destination.protocol)) {
      throw new Error("Unsupported address");
    }

    return destination;
  } catch {
    return null;
  }
}

async function navigate(value, openInNewTab = linkBehaviorSelect.value === "new") {
  const destination = getDestination(value);

  if (!destination) {
    message.textContent = "Please enter a valid website address.";
    return false;
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
    const tab = openInNewTab ? createTab() : getActiveTab() || createTab();

    welcome.hidden = true;
    address.value = destination.href;
    tab.url = destination.href;
    tab.title = destination.hostname || "New Tab";
    setTabLoadState(tab, "loading", "Loading page…");
    renderTabs();
    updateBookmarkButton();
    saveOpenTabs();
    try {
      tab.frame.go(destination.href);
      recordVisit(destination.href);
    } catch (error) {
      setTabLoadState(tab, "error", `Could not start loading this page: ${error.message}`);
      throw error;
    }
    return true;
  } catch (error) {
    setEngineStatus("Navigation failed", error.message);
    return false;
  }
}

async function copyCurrentAddress() {
  const tab = getActiveTab();
  const url = tab?.url || address.value.trim();
  if (!url) {
    showBrowserActionFeedback("There is no address to copy.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    showBrowserActionFeedback("Address copied.");
  } catch (error) {
    showBrowserActionFeedback(`Could not copy address: ${error.message}`, true);
  }
}

async function reopenClosedTab() {
  const closedTab = closedTabs[closedTabs.length - 1];
  if (!closedTab || reopeningTab) return;

  reopeningTab = true;
  try {
    await engineReady;
    if (!controller) {
      throw engineError || new Error("The browser engine could not start.");
    }

    const tab = createTab();
    if (!closedTab.url || await navigate(closedTab.url, false)) {
      closedTabs.pop();
    } else {
      closeTab(tab.id, false);
    }
  } catch (error) {
    setEngineStatus("Could not reopen tab", error.message);
  } finally {
    reopeningTab = false;
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

copyAddressButton.addEventListener("click", copyCurrentAddress);
closeOtherTabsButton.addEventListener("click", closeOtherTabs);

closeBrowserButton.addEventListener("click", () => {
  browser.hidden = true;
  home.hidden = false;
  input.focus();
});

tabSearch.addEventListener("input", renderTabs);

document.addEventListener("keydown", (event) => {
  if (recordingShortcutAction) {
    const binding = formatShortcutEvent(event);
    if (!binding) return;
    event.preventDefault();
    const actionId = recordingShortcutAction;
    recordingShortcutAction = null;
    setShortcutBinding(actionId, binding);
    renderShortcutBindings();
    return;
  }

  if (event.repeat) return;
  const action = shortcutActions.find((candidate) =>
    matchesShortcut(event, shortcutBindings[candidate.id] || candidate.keys)
  );
  if (!action) return;
  event.preventDefault();
  runShortcutAction(action.id);
});

homeButton.addEventListener("click", async () => {
  const tab = getActiveTab();
  if (tab) {
    setTabLoadState(tab, "idle");
    tab.iframe.src = "about:blank";
    tab.url = "";
    tab.title = "New Tab";
    tab.container.hidden = true;
    address.value = "";
    welcome.hidden = false;
    updateBookmarkButton();
    saveOpenTabs();
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

browserSidebar.addEventListener("click", (event) => {
  const button = event.target.closest(".site-link");
  if (button && browserSidebar.contains(button)) {
    navigate(button.dataset.url);
  }
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
