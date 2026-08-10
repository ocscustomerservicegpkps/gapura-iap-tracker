import { expect, test } from "@playwright/test";
import {
  COL,
  contiguousFromOne,
  keyedRows,
  numbering,
  openDashboard,
  readDataRows,
  resetSheet,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("menghapus", () => {
  test("dialog konfirmasi menyebut jumlah baris yang terhapus", async ({
    page,
  }) => {
    await page.getByTestId("case-delete-GA254").click();

    const dialog = page.getByTestId("confirm-dialog");
    await expect(dialog).toContainText("GA254");
    await expect(dialog).toContainText("9 baris akan dihapus");
    await expect(page.getByTestId("confirm-delete")).toHaveText(
      "Hapus 9 baris",
    );
  });

  test("membatalkan tidak menyentuh spreadsheet", async ({ page, request }) => {
    const before = keyedRows(await readDataRows(request));

    await page.getByTestId("case-delete-GA254").click();
    await page.getByTestId("confirm-cancel").click();

    await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
    expect(keyedRows(await readDataRows(request))).toEqual(before);
    await expect(page.getByTestId("kpi-total")).toHaveText("66");
  });

  test("menghapus satu item hanya menghapus satu baris dan menomori ulang", async ({
    page,
    request,
  }) => {
    const before = keyedRows(await readDataRows(request));

    await page.getByTestId("delete-HU702-3").click();
    await expect(page.getByTestId("confirm-dialog")).toContainText(
      "1 baris akan dihapus",
    );
    await page.getByTestId("confirm-delete").click();

    await expect(page.getByTestId("kpi-total")).toHaveText("65");

    const after = await readDataRows(request);
    expect(after).toHaveLength(65);
    expect(numbering(after)).toEqual(contiguousFromOne(65));

    const afterKeyed = keyedRows(after);
    expect(afterKeyed.has("HU702|3")).toBe(false);
    for (const key of before.keys()) {
      if (key === "HU702|3") continue;
      expect(afterKeyed.has(key), `row ${key} must survive`).toBe(true);
    }
  });

  test("menghapus kasus menghapus tepat baris kasus itu", async ({
    page,
    request,
  }) => {
    const before = await readDataRows(request);
    const survivors = keyedRows(
      before.filter((row) => row[COL.iapId] !== "GA254"),
    );

    await page.getByTestId("case-delete-GA254").click();
    await page.getByTestId("confirm-delete").click();

    await expect(page.getByTestId("kpi-total")).toHaveText("57");
    await expect(page.getByTestId("case-row-GA254")).toHaveCount(0);

    const after = await readDataRows(request);
    expect(after).toHaveLength(57);
    expect(after.some((row) => row[COL.iapId] === "GA254")).toBe(false);
    expect(numbering(after)).toEqual(contiguousFromOne(57));

    // Everything that was not GA254 is byte-identical apart from column A.
    const afterKeyed = keyedRows(
      after.map((row) => [...row].map((cell, i) => (i === COL.no ? "" : cell))),
    );
    const beforeKeyed = keyedRows(
      before
        .filter((row) => row[COL.iapId] !== "GA254")
        .map((row) => [...row].map((cell, i) => (i === COL.no ? "" : cell))),
    );
    expect(afterKeyed).toEqual(beforeKeyed);
    expect(survivors.size).toBe(57);
  });
});
