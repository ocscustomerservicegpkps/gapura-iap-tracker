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
    await page.route("**/api/evidence/HU702/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://drive.google.com/file/d/foto-evidence/view",
          name: "briefing.png",
        }),
      });
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
      buffer: Buffer.from("fake-png"),
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
    await page.route("**/api/evidence/HU702/1", async (route) => {
      await uploading;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://drive.google.com/file/d/lambat/view",
          name: "lambat.pdf",
        }),
      });
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
    let uploadCalls = 0;
    let multipartBody = "";
    await page.route("**/api/evidence/HU702/1", async (route) => {
      uploadCalls += 1;
      multipartBody = route.request().postDataBuffer()?.toString("utf8") ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://drive.google.com/file/d/dokumen-bersama/view",
          name: "evidence.pdf",
          stepNos: [1, 2],
        }),
      });
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
      buffer: Buffer.from("fake-pdf"),
    });

    await expect(page.getByTestId("case-evidence-success")).toContainText(
      "ditambahkan ke 2 langkah",
    );
    expect(uploadCalls).toBe(1);
    expect(multipartBody).toContain("[1,2]");
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
