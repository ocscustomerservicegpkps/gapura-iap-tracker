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
- **Full CRUD** on action items, on whole IAP cases, and on each case's context.
- **Case context is data, not code.** The six standard fields of an IAP document —
  Kasus/Insiden, Pihak Terkait, Tujuan Dokumen, Tanggal Efektif, Latar Belakang &
  Analisis Akar Masalah, Parameter Keberhasilan (KPI) — live one row per case in a
  `Konteks` tab and are written from the app. A case created in the app carries its own
  context, and empty fields are not rendered at all.
- **Evidence can be linked or uploaded.** Column Q of `Tracker` holds the URL of the
  proof itself. Photos, PDFs, DOCs and DOCX files can be uploaded to the configured
  Drive folder; returned share links are appended one URL per line in Q and all are
  shown in both layouts. The case editor can target every step or selected steps.
- **Charts and a phone layout**, so a PIC can update an item from the ramp.
- **The case prints as the IAP document it came from.** Each row of the case summary
  offers `DOCX` and `PDF`: `/api/export/{ID}?format=docx` writes a Word file laid out
  like the station's own IAP document — header block, root cause, action matrix, KPIs,
  closing, signature — and `/api/export/{ID}` serves the same document as a print page
  that opens the browser's print dialog. Neither costs a dependency: the `.docx` is
  five XML parts in a zip written with `node:zlib`, and the PDF is the browser's own
  "Simpan sebagai PDF".

## Running it

```bash
npm install
npm run dev
```

With no credentials configured the app binds an **in-memory copy of the sheet**, seeded
from the 66-row fixture in `src/fixtures/tracker-fixture.json` and the nine-case context
fixture in `src/fixtures/context-fixture.json`. Nothing touches Google.

To run against the real spreadsheet, copy `.env.example` to `.env.local` and fill in the
service account credentials.

Enable the Google Drive API and set
`GOOGLE_DRIVE_EVIDENCE_FOLDER_ID=1uOd0jovHI70Ff5vQ-cjTu0QXLB4yZsV6`. A service
account has no personal Drive storage quota, so a normal **My Drive** folder must use
the folder owner's OAuth credentials through `GOOGLE_DRIVE_OAUTH_CLIENT_ID`,
`GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, and `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`. A folder
inside a **Shared Drive** may instead use the service account after it is added as a
member. Uploaded files inherit the folder's access; the app does not make them public
automatically.

For a My Drive folder, create a **Desktop app** OAuth client in the same Google Cloud
project, put its client ID and client secret in `.env.local`, then run
`npm run authorize-drive`. Open the printed URL and sign in as the folder owner. The
command stores `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN` in `.env.local` automatically;
restart the application afterward so the new credential is loaded.
Drive filenames follow `ID_Tanggal_Stasiun_Langkah-N_Nama-Asli`, using the target
date and station stored on that Tracker item.

## Testing

```bash
npm test
```

Builds the app and runs the Playwright suite (73 tests) against it. Three servers are
started automatically:

| Project        | Clock pinned to             | Covers                                          |
| -------------- | --------------------------- | ----------------------------------------------- |
| `desktop`      | `2026-08-10T05:00:00Z`      | read, filters, sorting, CRUD, context, evidence, export |
| `mobile`       | same                        | stacked cards, phone editing                    |
| `clock-later`  | `2026-09-15T05:00:00Z`      | stale column N, self-heal on save               |

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
src/domain/      pure: dates, row mapping, overdue, aggregation, filtering, validation,
                 and the case-context record
src/sheets/      the four-operation transport, plus its Google and in-memory bindings
src/data/        two repositories — action items keyed on (ID IAP, No Langkah), and
                 case context keyed on ID IAP
src/app/         page (Server Component read) and actions.ts (Server Actions write)
src/components/  the dashboard UI
scripts/         one-off maintenance against a live spreadsheet
tests/e2e/       the whole test suite
```

The `Tracker` tab keeps columns A–O exactly as they are — nothing is reordered or
retyped (A, E and L numeric; the rest text). One column was **appended**:

| Q                 |
| ----------------- |
| `Link Evidence` — URL of the evidence itself, alongside the `Bukti / Catatan` note in O |

It renders as a link in the table, the phone card and the item form. Because the value
becomes an `href`, anything that is not plainly an `http`/`https` URL is rejected on
save **and** discarded on read — someone typing `javascript:…` straight into the
spreadsheet cell cannot get it into the DOM. Blank is always allowed.

Values are written with `RAW` so `14 Okt 2026` is never reinterpreted as a date by the
sheet's US locale.

### The `Konteks` tab

One row per case, columns A–G, all text — the six standard fields of an IAP document
and nothing else:

| A      | B             | C             | D              | E               | F                                      | G                            |
| ------ | ------------- | ------------- | -------------- | --------------- | -------------------------------------- | ---------------------------- |
| ID IAP | Kasus/Insiden | Pihak Terkait | Tujuan Dokumen | Tanggal Efektif | Latar Belakang & Analisis Akar Masalah | Parameter Keberhasilan (KPI) |

Column G holds one KPI per line in a single cell. Writes locate their row by `ID IAP`,
never by a remembered index, and a context emptied of every field deletes its row rather
than leaving a husk.

Six fields is the standard and the whole of it. What one document carries and another
does not — a warning-letter reference, a closing commitment, the filename it came from
— belongs inside the narrative fields. A schema that grows a column per document
variant is no longer a standard, and `Dokumen Sumber` in particular was the reason
every case used to end with a filename it had no reason to show.

**The application never creates spreadsheet tabs.** Against a live sheet that has no
`Konteks` tab, the dashboard reads as "no context anywhere" and keeps working; saving a
context returns a message naming the tab and the seven headers to add by hand. The same
goes for `Tracker!Q1` — add the `Link Evidence` header yourself. Growing the file's
structure stays the operator's decision.

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
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` and
`GOOGLE_DRIVE_EVIDENCE_FOLDER_ID` as environment variables, and
leave `SHEETS_TRANSPORT` unset.

Evidence uploads need three more: `GOOGLE_DRIVE_OAUTH_CLIENT_ID`,
`GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` and `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`,
obtained with `npm run authorize-drive` as the folder's owner. The service
account can reach Sheets, but it has no Drive storage quota of its own, so an
upload to a My Drive folder must go through the owner's OAuth credentials. Without
them the dashboard still runs and Link Evidence still works — the file pickers
return "Upload file belum aktif di server ini". `.env.local` is local only and is
never pushed, so every one of these has to be set on the host separately.

**The deployed URL has no authentication** — a deliberate, recorded decision. Any
visitor can read every action item and can create, edit and delete cases and steps.
Note that the tracker's `pembinaan` rows name individual employees in a disciplinary
context.

**Rotate the service account key.** `iap-gapura-01aab7d20653.json` sat unencrypted in
`~/Downloads`; it is gitignored here and must never be committed, but it should be
replaced rather than merely hidden.
