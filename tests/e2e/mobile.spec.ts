import { expect, test } from "@playwright/test";
import {
  COL,
  expectModalClosed,
  findRow,
  openDashboard,
  readDataRows,
  resetSheet,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("tampilan telepon", () => {
  test("tabel menjadi kartu bertumpuk, bukan gulir horizontal", async ({
    page,
  }) => {
    await expect(page.getByTestId("card-view")).toBeVisible();
    await expect(page.getByTestId("table-view")).toBeHidden();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("kartu KPI tetap terbaca dan mengalir dua kolom", async ({ page }) => {
    const cards = page.getByTestId("kpi-cards");
    await expect(cards).toBeVisible();

    const total = page.getByTestId("kpi-total");
    await expect(total).toHaveText("66");
    const fontSize = await total.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(24);

    const box = await cards.locator("> div").first().boundingBox();
    const viewport = page.viewportSize();
    expect(box!.width).toBeLessThan(viewport!.width * 0.6);
  });

  test("item dapat diubah sampai selesai dari modal layar penuh", async ({
    page,
    request,
  }) => {
    await page.getByTestId("card-edit-HU702-4").click();

    const modal = page.getByTestId("item-modal");
    await expect(modal).toBeVisible();

    const modalBox = await modal.boundingBox();
    const viewport = page.viewportSize();
    expect(modalBox!.width).toBeGreaterThanOrEqual(viewport!.width - 1);

    await page.getByTestId("field-status").selectOption("Selesai");
    await page.getByTestId("field-actual-date").fill("2026-08-08");
    await page
      .getByTestId("field-evidence")
      .fill("Ditutup dari telepon di apron.");
    await page.getByTestId("item-save").click();

    await expectModalClosed(page, "item-modal");
    await expect(page.getByTestId("card-HU702-4")).toContainText("Selesai");
    await expect(page.getByTestId("card-HU702-4")).toContainText("100%");

    const row = findRow(await readDataRows(request), "HU702", 4);
    expect(row[COL.status]).toBe("Selesai");
    expect(row[COL.actualDate]).toBe("8 Agu 2026");
    expect(row[COL.evidence]).toBe("Ditutup dari telepon di apron.");
  });

  test("filter tetap terjangkau sebagai bilah lengket", async ({ page }) => {
    const bar = page.getByTestId("filter-bar");
    await expect(bar).toHaveCSS("position", "sticky");

    await page.getByTestId("filter-iap").selectOption("IP200");
    await expect(page.getByTestId("result-count")).toHaveText(
      "Menampilkan 7 dari 66 item aksi.",
    );
  });
});
