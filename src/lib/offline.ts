/** Offline privileges are confined to explicit, isolated local fixture runs. */
export function isLocalFixtureMode(): boolean {
  return process.env.ENABLE_OFFLINE_TEST_MODE === "1" &&
    process.env.SHEETS_TRANSPORT?.trim().toLowerCase() === "memory" &&
    !process.env.VERCEL &&
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
    !process.env.GOOGLE_PRIVATE_KEY?.trim() &&
    !process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?.trim();
}

/** Security integration tests keep real application auth gates enabled. */
export function isOfflineAuth(): boolean {
  return isLocalFixtureMode() && process.env.REQUIRE_AUTH_IN_FIXTURE_MODE !== "1";
}
