/**
 * One-time migration of case context into Tracker columns R–W.
 *
 * Existing Tracker values win over the old `Konteks` tab, which wins over the
 * built-in document fixture. Context is repeated on every action row of a case so
 * deleting or inserting one step cannot detach the case from its context.
 */
import { loadEnvConfig } from "@next/env";
import { google, type sheets_v4 } from "googleapis";
import contextFixture from "../src/fixtures/context-fixture.json";
import {
  CONTEXT_HEADER,
  contextToRow,
  hasContext,
  rowToContext,
  type CaseContext,
} from "../src/domain/context";

loadEnvConfig(process.cwd());

const TRACKER_TAB = process.env.TRACKER_SHEET_NAME ?? "Tracker";
const OLD_CONTEXT_TAB = process.env.CONTEXT_SHEET_NAME ?? "Konteks";
const REQUIRED_COLUMNS = 23; // A:W

function fail(message: string): never {
  console.error(`Migration failed: ${message}`);
  process.exit(1);
}

function connect(): { api: sheets_v4.Sheets; spreadsheetId: string } {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!spreadsheetId || !clientEmail || !privateKey) {
    fail("Google Sheets credentials are incomplete in env.local/.env.local.");
  }
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { api: google.sheets({ version: "v4", auth }), spreadsheetId };
}

function put(
  target: Map<string, CaseContext>,
  cells: readonly unknown[],
): void {
  const context = rowToContext(cells);
  if (context.iapId && hasContext(context)) target.set(context.iapId, context);
}

async function main(): Promise<void> {
  const { api, spreadsheetId } = connect();
  const metadata = await api.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties(sheetId,title,gridProperties.columnCount)",
  });
  const tracker = metadata.data.sheets?.find(
    (sheet) => sheet.properties?.title === TRACKER_TAB,
  );
  const sheetId = tracker?.properties?.sheetId;
  if (sheetId === undefined) fail(`Tab ${TRACKER_TAB} was not found.`);

  const currentColumns = tracker?.properties?.gridProperties?.columnCount ?? 0;
  if (currentColumns < REQUIRED_COLUMNS) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          appendDimension: {
            sheetId,
            dimension: "COLUMNS",
            length: REQUIRED_COLUMNS - currentColumns,
          },
        }],
      },
    });
  }

  const contexts = new Map<string, CaseContext>();
  for (const row of (contextFixture as unknown[][]).slice(1)) put(contexts, row);

  const oldTabExists = metadata.data.sheets?.some(
    (sheet) => sheet.properties?.title === OLD_CONTEXT_TAB,
  );
  if (oldTabExists) {
    const old = await api.spreadsheets.values.get({
      spreadsheetId,
      range: `${OLD_CONTEXT_TAB}!A2:G`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    for (const row of old.data.values ?? []) put(contexts, row);
  }

  const rows = await api.spreadsheets.values.get({
    spreadsheetId,
    range: `${TRACKER_TAB}!A2:W`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const trackerRows = rows.data.values ?? [];
  trackerRows.forEach((row) => {
    put(contexts, [row[1], ...row.slice(17, 23)]);
  });

  const data: sheets_v4.Schema$ValueRange[] = [{
    range: `${TRACKER_TAB}!R1:W1`,
    values: [[...CONTEXT_HEADER.slice(1)]],
  }];
  let populatedRows = 0;
  trackerRows.forEach((row, index) => {
    const iapId = String(row[1] ?? "").trim();
    const context = contexts.get(iapId);
    if (!context) return;
    data.push({
      range: `${TRACKER_TAB}!R${index + 2}:W${index + 2}`,
      values: [contextToRow(context).slice(1)],
    });
    populatedRows += 1;
  });

  await api.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data },
  });

  const verify = await api.spreadsheets.values.get({
    spreadsheetId,
    range: `${TRACKER_TAB}!R1:W`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const verifiedRows = (verify.data.values ?? [])
    .slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .length;
  console.log(`Tracker context migration complete: ${populatedRows} rows written, ${verifiedRows} rows verified.`);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
