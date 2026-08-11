import { expect, test } from "@playwright/test";
import {
  COL,
  editItem,
  expectModalClosed,
  findRow,
  openDashboard,
  readDataRows,
  revealItem,
  resetSheet,
} from "./helpers";

/**
 * This project runs against a server whose clock is pinned five weeks past the date
 * the sheet's `Status Terlambat` column was last hand-corrected, so the stored values
 * are genuinely stale — the situation the derived column exists to survive.
 */
test.beforeEach(async ({ request }) => {
  await resetSheet(request);
});

test.describe("kolom Status Terlambat yang usang", () => {
  test("nilai tersimpan yang usang diabaikan untuk tampilan", async ({
    page,
    request,
  }) => {
    const stored = findRow(await readDataRows(request), "GA254", 8);
    expect(stored[COL.status]).not.toBe("Selesai");
    expect(stored[COL.overdue]).toBe("Sesuai Rencana");

    await openDashboard(page);
    await revealItem(page, "GA254", 8);

    // Target 17 Agu 2026 is in the past at this server's pinned clock.
    await expect(page.getByTestId("overdue-GA254-8")).toHaveText("Overdue");
  });

  test("hitungan terlambat naik dibanding tanggal referensi", async ({
    page,
  }) => {
    await openDashboard(page);

    // 11 overdue on 10 Aug; by 15 Sep, 32 of the open items have passed target.
    await expect(page.getByTestId("kpi-overdue")).toHaveText("32");
  });

  test("menyimpan baris memperbaiki nilai usang di spreadsheet", async ({
    page,
    request,
  }) => {
    await openDashboard(page);

    expect(findRow(await readDataRows(request), "GA254", 8)[COL.overdue]).toBe(
      "Sesuai Rencana",
    );

    await editItem(page, "GA254", 8);
    await page.getByTestId("field-evidence").fill("Diperbarui oleh PIC.");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const healed = findRow(await readDataRows(request), "GA254", 8);
    expect(healed[COL.overdue]).toBe("TERLAMBAT");
    expect(healed[COL.evidence]).toBe("Diperbarui oleh PIC.");
  });

  test("penomoran ulang setelah hapus sekaligus memperbaiki nilai usang", async ({
    page,
    request,
  }) => {
    await openDashboard(page);
    expect(findRow(await readDataRows(request), "GA254", 8)[COL.overdue]).toBe(
      "Sesuai Rencana",
    );

    // Deleting an early row renumbers everything below it, and those rows get
    // their derived Status Terlambat written in the same batch.
    await page.getByTestId("delete-HU702-1").click();
    await page.getByTestId("confirm-delete").click();
    await expect(page.getByTestId("kpi-total")).toHaveText("65");

    const rows = await readDataRows(request);
    expect(findRow(rows, "GA254", 8)[COL.overdue]).toBe("TERLAMBAT");
    expect(rows.map((row) => Number(row[COL.no]))).toEqual(
      Array.from({ length: 65 }, (_, i) => i + 1),
    );
  });

  test("memuat halaman saja tidak menulis apa pun", async ({ page, request }) => {
    const before = JSON.stringify(await readDataRows(request));

    await openDashboard(page);
    await page.reload();
    await expect(page.getByTestId("kpi-total")).toHaveText("66");

    expect(JSON.stringify(await readDataRows(request))).toBe(before);
  });
});
