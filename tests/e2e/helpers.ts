import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Column positions in the `Tracker` tab. The schema is fixed; these never move. */
export const COL = {
  no: 0,
  iapId: 1,
  title: 2,
  station: 3,
  stepNo: 4,
  step: 5,
  action: 6,
  pic: 7,
  timeline: 8,
  targetDate: 9,
  status: 10,
  progress: 11,
  actualDate: 12,
  overdue: 13,
  evidence: 14,
  contextNote: 15,
  evidenceLink: 16,
} as const;

/** Column positions in the `Konteks` tab, one row per case. */
export const CTX = {
  iapId: 0,
  incident: 1,
  parties: 2,
  purpose: 3,
  effectiveDate: 4,
  rootCause: 5,
  kpis: 6,
} as const;

export type SheetRow = string[];

/** Restore the sheet to the 66-row fixture. */
export async function resetSheet(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/test/reset");
  expect(
    response.ok(),
    "reset endpoint requires SHEETS_TRANSPORT=memory",
  ).toBeTruthy();
}

/** Raw grid as stored, header row included. */
export async function readSheet(
  request: APIRequestContext,
  tab?: string,
): Promise<SheetRow[]> {
  const response = await request.get(
    tab ? `/api/test/snapshot?tab=${encodeURIComponent(tab)}` : "/api/test/snapshot",
  );
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { rows: SheetRow[] };
  return body.rows;
}

/** Data rows only. */
export async function readDataRows(
  request: APIRequestContext,
): Promise<SheetRow[]> {
  return (await readSheet(request)).slice(1);
}

/** The `Konteks` tab's data rows, keyed by `ID IAP`. */
export async function readContextRows(
  request: APIRequestContext,
): Promise<Map<string, SheetRow>>;
/** The raw grid instead, header row included. */
export async function readContextRows(
  request: APIRequestContext,
  options: { header: true },
): Promise<SheetRow[]>;
export async function readContextRows(
  request: APIRequestContext,
  options?: { header: true },
): Promise<Map<string, SheetRow> | SheetRow[]> {
  const grid = await readSheet(request, "Konteks");
  if (options?.header) return grid;
  return new Map(grid.slice(1).map((row) => [row[CTX.iapId]!, row]));
}

export function findRow(
  rows: SheetRow[],
  iapId: string,
  stepNo: number,
): SheetRow {
  const row = rows.find(
    (r) => r[COL.iapId] === iapId && Number(r[COL.stepNo]) === stepNo,
  );
  if (!row) throw new Error(`Row ${iapId}/${stepNo} not found in sheet`);
  return row;
}

/** Every row keyed by `(ID IAP, No Langkah)`, for byte-level comparisons. */
export function keyedRows(rows: SheetRow[]): Map<string, string> {
  return new Map(
    rows.map((row) => [
      `${row[COL.iapId]}|${row[COL.stepNo]}`,
      JSON.stringify(row),
    ]),
  );
}

/** Column A read top to bottom — should always be a contiguous 1..N. */
export function numbering(rows: SheetRow[]): number[] {
  return rows.map((row) => Number(row[COL.no]));
}

export function contiguousFromOne(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}

export async function openDashboard(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("kpi-total")).toBeVisible();
}

/** Open the edit modal for one action item from the desktop table. */
export async function editItem(
  page: Page,
  iapId: string,
  stepNo: number,
): Promise<void> {
  await revealItem(page, iapId, stepNo);
  await page.getByTestId(`edit-${iapId}-${stepNo}`).click();
  await expect(page.getByTestId("item-modal")).toBeVisible();
}

/** Render one desktop row whichever page it would otherwise fall on. */
export async function revealItem(
  page: Page,
  iapId: string,
  stepNo: number,
): Promise<void> {
  await revealAllItems(page);
  await expect(page.getByTestId(`row-${iapId}-${stepNo}`)).toHaveCount(1);
}

/**
 * Drop the tracker's page limit when an assertion needs the whole filtered set.
 * "All" is one of the offered row counts, so this drives the same control a reader
 * would rather than a test-only escape hatch.
 */
export async function revealAllItems(page: Page): Promise<void> {
  await page.getByTestId("page-size").selectOption("all");
}

export async function saveModal(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).click();
}

/** Open "+ Kasus IAP Baru" and fill page 1 of the wizard. */
export async function startNewCase(
  page: Page,
  identity: { iapId: string; title?: string; station?: string },
): Promise<void> {
  await page.getByTestId("new-case").click();
  await expect(page.getByTestId("case-modal")).toBeVisible();
  await page.getByTestId("case-field-id").fill(identity.iapId);
  if (identity.title !== undefined) {
    await page.getByTestId("case-field-title").fill(identity.title);
  }
  if (identity.station !== undefined) {
    await page.getByTestId("case-field-station").fill(identity.station);
  }
}

/**
 * Advance the create wizard to a given page (0 identity, 1 context, 2 steps).
 * Clicks until it arrives rather than a fixed number of times, so it works from
 * wherever the test already is.
 */
export async function wizardTo(page: Page, target: number): Promise<void> {
  for (let guard = 0; guard <= target; guard++) {
    if ((await page.getByTestId(`case-page-${target}`).count()) > 0) break;
    await page.getByTestId("case-next").click();
  }
  await expect(page.getByTestId(`case-page-${target}`)).toBeVisible();
}

/** Wait for a modal to close, which is how the app signals a successful save. */
export async function expectModalClosed(
  page: Page,
  testId: string,
): Promise<void> {
  await expect(page.getByTestId(testId)).toHaveCount(0);
}
