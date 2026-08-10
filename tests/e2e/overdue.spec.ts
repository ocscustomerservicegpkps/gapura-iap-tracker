import { expect, test } from "@playwright/test";
import {
  COL,
  editItem,
  expectModalClosed,
  findRow,
  openDashboard,
  readDataRows,
  resetSheet,
} from "./helpers";

/**
 * The clock is pinned to 2026-08-10T05:00Z — noon in Jakarta, but still 2026-08-09
 * in the spreadsheet's own America/Los_Angeles timezone, which the test servers also
 * run under. Every expectation below is the Jakarta answer.
 */
test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("penurunan status terlambat", () => {
  test("hari ini dievaluasi terhadap zona Asia/Jakarta", async ({ page }) => {
    await expect(page.getByTestId("today")).toHaveText(
      "Hari ini (WIB): 10 Agustus 2026",
    );
  });

  test("satu hari lewat target terbaca TERLAMBAT", async ({ page, request }) => {
    await editItem(page, "GA254", 4);
    await page.getByTestId("field-status").selectOption("Sedang Berjalan");
    await page.getByTestId("field-target-date").fill("2026-08-09");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    await expect(page.getByTestId("overdue-GA254-4")).toHaveText("TERLAMBAT");
    expect(findRow(await readDataRows(request), "GA254", 4)[COL.overdue]).toBe(
      "TERLAMBAT",
    );
  });

  test("satu hari sebelum target terbaca Sesuai Rencana", async ({ page }) => {
    await editItem(page, "GA254", 4);
    await page.getByTestId("field-status").selectOption("Sedang Berjalan");
    await page.getByTestId("field-target-date").fill("2026-08-11");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    await expect(page.getByTestId("overdue-GA254-4")).toHaveText(
      "Sesuai Rencana",
    );
  });

  test("target hari ini belum terlambat", async ({ page }) => {
    await editItem(page, "GA254", 4);
    await page.getByTestId("field-status").selectOption("Sedang Berjalan");
    await page.getByTestId("field-target-date").fill("2026-08-10");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    await expect(page.getByTestId("overdue-GA254-4")).toHaveText(
      "Sesuai Rencana",
    );
  });

  test("item Selesai yang lewat target tidak dihitung terlambat", async ({
    page,
    request,
  }) => {
    await editItem(page, "GA254", 4);
    await page.getByTestId("field-target-date").fill("2026-01-15");
    await page.getByTestId("field-status").selectOption("Selesai");
    await page.getByTestId("field-actual-date").fill("2026-01-20");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    await expect(page.getByTestId("overdue-GA254-4")).toHaveText("-");
    expect(findRow(await readDataRows(request), "GA254", 4)[COL.overdue]).toBe(
      "-",
    );
  });

  test("batas zona waktu: target kemarin di Jakarta sudah terlambat meski hari ini masih kemarin di Los Angeles", async ({
    page,
  }) => {
    const overdueBefore = await page.getByTestId("kpi-overdue").innerText();

    await editItem(page, "GA254", 4);
    await page.getByTestId("field-status").selectOption("Sedang Berjalan");
    // 9 Aug is the local date in America/Los_Angeles at the pinned instant, so a
    // dashboard that inherited the spreadsheet's zone would call this on plan.
    await page.getByTestId("field-target-date").fill("2026-08-09");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    await expect(page.getByTestId("overdue-GA254-4")).toHaveText("TERLAMBAT");
    await expect(page.getByTestId("kpi-overdue")).toHaveText(
      String(Number(overdueBefore) + 1),
    );
  });
});
