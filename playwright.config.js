import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.js",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  globalTimeout: 10 * 60 * 1000,
  timeout: 180000,
  expect: { timeout: 10000 },
  reporter: "list",
  outputDir: "test-artifacts/results",
  use: {
    baseURL: "http://127.0.0.1:5179",
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    actionTimeout: 15000,
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:5179",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
