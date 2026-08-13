import { expect, test } from "@playwright/test";
import { openDashboard, resetSheet } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetSheet(request);
});

test.describe("ekspor dokumen IAP", () => {
  test("unduhan DOCX adalah berkas Word berisi dokumen kasus", async ({
    request,
  }) => {
    const response = await request.get("/api/export/HU702?format=docx");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(response.headers()["content-disposition"]).toContain(
      'filename="IAP-HU702.docx"',
    );

    const file = await response.body();
    // A docx is a zip; the parts are stored uncompressed, so the document text sits
    // in the bytes as-is and a malformed writer shows up here without unzipping.
    expect(file.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const xml = file.toString("utf8");
    expect(xml).toContain("word/document.xml");
    expect(xml).toContain("IMPROVEMENT ACTION PLAN (IAP)");
    // Header context and matrix rows both originate from the Tracker tab.
    expect(xml).toContain("Hainan Airlines (HU)");
    expect(xml).toContain("Monitoring, Audit &amp; Review Berkelanjutan");
    expect(xml).toContain("Status");
    expect(xml).toContain("Sedang Berjalan");
  });

  test("halaman cetak memuat keempat bagian dokumen", async ({ request }) => {
    const response = await request.get("/api/export/HU702");

    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain("I. LATAR BELAKANG");
    expect(html).toContain("II. MATRIKS RENCANA PERBAIKAN");
    expect(html).toContain("<th>Status</th>");
    expect(html).toContain("III. PARAMETER KEBERHASILAN");
    expect(html).toContain("IV. PENUTUP &amp; KOMITMEN MANAJEMEN");
    // The page prints itself, so "PDF" is one click and the browser's own dialog.
    expect(html).toContain('onload="window.print()"');
  });

  test("kasus yang tidak ada menjawab 404", async ({ request }) => {
    const response = await request.get("/api/export/TIDAK-ADA");

    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("tidak ditemukan");
  });

  test("ringkasan memakai tautan langsung tanpa menu bahasa", async ({
    page,
  }) => {
    await openDashboard(page);

    await expect(page.getByTestId("case-pdf-HU702")).toHaveAttribute(
      "href",
      "/api/export/HU702",
    );
    await expect(page.getByTestId("case-docx-HU702")).toHaveAttribute(
      "href",
      "/api/export/HU702?format=docx",
    );
    await expect(page.getByTestId("case-pdf-id-HU702")).toHaveCount(0);
    await expect(page.getByTestId("case-pdf-en-HU702")).toHaveCount(0);
  });

  test("setiap item aksi menawarkan unduhan PDF dan DOCX kasusnya", async ({
    page,
  }) => {
    await openDashboard(page);

    await expect(page.getByTestId("item-pdf-HU702-1")).toHaveAttribute(
      "href",
      "/api/export/HU702",
    );
    await expect(page.getByTestId("item-docx-HU702-1")).toHaveAttribute(
      "href",
      "/api/export/HU702?format=docx",
    );
    await expect(page.getByTestId("item-pdf-GA254-1")).toHaveAttribute(
      "href",
      "/api/export/GA254",
    );
  });
});
