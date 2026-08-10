/**
 * Spreadsheet coordinates and credential lookup.
 *
 * Deliberately free of `server-only` so the maintenance scripts in `scripts/` can
 * import the same values the application uses instead of re-deriving them.
 */

export const TRACKER_TAB = process.env.TRACKER_SHEET_NAME ?? "Tracker";
export const DASHBOARD_TAB = process.env.DASHBOARD_SHEET_NAME ?? "Dashboard";

/** The live spreadsheet. Guarded against in the test-sheet seeding script. */
export const PRODUCTION_SPREADSHEET_ID =
  "1eY_kLvI9vOkGoMJ3g1ix41O0zlQQI0wqIOU2JMbkdmw";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Configure the service account credentials (see .env.example), or set SHEETS_TRANSPORT=memory to run against the offline fixture.`,
    );
  }
  return value;
}

export interface GoogleCredentials {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

export function googleCredentials(): GoogleCredentials {
  return {
    spreadsheetId: requireEnv("GOOGLE_SHEETS_SPREADSHEET_ID"),
    clientEmail: requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: requireEnv("GOOGLE_PRIVATE_KEY"),
  };
}
