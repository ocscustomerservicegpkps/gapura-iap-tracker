import { expect, test, type Page } from "@playwright/test";
import { openDashboard, resetSheet } from "./helpers";

const rows = (page: Page) => page.getByTestId("table-view").locator("tbody tr");

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("menyaring dan mencari", () => {
  test("filter ID IAP membatasi tabel ke satu kasus", async ({ page }) => {
    await page.getByTestId("filter-iap").selectOption("GA254");

    await expect(rows(page)).toHaveCount(9);
    await expect(page.getByTestId("result-count")).toHaveText(
      "Menampilkan 9 dari 66 item aksi.",
    );
  });

  test("filter status menampilkan hanya status terpilih", async ({ page }) => {
    await page.getByTestId("filter-status").selectOption("Belum Dimulai");

    await expect(rows(page)).toHaveCount(18);
    await expect(rows(page).first()).toContainText("Belum Dimulai");
  });

  test("pencarian mencakup kasus, PIC, teks langkah dan bukti", async ({
    page,
  }) => {
    const search = page.getByTestId("filter-search");

    await search.fill("Load Control");
    await expect(rows(page).first()).toBeVisible();
    const byPic = await rows(page).count();
    expect(byPic).toBeGreaterThan(0);

    await search.fill("Surat permohonan maaf telah dikirim.");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("HU702");

    await search.fill("CZ8138/CZ8354");
    await expect(rows(page)).toHaveCount(7);
  });

  test("filter terlambat menampilkan hanya item yang lewat target", async ({
    page,
  }) => {
    await page.getByTestId("filter-overdue").click();

    await expect(rows(page)).toHaveCount(11);
    for (const cell of await page
      .getByTestId("table-view")
      .locator('[data-testid^="overdue-"]')
      .all()) {
      await expect(cell).toHaveText("TERLAMBAT");
    }
  });

  test("filter jatuh tempo 7 hari menampilkan pekerjaan yang akan jatuh tempo", async ({
    page,
  }) => {
    await page.getByTestId("filter-due-soon").click();

    await expect(rows(page)).toHaveCount(13);
    await expect(page.getByTestId("result-count")).toHaveText(
      "Menampilkan 13 dari 66 item aksi.",
    );
  });

  test("filter dapat digabungkan", async ({ page }) => {
    await page.getByTestId("filter-iap").selectOption("FS-951");
    await page.getByTestId("filter-overdue").click();

    const count = await rows(page).count();
    expect(count).toBe(3);
    await expect(rows(page).first()).toContainText("FS-951");
  });

  test("keadaan kosong ditampilkan saat tidak ada yang cocok", async ({
    page,
  }) => {
    await page.getByTestId("filter-search").fill("zzz tidak ada apa pun zzz");

    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("result-count")).toHaveText(
      "Menampilkan 0 dari 66 item aksi.",
    );
  });

  test("semua filter dapat dihapus sekaligus", async ({ page }) => {
    await page.getByTestId("filter-iap").selectOption("IP200");
    await page.getByTestId("filter-status").selectOption("Selesai");
    await page.getByTestId("filter-search").fill("briefing");
    await expect(rows(page)).not.toHaveCount(66);

    await page.getByTestId("filter-clear").click();

    await expect(rows(page)).toHaveCount(66);
    await expect(page.getByTestId("filter-search")).toHaveValue("");
    await expect(page.getByTestId("filter-clear")).toHaveCount(0);
  });
});
