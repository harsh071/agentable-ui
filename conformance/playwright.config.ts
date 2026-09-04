import { defineConfig } from "@playwright/test";

/**
 * Real Chrome, real WebMCP. Uses the installed Chrome (channel "chrome") with
 * the feature flag; no mocks anywhere in this suite.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: ".results/playwright.json" }]],
  use: {
    channel: "chrome",
    headless: true,
    launchOptions: { args: ["--enable-features=WebMCP"] },
  },
  webServer: {
    command: "pnpm --filter @agentable/site run preview",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
