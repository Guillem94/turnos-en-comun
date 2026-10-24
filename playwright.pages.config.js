import { defineConfig } from "@playwright/test";

const remote = process.env.PAGES_URL;
const baseURL = remote || "http://127.0.0.1:5179/turnos-en-comun/";
const target = new URL(baseURL);
if (
  remote &&
  (target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.search ||
    target.hash)
)
  throw new Error(
    "PAGES_URL must be a public HTTPS URL without credentials, query or fragment",
  );
if (!target.pathname.endsWith("/"))
  throw new Error("PAGES_URL must end with /");

export default defineConfig({
  testDir: "./pages-tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  globalTimeout: 10 * 60 * 1000,
  timeout: 240000,
  expect: { timeout: 10000 },
  reporter: "list",
  outputDir: "test-artifacts/pages-results",
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    headless: true,
    actionTimeout: 15000,
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        channel: process.platform === "win32" ? "msedge" : undefined,
      },
    },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: remote
    ? undefined
    : {
        command: "npm run preview",
        url: baseURL,
        env: {
          TURNOS_BASE_PATH: process.env.TURNOS_BASE_PATH || "/turnos-en-comun/",
        },
        reuseExistingServer: false,
        timeout: 30000,
      },
});
