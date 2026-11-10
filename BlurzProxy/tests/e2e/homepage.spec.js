const { expect, test } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Access password").fill("test-only-password-12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("opens on the homepage and leaves saved tabs unopened", async ({ page }) => {
  const unexpectedDestinations = [];
  page.on("request", (request) => {
    if (request.url().includes("example.com/previous-session")) {
      unexpectedDestinations.push(request.url());
    }
  });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("blurz-open-tabs", JSON.stringify([
      { url: "https://example.com/previous-session", pinned: false, active: true }
    ]));
  });
  await page.reload();

  await expect(page.getByRole("heading", { name: "BLURZ" }).first()).toBeVisible();
  await expect(page.locator("#browser")).toBeHidden();
  await expect(page.locator("#browser-content .engine-status-text")).toHaveText(
    "Browser engine ready",
    { timeout: 20000 }
  );
  const savedTabs = await page.evaluate(() => JSON.parse(localStorage.getItem("blurz-open-tabs")));
  expect(savedTabs).toEqual([
    { url: "https://example.com/previous-session", pinned: false, active: true }
  ]);
  await page.reload();
  await expect(page.locator("#browser")).toBeHidden();
  console.log("RESTORE_DEBUG", await page.evaluate(() => ({
    stored: localStorage.getItem("blurz-open-tabs"),
    buttonDisabled: document.querySelector("#restore-open-tabs").disabled,
    theme: document.documentElement.dataset.theme
  })));
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore previous tabs" })).toBeEnabled();
  await page.waitForTimeout(500);
  expect(unexpectedDestinations).toEqual([]);
});

test("settings and theme controls are keyboard accessible", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCSS(
    "outline-style",
    "solid"
  );
  await page.keyboard.press("Enter");

  const settings = page.getByRole("button", { name: "Settings", exact: true });
  await expect(settings).toHaveAttribute("aria-expanded", "true");
  const theme = page.getByLabel("Space theme");
  await expect(theme).toBeVisible();
  await expect(theme).toBeFocused();
  await expect(theme).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(theme).toHaveValue("purple");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "purple");
});

test("browser engine initializes without exposing an error state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#browser-content .engine-status-text")).toHaveText(
    "Browser engine ready",
    { timeout: 20000 }
  );
  await expect(page.locator("#proxy-status")).toHaveAttribute("data-state", "ready");
});

test("manual previous-tab restore works without restoring automatically", async ({ page }) => {
  const savedUrl = "http://127.0.0.1:3467/healthz";
  await page.goto("/");
  await page.evaluate((url) => {
    localStorage.setItem("blurz-open-tabs", JSON.stringify([
      { url, pinned: false, active: true }
    ]));
  }, savedUrl);
  await page.reload();
  await expect(page.locator("#browser")).toBeHidden();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const restore = page.getByRole("button", { name: "Restore previous tabs" });
  await expect(restore).toBeEnabled();
  await restore.click();

  await expect(page.locator("#browser")).toBeVisible();
  await expect(page.locator("#current-address")).toHaveValue(savedUrl);
});

test("proxy navigation, bookmarks, and Ctrl+Shift+T work", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#browser-content .engine-status-text")).toHaveText(
    "Browser engine ready",
    { timeout: 20000 }
  );
  await page.locator("#url-input").fill("http://127.0.0.1:3467/healthz");
  await page.locator("#proxy-form button[type=submit]").click();

  await expect(page.locator("#browser")).toBeVisible();
  await expect(page.locator("#current-address")).toHaveValue("http://127.0.0.1:3467/healthz");
  await expect(page.locator("#tab-list [role=tab]")).toHaveCount(1);
  await page.locator("#bookmark-button").click();
  await expect(page.locator("#bookmark-button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#bookmark-list .bookmark-link")).toHaveCount(1);

  await page.locator("#new-tab").click();
  await expect(page.locator("#tab-list [role=tab]")).toHaveCount(2);
  await page.locator("#tab-list [role=tab]").first().click();
  await page.getByRole("button", { name: "Close 127.0.0.1" }).click();
  await expect(page.locator("#tab-list [role=tab]")).toHaveCount(1);

  await page.keyboard.press("Control+Shift+T");
  await expect(page.locator("#tab-list [role=tab]")).toHaveCount(2);
  await expect(page.locator("#tab-list [role=tab]").filter({ hasText: "127.0.0.1" })).toHaveCount(1);
});

test("mobile homepage has no horizontal overflow and keeps address controls tappable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const homepageDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    inputHeight: document.querySelector("#url-input").getBoundingClientRect().height,
    submitHeight: document.querySelector("#proxy-form button").getBoundingClientRect().height
  }));
  expect(homepageDimensions.document).toBeLessThanOrEqual(homepageDimensions.viewport);
  expect(homepageDimensions.inputHeight).toBeGreaterThanOrEqual(44);
  expect(homepageDimensions.submitHeight).toBeGreaterThanOrEqual(44);

  await page.locator("#browser").evaluate((browser) => { browser.hidden = false; });
  await page.locator("#home").evaluate((home) => { home.hidden = true; });
  const browserDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    toolbarButtons: [...document.querySelectorAll(".browser-toolbar > button")].map((button) =>
      button.getBoundingClientRect().height
    )
  }));
  expect(browserDimensions.document).toBeLessThanOrEqual(browserDimensions.viewport);
  expect(browserDimensions.toolbarButtons.every((height) => height >= 44)).toBe(true);
});

test("small mobile viewport keeps the homepage within the screen width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  const homepageDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(homepageDimensions.document).toBeLessThanOrEqual(homepageDimensions.viewport);

  await page.locator("#browser").evaluate((browser) => { browser.hidden = false; });
  await page.locator("#home").evaluate((home) => { home.hidden = true; });
  const browserDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(browserDimensions.document).toBeLessThanOrEqual(browserDimensions.viewport);
});

test("homepage meets automated WCAG 2.1 AA checks", async ({ page }) => {
  await page.goto("/");
  const axe = () => new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const homeResults = await axe();
  expect(homeResults.violations).toEqual([]);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settingsResults = await axe();
  expect(settingsResults.violations).toEqual([]);

  const themes = await page.locator("#theme-select option").evaluateAll((options) =>
    options.map((option) => option.value)
  );
  for (const theme of themes) {
    await page.locator("#theme-select").selectOption(theme);
    const themeResults = await axe();
    expect(themeResults.violations, `WCAG violations with ${theme} theme`).toEqual([]);
  }
});
