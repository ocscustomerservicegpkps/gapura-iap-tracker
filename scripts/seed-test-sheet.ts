/**
 * Reset a throwaway spreadsheet to the 66-row fixture the end-to-end suite expects.
 *
 * Point `GOOGLE_SHEETS_SPREADSHEET_ID` at the test sheet — never at production — and
 * run this before pointing the suite at the real Sheets API:
 *
 *   npm run seed-test-sheet -- --apply
 *
 * The suite's default offline run against the in-memory transport does not need this.
 */
import fixture from "../src/fixtures/tracker-fixture.json";
import type { CellValue } from "../src/domain/rows";
import {
  PRODUCTION_SPREADSHEET_ID,
  requireEnv,
  TRACKER_TAB as TRACKER,
} from "../src/sheets/config";
import { announceDryRun, connect, isApply } from "./config";

const rows = fixture as CellValue[][];

async function main(): Promise<void> {
  const spreadsheetId = requireEnv("GOOGLE_SHEETS_SPREADSHEET_ID");

  console.log(`Seeding "${TRACKER}" in spreadsheet ${spreadsheetId}`);
  console.log(`  clear   ${TRACKER}!A1:O10000`);
  console.log(`  write   ${rows.length} rows (1 header + ${rows.length - 1} items)`);

  if (spreadsheetId === PRODUCTION_SPREADSHEET_ID) {
    console.error(
      "\nRefusing to run: that is the production spreadsheet ID. Point GOOGLE_SHEETS_SPREADSHEET_ID at the throwaway test sheet.\n",
    );
    process.exit(1);
  }

  if (!isApply()) {
    announceDryRun();
    return;
  }

  const sheets = connect();
  await sheets.clearRange(`${TRACKER}!A1:O10000`);
  await sheets.writeRanges([
    { range: `${TRACKER}!A1:O${rows.length}`, values: rows },
  ]);
  console.log("\nDone.\n");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
