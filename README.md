# IAP Monitoring Dashboard

A single-page Next.js dashboard over PT Gapura Angkasa's **Improvement Action Plan**
tracker. It reads and writes the existing Google Sheet directly — the spreadsheet
stays the database, this replaces it as the working surface.

Indonesian throughout, light theme only, no authentication.

## What it does that the spreadsheet could not

- **`Status Terlambat` is derived, never read.** An item is `TERLAMBAT` when it is not
  `Selesai` and its target date is before today in **Asia/Jakarta**. The stored value
  in column N is ignored for display, and corrected in the sheet whenever a row is
  saved — so the spreadsheet heals itself over time for people who open it directly.
  Page loads never write.
- **Real dates.** `Tanggal Target` is stored as Indonesian text (`14 Okt 2026`) and
  parsed on read, so the table sorts chronologically and can answer "what falls due in
  the next 7 days".
- **Full CRUD** on action items and on whole IAP cases, through modals.
- **Case context** — incident, parties, root cause and Parameter Keberhasilan (KPI) —
  lifted from the nine source IAP documents into a static file in this repo.
- **Charts and a phone layout**, so a PIC can update an item from the ramp.

## Running it

```bash
npm install
npm run dev
```

With no credentials configured the app binds an **in-memory copy of the sheet**, seeded
from the 66-row fixture in `src/fixtures/tracker-fixture.json`. Nothing touches Google.

To run against the real spreadsheet, copy `.env.example` to `.env.local` and fill in the
service account credentials.

## Testing

```bash
npm test
```

Builds the app and runs the Playwright suite (52 tests) against it. Three servers are
started automatically:

| Project        | Clock pinned to             | Covers                                  |
| -------------- | --------------------------- | --------------------------------------- |
| `desktop`      | `2026-08-10T05:00:00Z`      | read, filters, sorting, CRUD, overdue   |
| `mobile`       | same                        | stacked cards, phone editing            |
| `clock-later`  | `2026-09-15T05:00:00Z`      | stale column N, self-heal on save       |

All three run under `TZ=America/Los_Angeles` — the production spreadsheet's own
timezone — so every run proves the date logic states Asia/Jakarta explicitly instead of
inheriting the host.

Tests assert only on what a user sees and on what lands in the sheet; they read the
stored grid through `/api/test/snapshot` and reset it through `/api/test/reset`. Both
endpoints exist **only when the in-memory transport is bound**, so a deployment can
never expose a reset button.

### Running against a real spreadsheet — not yet possible

The spec names a dedicated throwaway Google Sheet as the reference configuration,
"the only one that proves the real Sheets API calls are correct". That is **not
implemented**, for two reasons:

1. The throwaway sheet does not exist. Creating it needs account access and the spec
   lists it as an operator prerequisite, not implementation work.
2. Every spec resets through `/api/test/reset` and ~15 assertions read
   `/api/test/snapshot`. Against a real sheet those specs would have to reset via
   `npm run seed-test-sheet` in `globalSetup` and read cells back through the Sheets
   API instead.

`tests/global-setup.ts` fails the run with that explanation rather than producing 52
identical 404s. `npm run seed-test-sheet` exists and refuses to touch the production
spreadsheet ID, so step 1 is ready when the sheet is.

Until then every test exercises the in-memory transport. That still covers the write
paths end to end — the fake reproduces the API's trimmed rows and dropped trailing
blanks — but it does not prove the `googleapis` calls themselves.

## Layout

```
src/domain/      pure: dates, row mapping, overdue, aggregation, filtering, validation
src/sheets/      the four-operation transport, plus its Google and in-memory bindings
src/data/        repository (CRUD keyed on (ID IAP, No Langkah)) and static case context
src/app/         page (Server Component read) and actions.ts (Server Actions write)
src/components/  the dashboard UI
scripts/         one-off maintenance against a live spreadsheet
tests/e2e/       the whole test suite
```

The `Tracker` tab's schema is **not** changed by anything here: columns A–O stay exactly
as they are, cell types included (A, E and L numeric; the rest text). Values are written
with `RAW` so `14 Okt 2026` is never reinterpreted as a date by the sheet's US locale.

Every write locates its target row by re-reading the sheet and matching
`(ID IAP, No Langkah)` — never a cached row index — so a save cannot land on the wrong
row after someone else has inserted or deleted one.

Reads are cached for 60 seconds and every mutation busts that cache, which keeps Sheets
API usage flat regardless of traffic (Google allows 60 reads/min per user, 300/min per
project).

## Fixing the spreadsheet's `Dashboard` tab

The `Dashboard` tab's formulas are bounded at row 67 and hardcode one `COUNTIF` row per
known IAP ID, so a tenth case is invisible to it. One-time repair:

```bash
npm run fix-dashboard-tab
```

That previews the change; add `-- --apply` to write it. The `Tracker` tab is not
touched.

## Deployment

Deploys to Vercel as-is. Set `GOOGLE_SHEETS_SPREADSHEET_ID`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` as environment variables, and
leave `SHEETS_TRANSPORT` unset.

**The deployed URL has no authentication** — a deliberate, recorded decision. Any
visitor can read every action item and can create, edit and delete cases and steps.
Note that the tracker's `pembinaan` rows name individual employees in a disciplinary
context.

**Rotate the service account key.** `iap-gapura-01aab7d20653.json` sat unencrypted in
`~/Downloads`; it is gitignored here and must never be committed, but it should be
replaced rather than merely hidden.
