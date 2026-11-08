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
      PORT: "3467"
    },
    reuseExistingServer: false,
    timeout: 30000
  }
});
