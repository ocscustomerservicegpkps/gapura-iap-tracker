import { expect, test } from "@playwright/test";
import {
  COL,
  editItem,
  editSheetCell,
  expectModalClosed,
  findRow,
  openDashboard,
  readDataRows,
  resetSheet,
} from "./helpers";

/**
 * Column Q is the evidence trail. A link in it must open the document read-only,
 * so that following one cannot put anybody into an editor over the evidence.
 */
test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("link evidence hanya bisa dilihat", () => {
  test("link Google Docs yang diketik user disimpan sebagai preview", async ({
    page,
    request,
  }) => {
    await editItem(page, "HU702", 1);
    await page.getByTestId("evidence-mode-link").check();
    await page
      .getByTestId("field-evidence-link")
      .fill(
        "https://docs.google.com/document/d/1lzTnKgvrOaialD1pRVygIVM/edit?usp=drivesdk&rtpof=true",
      );
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const row = findRow(await readDataRows(request), "HU702", 1);
    expect(row[COL.evidenceLink]).toBe(
      "https://docs.google.com/document/d/1lzTnKgvrOaialD1pRVygIVM/preview",
    );
  });

  test("link Drive kehilangan query yang ditempelkan Drive", async ({
    page,
    request,
  }) => {
    await editItem(page, "HU702", 2);
    await page.getByTestId("evidence-mode-link").check();
    await page
      .getByTestId("field-evidence-link")
      .fill("https://drive.google.com/file/d/1abcDEF/view?usp=drivesdk");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const row = findRow(await readDataRows(request), "HU702", 2);
    expect(row[COL.evidenceLink]).toBe(
      "https://drive.google.com/file/d/1abcDEF/view",
    );
  });

  /** Someone else's system is not ours to rewrite. */
  test("link di luar Google dibiarkan apa adanya", async ({ page, request }) => {
    await editItem(page, "HU702", 3);
    await page.getByTestId("evidence-mode-link").check();
    await page
      .getByTestId("field-evidence-link")
      .fill("https://portal.gapura.id/evidence/812?ref=iap");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const row = findRow(await readDataRows(request), "HU702", 3);
    expect(row[COL.evidenceLink]).toBe(
      "https://portal.gapura.id/evidence/812?ref=iap",
    );
  });

  test("baris yang masih menyimpan link /edit lama diperbaiki saat disimpan", async ({
    page,
    request,
  }) => {
    await editSheetCell(
      request,
      "Tracker!Q5:Q5",
      "https://docs.google.com/document/d/1lamaEDIT/edit?usp=drivesdk",
    );

    await page.reload();
    await editItem(page, "HU702", 4);
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const row = findRow(await readDataRows(request), "HU702", 4);
    expect(row[COL.evidenceLink]).toBe(
      "https://docs.google.com/document/d/1lamaEDIT/preview",
    );
  });
});
