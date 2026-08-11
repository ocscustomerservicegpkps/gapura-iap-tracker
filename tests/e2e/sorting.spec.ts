import { expect, test, type Page } from "@playwright/test";
import { openDashboard, resetSheet, revealAllItems } from "./helpers";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Deliberately re-implemented in the test rather than imported from the app. */
function toSortable(text: string): string {
  const [day, month, year] = text.trim().split(/\s+/);
  const monthIndex = MONTHS.indexOf(month ?? "");
  expect(monthIndex, `unknown month in "${text}"`).toBeGreaterThan(-1);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function columnText(page: Page, testIdPrefix: string): Promise<string[]> {
  return page
    .getByTestId("table-view")
    .locator(`[data-testid^="${testIdPrefix}"]`)
    .allInnerTexts();
}

async function datesByCase(page: Page): Promise<Record<string, string[]>> {
  const groups = await page
    .getByTestId("table-view")
    .locator('tbody[data-testid^="group-"]')
    .all();
  const entries: Array<[string, string[]]> = [];
  for (const group of groups) {
    const key = await group.getAttribute("data-testid");
    if (!key) continue;
    const dates = (await group.locator('[data-testid^="target-"]').allInnerTexts()).map(
      toSortable,
    );
    entries.push([key, dates]);
  }
  return Object.fromEntries(entries);
}

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("mengurutkan", () => {
  test("tanggal target diurutkan kronologis, bukan alfabetis", async ({
    page,
  }) => {
    await page.getByTestId("sort-targetDate").click();
    await revealAllItems(page);

    for (const dates of Object.values(await datesByCase(page))) {
      expect(dates).toEqual([...dates].sort());
    }
  });

  test("klik kedua membalik arah pengurutan", async ({ page }) => {
    await page.getByTestId("sort-targetDate").click();
    await revealAllItems(page);
    const ascending = await datesByCase(page);

    await page.getByTestId("sort-targetDate").click();
    await revealAllItems(page);
    const descending = await datesByCase(page);

    expect(Object.keys(descending).sort()).toEqual(Object.keys(ascending).sort());
    for (const [group, dates] of Object.entries(ascending)) {
      expect(descending[group]).toEqual([...dates].reverse());
    }
  });

  test("setiap kolom dapat diurutkan dan arahnya dapat dibalik", async ({
    page,
  }) => {
    const columns = [
      "no",
      "iapId",
      "step",
      "pic",
      "timeline",
      "targetDate",
      "status",
      "progress",
      "overdue",
      "evidence",
    ];

    const headerFor = (column: string) =>
      page
        .getByTestId("table-view")
        .locator("thead th")
        .filter({ has: page.getByTestId(`sort-${column}`) });

    const activeColumns = async () => {
      const headers = await page
        .getByTestId("table-view")
        .locator('thead th[aria-sort]:not([aria-sort="none"]) button')
        .all();
      return Promise.all(headers.map((h) => h.getAttribute("data-testid")));
    };

    for (const column of columns) {
      const header = headerFor(column);

      await page.getByTestId(`sort-${column}`).click();
      const first = await header.getAttribute("aria-sort");
      expect(first, `${column} should become the sorted column`).not.toBe(
        "none",
      );
      expect(await activeColumns()).toEqual([`sort-${column}`]);

      await page.getByTestId(`sort-${column}`).click();
      expect(
        await header.getAttribute("aria-sort"),
        `${column} should flip direction on a second click`,
      ).not.toBe(first);

      await expect(
        page.getByTestId("table-view").locator('[data-testid^="row-"]'),
      ).toHaveCount(10);
    }
  });

  test("progres diurutkan sebagai angka", async ({ page }) => {
    await page.getByTestId("sort-progress").click();

    const values = (await columnText(page, "row-")).length;
    expect(values).toBe(10);

    const first = page
      .getByTestId("table-view")
      .locator('[data-testid^="row-"]')
      .first();
    await expect(first).toContainText("0%");

    await page.getByTestId("sort-progress").click();
    await expect(
      page
        .getByTestId("table-view")
        .locator('[data-testid^="row-"]')
        .first(),
    ).toContainText("100%");
  });
});
