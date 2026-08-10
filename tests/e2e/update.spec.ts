import { expect, test } from "@playwright/test";
import {
  COL,
  editItem,
  expectModalClosed,
  findRow,
  keyedRows,
  openDashboard,
  readDataRows,
  resetSheet,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("memperbarui item aksi", () => {
  test("perubahan status, progres, tanggal dan bukti tersimpan ke baris yang benar", async ({
    page,
    request,
  }) => {
    await editItem(page, "HU702", 3);

    await page.getByTestId("field-status").selectOption("Selesai");
    await page.getByTestId("field-actual-date").fill("2026-08-05");
    await page.getByTestId("field-evidence").fill("Coaching selesai 5 Agustus.");
    await page.getByTestId("item-save").click();

    await expectModalClosed(page, "item-modal");

    const row = findRow(await readDataRows(request), "HU702", 3);
    expect(row[COL.status]).toBe("Selesai");
    expect(row[COL.progress]).toBe("100");
    expect(row[COL.actualDate]).toBe("5 Agu 2026");
    expect(row[COL.evidence]).toBe("Coaching selesai 5 Agustus.");
    // A closed item is never late.
    expect(row[COL.overdue]).toBe("-");
  });

  test("perubahan langsung terlihat di halaman setelah disimpan", async ({
    page,
  }) => {
    await editItem(page, "GA254", 4);
    await page.getByTestId("field-progress").fill("75");
    await page.getByTestId("field-evidence").fill("Bukti baru dari uji e2e.");
    await page.getByTestId("item-save").click();

    await expectModalClosed(page, "item-modal");
    await expect(page.getByTestId("row-GA254-4")).toContainText("75%");
    await expect(page.getByTestId("row-GA254-4")).toContainText(
      "Bukti baru dari uji e2e.",
    );
  });

  test("tanggal dipilih dari kalender dan ditulis dalam format Indonesia", async ({
    page,
    request,
  }) => {
    await editItem(page, "IP200", 4);
    await page.getByTestId("field-target-date").fill("2026-12-01");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const row = findRow(await readDataRows(request), "IP200", 4);
    expect(row[COL.targetDate]).toBe("1 Des 2026");
    await expect(page.getByTestId("target-IP200-4")).toHaveText("1 Des 2026");
  });

  test("menandai Selesai menetapkan progres 100%", async ({ page }) => {
    await editItem(page, "GA159", 5);
    await page.getByTestId("field-progress").fill("20");
    await page.getByTestId("field-status").selectOption("Selesai");

    await expect(page.getByTestId("field-progress")).toHaveValue("100");
  });

  test("Selesai tanpa tanggal selesai aktual ditolak", async ({
    page,
    request,
  }) => {
    const before = keyedRows(await readDataRows(request));

    await editItem(page, "GA159", 5);
    await page.getByTestId("field-status").selectOption("Selesai");
    await page.getByTestId("field-actual-date").fill("");
    await page.getByTestId("item-save").click();

    await expect(page.getByTestId("item-modal")).toBeVisible();
    await expect(page.getByTestId("item-modal")).toContainText(
      "Item Selesai wajib mencantumkan Tanggal Selesai Aktual.",
    );
    expect(keyedRows(await readDataRows(request))).toEqual(before);
  });

  test("langkah perbaikan kosong ditolak", async ({ page, request }) => {
    const before = keyedRows(await readDataRows(request));

    await editItem(page, "IP207", 2);
    await page.getByTestId("field-step").fill("   ");
    await page.getByTestId("item-save").click();

    await expect(page.getByTestId("item-modal")).toContainText(
      "Langkah Perbaikan wajib diisi.",
    );
    expect(keyedRows(await readDataRows(request))).toEqual(before);
  });

  test("menyimpan satu baris tidak menyentuh baris lain", async ({
    page,
    request,
  }) => {
    const before = keyedRows(await readDataRows(request));

    await editItem(page, "CZ8138/CZ8354", 2);
    await page.getByTestId("field-pic").fill("PIC hasil uji e2e");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const after = keyedRows(await readDataRows(request));
    expect(after.size).toBe(before.size);

    for (const [key, value] of before) {
      if (key === "CZ8138/CZ8354|2") {
        expect(after.get(key)).not.toBe(value);
      } else {
        expect(after.get(key), `row ${key} must be byte-identical`).toBe(value);
      }
    }
  });

  test("kolom Status Terlambat ikut diperbarui saat baris disimpan", async ({
    page,
    request,
  }) => {
    // A step that is still open and already past its target date.
    await editItem(page, "HU702", 3);
    await page.getByTestId("field-target-date").fill("2026-12-31");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const row = findRow(await readDataRows(request), "HU702", 3);
    expect(row[COL.targetDate]).toBe("31 Des 2026");
    expect(row[COL.overdue]).toBe("Sesuai Rencana");
    await expect(page.getByTestId("overdue-HU702-3")).toHaveText(
      "Sesuai Rencana",
    );
  });
});
