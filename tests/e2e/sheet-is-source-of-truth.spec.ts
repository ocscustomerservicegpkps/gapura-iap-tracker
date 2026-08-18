import { expect, test } from "@playwright/test";
import { editSheetCell, openDashboard, resetSheet } from "./helpers";

/**
 * The spreadsheet is the record. Someone clearing column Q by hand, or pasting a
 * link into it, is editing that record — and the dashboard has to agree with it on
 * the next load rather than keeping a cached copy of what Q used to say.
 *
 * HU702 rows start at sheet row 2, so step 1 is Q2 and step 2 is Q3.
 */
const MANUAL_LINK = "https://drive.google.com/file/d/diketik-manual/view";
const SECOND_LINK = "https://drive.google.com/file/d/diketik-manual-2/view";

test.beforeEach(async ({ request }) => {
  await resetSheet(request);
});

test.describe("kolom Q yang diubah langsung di spreadsheet", () => {
  test("link yang ditambah manual muncul di UI", async ({ page, request }) => {
    await editSheetCell(request, "Tracker!Q2:Q2", MANUAL_LINK);
    await openDashboard(page);

    await expect(page.getByTestId("evidence-link-HU702-1")).toHaveAttribute(
      "href",
      MANUAL_LINK,
    );
    await expect(page.getByTestId("case-evidence-HU702-1")).toHaveText(
      "Click Evidence 1",
    );
  });

  test("link yang dihapus manual ikut hilang dari UI", async ({
    page,
    request,
  }) => {
    await editSheetCell(request, "Tracker!Q2:Q2", MANUAL_LINK);
    await openDashboard(page);
    await expect(page.getByTestId("case-evidence-HU702-1")).toBeVisible();

    await editSheetCell(request, "Tracker!Q2:Q2", "");
    await page.reload();

    await expect(page.getByTestId("evidence-link-HU702-1")).toHaveCount(0);
    await expect(page.getByTestId("case-evidence-HU702-1")).toHaveCount(0);
  });

  test("beberapa link manual pada satu sel tampil berurutan", async ({
    page,
    request,
  }) => {
    await editSheetCell(
      request,
      "Tracker!Q2:Q2",
      `${MANUAL_LINK}\n${SECOND_LINK}`,
    );
    await openDashboard(page);

    await expect(page.getByTestId("case-evidence-HU702-1")).toHaveAttribute(
      "href",
      MANUAL_LINK,
    );
    await expect(page.getByTestId("case-evidence-HU702-2")).toHaveAttribute(
      "href",
      SECOND_LINK,
    );
  });
});
