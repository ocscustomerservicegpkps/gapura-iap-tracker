import { expect, test } from "@playwright/test";
import {
  COL,
  editItem,
  expectModalClosed,
  findRow,
  openDashboard,
  readDataRows,
  resetSheet,
  revealItem,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("link evidence", () => {
  test("link tersimpan ke kolom P dan muncul sebagai tautan pada baris", async ({
    page,
    request,
  }) => {
    await editItem(page, "HU702", 1);
    await page.getByTestId("field-evidence").fill("Daftar hadir briefing.");
    await page
      .getByTestId("field-evidence-link")
      .fill("https://drive.google.com/drive/folders/bukti-hu702");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const row = findRow(await readDataRows(request), "HU702", 1);
    expect(row[COL.evidence]).toBe("Daftar hadir briefing.");
    expect(row[COL.evidenceLink]).toBe(
      "https://drive.google.com/drive/folders/bukti-hu702",
    );

    await revealItem(page, "HU702", 1);
    // Both layouts render it: the desktop cell and the phone card.
    for (const testId of ["evidence-link-HU702-1", "card-evidence-link-HU702-1"]) {
      const link = page.getByTestId(testId);
      await expect(link).toHaveAttribute(
        "href",
        "https://drive.google.com/drive/folders/bukti-hu702",
      );
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  test("baris tanpa link tidak menampilkan tautan", async ({ page }) => {
    await revealItem(page, "HU702", 2);
    await expect(page.getByTestId("evidence-link-HU702-2")).toHaveCount(0);
  });

  test("kolom Konteks (P) milik spreadsheet tidak tersentuh saat menyimpan baris", async ({
    page,
    request,
  }) => {
    await editItem(page, "HU702", 1);
    await page.getByTestId("field-evidence").fill("Diubah dari aplikasi.");
    await page
      .getByTestId("field-evidence-link")
      .fill("https://example.com/bukti");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    // A whole-row write covers A:Q, so column P has to survive it untouched.
    const row = findRow(await readDataRows(request), "HU702", 1);
    expect(row[COL.contextNote] ?? "").toBe("");
    expect(row[COL.evidenceLink]).toBe("https://example.com/bukti");
  });

  test("link yang bukan http(s) ditolak dan tidak tersimpan", async ({
    page,
    request,
  }) => {
    await editItem(page, "HU702", 1);
    await page
      .getByTestId("field-evidence-link")
      // eslint-disable-next-line no-script-url
      .fill("javascript:alert(1)");
    await page.getByTestId("item-save").click();

    await expect(page.getByTestId("item-modal")).toContainText(
      "Link Evidence harus URL lengkap yang diawali http:// atau https://.",
    );

    const row = findRow(await readDataRows(request), "HU702", 1);
    expect(row[COL.evidenceLink] ?? "").toBe("");
  });

  test("link dapat dikosongkan kembali", async ({ page, request }) => {
    await editItem(page, "HU702", 1);
    await page.getByTestId("field-evidence-link").fill("https://example.com/a");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    await editItem(page, "HU702", 1);
    await expect(page.getByTestId("field-evidence-link")).toHaveValue(
      "https://example.com/a",
    );
    await page.getByTestId("field-evidence-link").fill("");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    expect(findRow(await readDataRows(request), "HU702", 1)[COL.evidenceLink]).toBe(
      "",
    );
    await revealItem(page, "HU702", 1);
    await expect(page.getByTestId("evidence-link-HU702-1")).toHaveCount(0);
  });
});
