import { expect, test } from "@playwright/test";
import {
  COL,
  editItem,
  expectModalClosed,
  findRow,
  mockEvidenceUpload,
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
  test("menu evidence berurutan dokumen, foto, lalu link", async ({ page }) => {
    await editItem(page, "HU702", 1);
    await expect(page.getByTestId("evidence-modes")).toHaveText(
      /Upload Dokumen\s*Upload Foto\s*Link Evidence/,
    );
    await page.getByRole("button", { name: "Batal" }).click();

    await page.getByTestId("case-edit-HU702").click();
    await expect(page.getByTestId("case-evidence-modes")).toHaveText(
      /Upload Dokumen\s*Upload Foto\s*Link Evidence/,
    );
  });

  test("link tersimpan ke kolom Q dan muncul sebagai tautan pada baris", async ({
    page,
    request,
  }) => {
    await editItem(page, "HU702", 1);
    await page.getByTestId("field-evidence").fill("Daftar hadir briefing.");
    await page.getByTestId("evidence-mode-link").check();
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
    await expect(page.getByTestId("case-evidence-HU702-1")).toHaveText(
      "Click Evidence 1",
    );
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
    await page.getByTestId("evidence-mode-link").check();
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
    await page.getByTestId("evidence-mode-link").check();
    await page
      .getByTestId("field-evidence-link")
      // eslint-disable-next-line no-script-url
      .fill("javascript:alert(1)");
    await page.getByTestId("item-save").click();

    await expect(page.getByTestId("item-modal")).toContainText(
      "Setiap Link Evidence harus berupa URL lengkap yang diawali http:// atau https://.",
    );

    const row = findRow(await readDataRows(request), "HU702", 1);
    expect(row[COL.evidenceLink] ?? "").toBe("");
  });

  test("form Ubah tidak menampilkan link lama dan menyimpan tidak menghapusnya", async ({
    page,
    request,
  }) => {
    await editItem(page, "HU702", 1);
    await page.getByTestId("evidence-mode-link").check();
    await page.getByTestId("field-evidence-link").fill("https://example.com/a");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    await editItem(page, "HU702", 1);
    await page.getByTestId("evidence-mode-link").check();
    await expect(page.getByTestId("field-evidence-link")).toHaveValue("");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    expect(findRow(await readDataRows(request), "HU702", 1)[COL.evidenceLink]).toBe(
      "https://example.com/a",
    );
    await revealItem(page, "HU702", 1);
    await expect(page.getByTestId("evidence-link-HU702-1")).toHaveAttribute(
      "href",
      "https://example.com/a",
    );
  });

  test("user dapat memilih foto dan link hasil upload tersimpan", async ({
    page,
    request,
  }) => {
    await mockEvidenceUpload(page, "**/api/evidence/HU702/1", {
      url: "https://drive.google.com/file/d/foto-evidence/view",
      name: "briefing.png",
    });

    await editItem(page, "HU702", 1);
    await page.getByTestId("evidence-mode-link").check();
    await page
      .getByTestId("field-evidence-link")
      .fill("https://example.com/bukti-sebelumnya");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    await editItem(page, "HU702", 1);
    await page.getByTestId("evidence-mode-photo").check();
    await page.getByTestId("field-evidence-file").setInputFiles({
      name: "briefing.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    await expect(page.getByTestId("evidence-uploaded")).toContainText(
      "briefing.png berhasil diunggah",
    );
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const row = findRow(await readDataRows(request), "HU702", 1);
    expect(row[COL.evidenceLink]).toBe(
      "https://example.com/bukti-sebelumnya\nhttps://drive.google.com/file/d/foto-evidence/view",
    );
  });

  test("penolakan upload berupa teks tetap ditampilkan sebagai pesan yang ramah", async ({
    page,
  }) => {
    await page.route("**/api/evidence/HU702/1", async (route) => {
      await route.fulfill({
        status: 413,
        contentType: "text/plain",
        body: "Request Entity Too Large",
      });
    });

    await editItem(page, "HU702", 1);
    await page.getByTestId("evidence-mode-document").check();
    await page.getByTestId("field-evidence-file").setInputFiles({
      name: "laporan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
    });

    await expect(page.getByTestId("evidence-upload-error")).toHaveText(
      "Ukuran file terlalu besar untuk diunggah. Maksimal 100 MB.",
    );
  });

  test("file di atas 4 MB dikirim langsung ke Drive, bukan melalui Vercel", async ({
    page,
  }) => {
    let appRequestBytes = 0;
    let driveRequestBytes = 0;
    await mockEvidenceUpload(page, "**/api/evidence/HU702/1", {
      url: "https://drive.google.com/file/d/besar/view",
      name: "laporan-besar.pdf",
      onApiRequest: (method, body) => {
        if (method === "POST") appRequestBytes = Buffer.byteLength(body ?? "");
      },
      onDriveUpload: (bytes) => {
        driveRequestBytes += bytes;
      },
    });

    const buffer = Buffer.alloc(5 * 1024 * 1024);
    buffer.write("%PDF-1.4");
    await editItem(page, "HU702", 1);
    await page.getByTestId("evidence-mode-document").check();
    await page.getByTestId("field-evidence-file").setInputFiles({
      name: "laporan-besar.pdf",
      mimeType: "application/pdf",
      buffer,
    });

    await expect(page.getByTestId("evidence-uploaded")).toContainText(
      "laporan-besar.pdf berhasil diunggah",
    );
    expect(appRequestBytes).toBeLessThan(1024);
    expect(driveRequestBytes).toBe(buffer.length);
  });

  /**
   * Saving closes the dialog and refreshes the page, which cancels whatever is
   * still in flight. A user who picks a document and reaches straight for Simpan
   * used to kill their own upload: nothing reached Drive, nothing reached column Q.
   */
  test("Simpan terkunci selama upload evidence masih berjalan", async ({
    page,
    request,
  }) => {
    let release: () => void = () => {};
    const uploading = new Promise<void>((resolve) => {
      release = resolve;
    });
    await mockEvidenceUpload(page, "**/api/evidence/HU702/1", {
      url: "https://drive.google.com/file/d/lambat/view",
      name: "lambat.pdf",
      beforeStart: () => uploading,
    });

    await editItem(page, "HU702", 1);
    await page.getByTestId("evidence-mode-document").check();
    await page.getByTestId("field-evidence-file").setInputFiles({
      name: "lambat.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
    });

    await expect(page.getByTestId("item-evidence-busy")).toBeVisible();
    await expect(page.getByTestId("item-save")).toBeDisabled();

    release();
    await expect(page.getByTestId("evidence-uploaded")).toContainText(
      "lambat.pdf berhasil diunggah",
    );
    await expect(page.getByTestId("item-save")).toBeEnabled();

    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    const row = findRow(await readDataRows(request), "HU702", 1);
    expect(row[COL.evidenceLink]).toBe(
      "https://drive.google.com/file/d/lambat/view",
    );
  });

  test("pilihan dokumen menerima PDF, DOC, dan DOCX", async ({ page }) => {
    await editItem(page, "HU702", 1);
    await page.getByTestId("evidence-mode-document").check();
    await expect(page.getByTestId("field-evidence-file")).toHaveAttribute(
      "accept",
      /\.pdf,\.doc,\.docx/,
    );
  });

  test("Ubah kasus mengunggah satu file untuk beberapa langkah tujuan", async ({
    page,
  }) => {
    let directUploadCalls = 0;
    let initiateBody = "";
    await mockEvidenceUpload(page, "**/api/evidence/HU702/1", {
      url: "https://drive.google.com/file/d/dokumen-bersama/view",
      name: "evidence.pdf",
      onApiRequest: (method, body) => {
        if (method === "POST") {
          directUploadCalls += 1;
          initiateBody = body ?? "";
        }
      },
    });

    await page.getByTestId("case-edit-HU702").click();
    await expect(page.getByTestId("case-evidence-panel")).toBeVisible();
    await page.getByTestId("case-evidence-target-selected").check();
    await page.getByTestId("case-evidence-step-1").check();
    await page.getByTestId("case-evidence-step-2").check();
    await page.getByTestId("case-evidence-mode-document").check();
    await page.getByTestId("case-evidence-file").setInputFiles({
      name: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
    });

    await expect(page.getByTestId("case-evidence-success")).toContainText(
      "ditambahkan ke 2 langkah",
    );
    expect(directUploadCalls).toBe(1);
    expect(initiateBody).toContain("[1,2]");
  });

  test("mengganti input link ke dokumen tidak memicu controlled input warning", async ({
    page,
  }) => {
    const controlledInputWarnings: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("controlled input to be uncontrolled")) {
        controlledInputWarnings.push(message.text());
      }
    });

    await page.getByTestId("case-edit-HU702").click();
    await expect(page.getByTestId("case-evidence-panel")).toBeVisible();
    await page.getByTestId("case-evidence-mode-document").check();
    await page.getByTestId("case-evidence-mode-link").check();

    expect(controlledInputWarnings).toEqual([]);
  });

  test("Ubah kasus menambahkan evidence ke langkah terpilih tanpa menimpa link lama", async ({
    page,
    request,
  }) => {
    await editItem(page, "HU702", 1);
    await page.getByTestId("evidence-mode-link").check();
    await page
      .getByTestId("field-evidence-link")
      .fill("https://example.com/evidence-lama");
    await page.getByTestId("item-save").click();
    await expectModalClosed(page, "item-modal");

    await page.getByTestId("case-edit-HU702").click();
    await expect(page.getByTestId("case-evidence-panel")).toBeVisible();
    await page.getByTestId("case-evidence-target-selected").check();
    await page.getByTestId("case-evidence-step-1").check();
    await page.getByTestId("case-evidence-mode-link").check();
    await page
      .getByTestId("case-evidence-link")
      .fill("https://example.com/evidence-baru");
    await expect(page.getByTestId("case-evidence-upload")).toHaveCount(0);
    await page.getByTestId("case-save").click();
    await expectModalClosed(page, "case-modal");

    const rows = await readDataRows(request);
    expect(findRow(rows, "HU702", 1)[COL.evidenceLink]).toBe(
      "https://example.com/evidence-lama\nhttps://example.com/evidence-baru",
    );
    expect(findRow(rows, "HU702", 2)[COL.evidenceLink] ?? "").toBe("");

    await revealItem(page, "HU702", 1);
    await expect(page.getByTestId("evidence-link-HU702-1")).toHaveAttribute(
      "href",
      "https://example.com/evidence-lama",
    );
    await expect(page.getByTestId("evidence-link-HU702-1-2")).toHaveAttribute(
      "href",
      "https://example.com/evidence-baru",
    );
  });
});
