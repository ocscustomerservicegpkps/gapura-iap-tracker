import { expect, test, type Page } from "@playwright/test";
import { openDashboard, resetSheet } from "./helpers";

const rows = (page: Page) =>
  page.getByTestId("table-view").locator('[data-testid^="row-"]');

const bands = (page: Page) =>
  page.getByTestId("table-view").locator('tbody[data-testid^="group-"]');

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("halaman tabel", () => {
  test("tabel terbuka pada sepuluh baris pertama", async ({ page }) => {
    await expect(rows(page)).toHaveCount(10);
    await expect(rows(page).first()).toHaveAttribute(
      "data-testid",
      "row-HU702-1",
    );
    await expect(page.getByTestId("page-size")).toHaveValue("10");
    // 66 rows at ten a page.
    await expect(page.getByTestId("page-7")).toBeVisible();
    await expect(page.getByTestId("page-8")).toHaveCount(0);
  });

  test("gulir tak hingga sudah diganti kontrol halaman", async ({ page }) => {
    await expect(page.getByTestId("load-more")).toHaveCount(0);
    await expect(page.getByTestId("page-prev")).toBeVisible();
    await expect(page.getByTestId("page-next")).toBeVisible();
  });

  test("berikutnya dan sebelumnya berjalan melewati seluruh 66 item", async ({
    page,
  }) => {
    await expect(page.getByTestId("page-prev")).toBeDisabled();

    await page.getByTestId("page-next").click();
    await expect(rows(page).first()).toHaveAttribute(
      "data-testid",
      "row-GA254-5",
    );
    await expect(page.getByTestId("page-prev")).toBeEnabled();

    await page.getByTestId("page-7").click();
    // The tail page holds the remainder, not a padded ten.
    await expect(rows(page)).toHaveCount(6);
    await expect(page.getByTestId("page-next")).toBeDisabled();

    await page.getByTestId("page-prev").click();
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByTestId("page-6")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("baris per halaman dapat diubah, termasuk seluruh baris sekaligus", async ({
    page,
  }) => {
    await page.getByTestId("page-size").selectOption("25");
    await expect(rows(page)).toHaveCount(25);
    await expect(page.getByTestId("page-3")).toBeVisible();
    await expect(page.getByTestId("page-4")).toHaveCount(0);

    await page.getByTestId("page-size").selectOption("all");
    await expect(rows(page)).toHaveCount(66);
    await expect(page.getByTestId("page-next")).toHaveCount(0);
  });

  test("mode per kasus memberi satu kasus IAP utuh per halaman", async ({
    page,
  }) => {
    await page.getByTestId("page-size").selectOption("case");

    // Nine cases, so nine pages — never a case split across a boundary.
    await expect(page.getByTestId("page-9")).toBeVisible();
    await expect(page.getByTestId("page-10")).toHaveCount(0);
    await expect(bands(page)).toHaveCount(1);
    await expect(rows(page)).toHaveCount(6);
    await expect(page.getByTestId("page-1")).toHaveAttribute(
      "aria-label",
      "Case 1",
    );

    await page.getByTestId("page-4").click();
    await expect(bands(page)).toHaveCount(1);
    await expect(bands(page)).toHaveAttribute("data-testid", "group-FS-951");
    await expect(rows(page)).toHaveCount(9);
  });

  test("pita kasus menghitung seluruh kasus, bukan potongan halamannya", async ({
    page,
  }) => {
    // Page one ends mid-GA254: four of its nine rows are on screen.
    await expect(
      bands(page).filter({ hasText: "GA254" }).locator("th"),
    ).toContainText("9 item");
    await expect(
      page.getByTestId("table-view").locator('[data-testid^="row-GA254-"]'),
    ).toHaveCount(4);
  });

  test("menyaring dan mengurutkan mengembalikan ke halaman pertama", async ({
    page,
  }) => {
    await page.getByTestId("page-5").click();
    await expect(page.getByTestId("page-5")).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.getByTestId("sort-progress").click();
    await expect(page.getByTestId("page-1")).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.getByTestId("page-4").click();
    await page.getByTestId("filter-overdue").click();
    // Eleven overdue rows: two pages, back at the first.
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByTestId("page-1")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("satu halaman penuh tidak menampilkan kontrol halaman sama sekali", async ({
    page,
  }) => {
    await page.getByTestId("filter-iap").selectOption("IP200");

    await expect(rows(page)).toHaveCount(7);
    await expect(page.getByTestId("page-next")).toHaveCount(0);
    // The count line and the row-count control stay; only the pager goes.
    await expect(page.getByTestId("page-size")).toBeVisible();
    await expect(page.getByTestId("result-count")).toHaveText(
      "Menampilkan 7 dari 66 item aksi.",
    );
  });

  test("keadaan kosong menawarkan jalan keluarnya sendiri", async ({ page }) => {
    await page.getByTestId("filter-search").fill("zzz tidak ada apa pun zzz");

    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("page-size")).toHaveCount(0);

    await page.getByTestId("empty-clear-filters").click();

    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByTestId("filter-search")).toHaveValue("");
    await expect(page.getByTestId("result-count")).toHaveText(
      "Menampilkan 66 dari 66 item aksi.",
    );
  });
});
