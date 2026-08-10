import { googleCredentials } from "../src/sheets/config";
import { GoogleSheetsTransport } from "../src/sheets/google-transport";

/** Shared setup for the one-off maintenance scripts. */
export function connect(): GoogleSheetsTransport {
  try {
    return new GoogleSheetsTransport(googleCredentials());
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

/** Maintenance scripts touch a live spreadsheet, so they preview unless told not to. */
export function isApply(): boolean {
  return process.argv.includes("--apply");
}

export function announceDryRun(): void {
  console.log("\nDRY RUN — nothing was written. Re-run with --apply to commit.\n");
}
