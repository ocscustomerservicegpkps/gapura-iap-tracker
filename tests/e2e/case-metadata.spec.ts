import { expect, test } from "@playwright/test";
import {
  COL,
  expectModalClosed,
  keyedRows,
  openDashboard,
  readDataRows,
  resetSheet,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("mengubah metadata kasus", () => {
  test("mengganti judul memperbarui seluruh baris kasus", async ({
    page,
    request,
  }) => {
    const before = await readDataRows(request);
    const affected = before.filter((row) => row[COL.iapId] === "FS-951");
    expect(affected).toHaveLength(9);

    await page.getByTestId("case-edit-FS-951").click();
    await expect(page.getByTestId("case-modal")).toContainText(
      "diterapkan ke 9 baris kasus ini",
    );

    await page
      .getByTestId("case-field-title")
      .fill("FS-951 - Judul Baru Hasil Uji");
    await page
      .getByTestId("case-field-station")
      .fill("PT Airfast Indonesia - Stasiun Baru");
    await page.getByTestId("case-save").click();
    await expectModalClosed(page, "case-modal");

    const after = await readDataRows(request);
    const updated = after.filter((row) => row[COL.iapId] === "FS-951");
    expect(updated).toHaveLength(9);
    for (const row of updated) {
      expect(row[COL.title]).toBe("FS-951 - Judul Baru Hasil Uji");
      expect(row[COL.station]).toBe("PT Airfast Indonesia - Stasiun Baru");
    }

    await expect(page.getByTestId("case-row-FS-951")).toContainText(
      "FS-951 - Judul Baru Hasil Uji",
    );
  });

  test("kasus lain tidak ikut berubah", async ({ page, request }) => {
    const before = keyedRows(
      (await readDataRows(request)).filter((row) => row[COL.iapId] !== "FS-951"),
    );

    await page.getByTestId("case-edit-FS-951").click();
    await page.getByTestId("case-field-title").fill("FS-951 - Judul Lain");
    await page.getByTestId("case-save").click();
    await expectModalClosed(page, "case-modal");

    const after = keyedRows(
      (await readDataRows(request)).filter((row) => row[COL.iapId] !== "FS-951"),
    );
    expect(after).toEqual(before);
  });

  test("ID IAP tidak dapat diubah dari modal kasus", async ({ page }) => {
    await page.getByTestId("case-edit-GA254").click();
    await expect(page.getByTestId("case-field-id")).toBeDisabled();
    await expect(page.getByTestId("case-field-id")).toHaveValue("GA254");
  });
});
