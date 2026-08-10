import { expect, test, type Page } from "@playwright/test";
import { openDashboard, resetSheet } from "./helpers";

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

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("mengurutkan", () => {
  test("tanggal target diurutkan kronologis, bukan alfabetis", async ({
    page,
  }) => {
    await page.getByTestId("sort-targetDate").click();

    const dates = (await columnText(page, "target-")).map(toSortable);
    expect(dates).toEqual([...dates].sort());

    // The case lexical sorting gets wrong: "30 Jul" must precede "9 Agu".
    const july30 = dates.indexOf("2026-07-30");
    const august9 = dates.indexOf("2026-08-09");
    expect(july30).toBeGreaterThan(-1);
    expect(august9).toBeGreaterThan(-1);
    expect(july30).toBeLessThan(august9);
  });

  test("klik kedua membalik arah pengurutan", async ({ page }) => {
    await page.getByTestId("sort-targetDate").click();
    const ascending = (await columnText(page, "target-")).map(toSortable);

    await page.getByTestId("sort-targetDate").click();
    const descending = (await columnText(page, "target-")).map(toSortable);

    expect(descending).toEqual([...ascending].reverse());
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
        page.getByTestId("table-view").locator("tbody tr"),
      ).toHaveCount(66);
    }
  });

  test("progres diurutkan sebagai angka", async ({ page }) => {
    await page.getByTestId("sort-progress").click();

    const values = (await columnText(page, "row-")).length;
    expect(values).toBe(66);

    const first = page.getByTestId("table-view").locator("tbody tr").first();
    await expect(first).toContainText("0%");

    await page.getByTestId("sort-progress").click();
    await expect(
      page.getByTestId("table-view").locator("tbody tr").first(),
    ).toContainText("100%");
  });
});
