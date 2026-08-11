/**
 * One-time structural migration of the live spreadsheet.
 *
 * Two changes, both additive — no existing column is renamed, moved or cleared:
 *
 * 1. A `Konteks` tab is created if absent, given its seven standard headers, and
 *    seeded from `src/fixtures/context-fixture.json` **only when it has no data
 *    rows**. An existing tab with content is never overwritten.
 * 2. `Tracker!P1` is set to `Link Evidence`. Column P is expected to be empty; if
 *    anything is already there the script refuses rather than guess.
 *
 * Deliberately not part of the application's transport: creating tabs is a change to
 * the file's structure, and the app must never be able to make one on its own.
 *
 *   npx tsx scripts/migrate-live-sheet.ts --key ~/path/to/service-account.json
 *   npx tsx scripts/migrate-live-sheet.ts --key ~/path/to/service-account.json --apply
 *
 * Credentials may come from the JSON key file via `--key`, or from the usual
 * GOOGLE_* environment variables. The spreadsheet is
 * GOOGLE_SHEETS_SPREADSHEET_ID, or --spreadsheet <id>.
 */
import { readFileSync } from "node:fs";
import { google, type sheets_v4 } from "googleapis";
import contextFixture from "../src/fixtures/context-fixture.json";
import { CONTEXT_HEADER } from "../src/domain/context";
import { CONTEXT_TAB, TRACKER_TAB } from "../src/sheets/config";

const EVIDENCE_LINK_HEADER = "Link Evidence";
/** Column P, 1-based, matching `TRACKER_COLUMN_COUNT`. */
const EVIDENCE_LINK_CELL = `${TRACKER_TAB}!P1`;

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

const apply = process.argv.includes("--apply");

function credentials(): { clientEmail: string; privateKey: string } {
  const keyPath = arg("key");
  if (keyPath) {
    const raw = JSON.parse(
      readFileSync(keyPath.replace(/^~/, process.env.HOME ?? "~"), "utf8"),
    ) as { client_email?: string; private_key?: string };
    if (!raw.client_email || !raw.private_key) {
      fail(`${keyPath} is not a service-account key (no client_email/private_key).`);
    }
    return { clientEmail: raw.client_email!, privateKey: raw.private_key! };
  }
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    fail(
      "No credentials. Pass --key <service-account.json>, or set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.",
    );
  }
  return { clientEmail: clientEmail!, privateKey: privateKey!.replace(/\\n/g, "\n") };
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function connect(): { api: sheets_v4.Sheets; spreadsheetId: string } {
  const spreadsheetId =
    arg("spreadsheet") ?? process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    fail(
      "No spreadsheet. Pass --spreadsheet <id>, or set GOOGLE_SHEETS_SPREADSHEET_ID.",
    );
  }
  const { clientEmail, privateKey } = credentials();
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { api: google.sheets({ version: "v4", auth }), spreadsheetId };
}

async function main(): Promise<void> {
  const { api, spreadsheetId } = connect();
  const fixture = contextFixture as string[][];
  const contextRows = fixture.slice(1);

  console.log(`\nSpreadsheet: ${spreadsheetId}`);
  console.log(apply ? "Mode: APPLY (writes)\n" : "Mode: DRY RUN (no writes)\n");

  const meta = await api.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties.title",
  });
  const title = meta.data.properties?.title ?? "(untitled)";
  const tabs = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "");
  console.log(`Title: ${title}`);
  console.log(`Tabs:  ${tabs.join(", ")}\n`);

  if (!tabs.includes(TRACKER_TAB)) {
    fail(`No "${TRACKER_TAB}" tab here. Wrong spreadsheet?`);
  }

  const plan: string[] = [];

  // ---- 1. Tracker!P1 ------------------------------------------------------
  const columnP = await api.spreadsheets.values.get({
    spreadsheetId,
    range: `${TRACKER_TAB}!P1:P`,
  });
  const existingP = (columnP.data.values ?? []).flat().filter(Boolean);
  if (existingP.length === 0) {
    plan.push(`SET  ${EVIDENCE_LINK_CELL} = "${EVIDENCE_LINK_HEADER}"`);
  } else if (existingP[0] === EVIDENCE_LINK_HEADER) {
    console.log(`· ${EVIDENCE_LINK_CELL} already reads "${EVIDENCE_LINK_HEADER}".`);
  } else {
    fail(
      `${TRACKER_TAB} column P is not empty (first value: "${String(existingP[0])}"). ` +
        `Refusing to overwrite — move that data, or point Link Evidence at a free column.`,
    );
  }

  // ---- 2. Konteks tab -----------------------------------------------------
  const contextExists = tabs.includes(CONTEXT_TAB);
  let existingContextRows = 0;
  if (contextExists) {
    const current = await api.spreadsheets.values.get({
      spreadsheetId,
      range: `${CONTEXT_TAB}!A2:A`,
    });
    existingContextRows = (current.data.values ?? []).flat().filter(Boolean).length;
  } else {
    plan.push(`ADD  tab "${CONTEXT_TAB}"`);
  }

  plan.push(`SET  ${CONTEXT_TAB}!A1:G1 = ${CONTEXT_HEADER.join(" | ")}`);

  if (existingContextRows > 0) {
    console.log(
      `· ${CONTEXT_TAB} already holds ${existingContextRows} case row(s); seeding skipped.`,
    );
  } else {
    plan.push(
      `SEED ${CONTEXT_TAB}!A2:G${contextRows.length + 1} — ${contextRows.length} cases: ` +
        contextRows.map((r) => r[0]).join(", "),
    );
  }

  console.log("Planned changes:");
  for (const line of plan) console.log(`   ${line}`);
  console.log("");

  if (!apply) {
    console.log("DRY RUN — nothing was written. Re-run with --apply to commit.\n");
    return;
  }

  if (!contextExists) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: CONTEXT_TAB,
                gridProperties: { rowCount: 200, columnCount: 7, frozenRowCount: 1 },
              },
            },
          },
        ],
      },
    });
    console.log(`✓ created tab "${CONTEXT_TAB}"`);
  }

  const data: sheets_v4.Schema$ValueRange[] = [
    { range: `${CONTEXT_TAB}!A1:G1`, values: [[...CONTEXT_HEADER]] },
  ];
  if (existingContextRows === 0) {
    data.push({
      range: `${CONTEXT_TAB}!A2:G${contextRows.length + 1}`,
      values: contextRows,
    });
  }
  if (existingP.length === 0) {
    data.push({ range: EVIDENCE_LINK_CELL, values: [[EVIDENCE_LINK_HEADER]] });
  }

  await api.spreadsheets.values.batchUpdate({
    spreadsheetId,
    // RAW throughout: this is all text, and the sheet's US locale must not touch it.
    requestBody: { valueInputOption: "RAW", data },
  });

  console.log(`✓ wrote ${data.length} range(s)`);
  console.log("\nDone.\n");
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
