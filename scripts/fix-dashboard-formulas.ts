/**
 * One-time repair of the `Dashboard` tab.
 *
 * Two faults are fixed:
 *
 * 1. Every aggregate is bounded at row 67 (`Tracker!K2:K67`), so the 67th action item
 *    onwards is invisible to the totals. The ranges become open-ended.
 * 2. The per-case table is nine hardcoded `COUNTIF` rows, one per known IAP ID, so a
 *    tenth case never appears. They are replaced by a single `QUERY` that groups by
 *    `ID IAP` plus array formulas for the status columns.
 *
 * After this the tab is correct however many cases exist, with or without the app.
 * The `Tracker` tab is not touched.
 *
 *   npm run fix-dashboard-tab            # preview
 *   npm run fix-dashboard-tab -- --apply # write
 */
import { announceDryRun, connect, isApply } from "./config";
import {
  DASHBOARD_TAB as DASHBOARD,
  TRACKER_TAB as TRACKER,
} from "../src/sheets/config";
import type { RangeUpdate } from "../src/sheets/transport";

/** Headline counters — same meanings as before, no longer stopping at row 67. */
const TOTALS: RangeUpdate[] = [
  { range: `${DASHBOARD}!B5`, values: [[`=COUNTA(${TRACKER}!K2:K)`]] },
  {
    range: `${DASHBOARD}!B6`,
    values: [[`=COUNTIF(${TRACKER}!K2:K,"Selesai")`]],
  },
  {
    range: `${DASHBOARD}!B7`,
    values: [[`=COUNTIF(${TRACKER}!K2:K,"Sedang Berjalan")`]],
  },
  {
    range: `${DASHBOARD}!B8`,
    values: [[`=COUNTIF(${TRACKER}!K2:K,"Belum Dimulai")`]],
  },
  {
    range: `${DASHBOARD}!B9`,
    values: [[`=COUNTIF(${TRACKER}!N2:N,"TERLAMBAT")`]],
  },
];

/**
 * `A14` spills ID IAP and its total; the status columns are array formulas keyed off
 * whatever the QUERY produced, so rows appear and disappear with the data.
 */
const PER_CASE: RangeUpdate[] = [
  {
    range: `${DASHBOARD}!A14`,
    values: [
      [
        `=QUERY(${TRACKER}!B2:B,"select Col1, count(Col1) where Col1 is not null group by Col1 label count(Col1) ''",0)`,
      ],
    ],
  },
  {
    range: `${DASHBOARD}!C14`,
    values: [
      [
        `=ARRAYFORMULA(IF(A14:A="","",COUNTIFS(${TRACKER}!$B$2:$B,A14:A,${TRACKER}!$K$2:$K,"Selesai")))`,
      ],
    ],
  },
  {
    range: `${DASHBOARD}!D14`,
    values: [
      [
        `=ARRAYFORMULA(IF(A14:A="","",COUNTIFS(${TRACKER}!$B$2:$B,A14:A,${TRACKER}!$K$2:$K,"Sedang Berjalan")))`,
      ],
    ],
  },
  {
    range: `${DASHBOARD}!E14`,
    values: [
      [
        `=ARRAYFORMULA(IF(A14:A="","",COUNTIFS(${TRACKER}!$B$2:$B,A14:A,${TRACKER}!$K$2:$K,"Belum Dimulai")))`,
      ],
    ],
  },
  {
    range: `${DASHBOARD}!F14`,
    values: [
      [
        `=ARRAYFORMULA(IF(A14:A="","",COUNTIFS(${TRACKER}!$B$2:$B,A14:A,${TRACKER}!$N$2:$N,"TERLAMBAT")))`,
      ],
    ],
  },
];

/** The nine hardcoded rows have to go before the QUERY can spill into their space. */
const STALE_PER_CASE_BLOCK = `${DASHBOARD}!A14:F1000`;

async function main(): Promise<void> {
  const updates = [...TOTALS, ...PER_CASE];

  console.log(`Dashboard tab repair for "${DASHBOARD}"\n`);
  console.log(`  clear   ${STALE_PER_CASE_BLOCK}`);
  for (const update of updates) {
    console.log(`  write   ${update.range}  ${update.values[0]![0]}`);
  }

  if (!isApply()) {
    announceDryRun();
    return;
  }

  const sheets = connect();
  await sheets.clearRange(STALE_PER_CASE_BLOCK);
  await sheets.writeFormulas(updates);
  console.log("\nDone. Open the Dashboard tab and confirm the per-case table.\n");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
