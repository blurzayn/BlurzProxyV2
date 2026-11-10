const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3467",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3467/healthz",
    env: {
      HOST: "127.0.0.1",
      PORT: "3467",
      ADMIN_PASSWORD: "test-only-password-12345",
      ALLOWED_ORIGINS: "http://127.0.0.1:3467",
      COOKIE_SECURE: "false"
    },
    reuseExistingServer: false,
    timeout: 30000
  }
});
