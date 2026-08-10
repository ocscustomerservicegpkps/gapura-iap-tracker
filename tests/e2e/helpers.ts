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
): Promise<SheetRow[]> {
  const response = await request.get("/api/test/snapshot");
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
  await page.getByTestId(`edit-${iapId}-${stepNo}`).click();
  await expect(page.getByTestId("item-modal")).toBeVisible();
}

export async function saveModal(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).click();
}

/** Wait for a modal to close, which is how the app signals a successful save. */
export async function expectModalClosed(
  page: Page,
  testId: string,
): Promise<void> {
  await expect(page.getByTestId(testId)).toHaveCount(0);
}
