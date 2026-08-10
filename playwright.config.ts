import { defineConfig, devices } from "@playwright/test";

/**
 * One seam: a real browser driving the real application.
 *
 * The suite runs against the in-memory transport. It resets the sheet through
 * `/api/test/reset` and asserts on stored cells through `/api/health`, and
 * both endpoints exist only when that transport is bound — so running against a real
 * spreadsheet needs those specs reworked to reset and read back through the Sheets
 * API. `tests/global-setup.ts` says so plainly rather than letting the run fail 52
 * times over. The spec's reference configuration, a dedicated throwaway sheet, is
 * blocked on that sheet being created.
 *
 * `TZ=America/Los_Angeles` matches the production spreadsheet's own timezone, so
 * every run proves date logic states Asia/Jakarta explicitly rather than inheriting
 * whatever the host happens to be set to.
 */
const MAIN_PORT = 3100;
const LATER_PORT = 3101;

/** Noon in Jakarta on the spec's reference date; 22:00 the previous day in LA. */
const NOW_REFERENCE = "2026-08-10T05:00:00Z";
/** Five weeks on, by which point the sheet's stored overdue column has gone stale. */
const NOW_LATER = "2026-09-15T05:00:00Z";

const serverEnv = (now: string) => ({
  SHEETS_TRANSPORT: process.env.SHEETS_TRANSPORT ?? "memory",
  IAP_NOW: now,
  TZ: "America/Los_Angeles",
  NODE_ENV: "production",
});

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/global-setup.ts",
  // The suite shares one spreadsheet, so tests take turns and reset between them.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : [["list"]],
  expect: { timeout: 10_000 },
  timeout: 60_000,

  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${MAIN_PORT}`,
      },
      testIgnore: [/mobile\.spec\.ts/, /stale-column\.spec\.ts/],
    },
    {
      // A phone viewport under Chromium, so the suite needs only one browser build.
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        baseURL: `http://127.0.0.1:${MAIN_PORT}`,
      },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: "clock-later",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${LATER_PORT}`,
      },
      testMatch: /stale-column\.spec\.ts/,
    },
  ],

  webServer: [
    {
      command: `npx next start -p ${MAIN_PORT}`,
      url: `http://127.0.0.1:${MAIN_PORT}/api/health`,
      env: serverEnv(NOW_REFERENCE),
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx next start -p ${LATER_PORT}`,
      url: `http://127.0.0.1:${LATER_PORT}/api/health`,
      env: serverEnv(NOW_LATER),
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
