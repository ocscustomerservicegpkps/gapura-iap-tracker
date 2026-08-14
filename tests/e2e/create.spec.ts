import { expect, test } from "@playwright/test";
import {
  COL,
  contiguousFromOne,
  expectModalClosed,
  findRow,
  numbering,
  openDashboard,
  readDataRows,
  resetSheet,
  startNewCase,
  wizardTo,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("menambah item aksi", () => {
  test("tombol + Item pada ringkasan kasus membuka formulir untuk kasus itu", async ({
    page,
  }) => {
    await page.getByTestId("case-add-item-GA159").click();

    const modal = page.getByTestId("item-modal");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("GA159");
    await expect(modal).toContainText("otomatis");
  });

  test("langkah baru masuk ke kasus yang benar dengan nomor otomatis", async ({
    page,
    request,
  }) => {
    await page.getByTestId("filter-iap").selectOption("IP207");
    await page.getByTestId("new-item").click();
    await expect(page.getByTestId("item-modal")).toBeVisible();

    await page.getByTestId("field-step").fill("Audit Lanjutan");
    await page.getByTestId("field-action").fill("Audit internal tahap kedua.");
    await page.getByTestId("field-pic").fill("Manager Ops SUB");
    await page.getByTestId("field-timeline").fill("14 hari");
    await page.getByTestId("field-target-date").fill("2026-10-14");
    await page.getByTestId("item-save").click();

    await expectModalClosed(page, "item-modal");

    const rows = await readDataRows(request);
    expect(rows).toHaveLength(67);

    // IP207 already had steps 1..6, so the new one is step 7.
    const created = findRow(rows, "IP207", 7);
    expect(created[COL.step]).toBe("Audit Lanjutan");
    expect(created[COL.targetDate]).toBe("14 Okt 2026");
    expect(created[COL.status]).toBe("Belum Dimulai");
    expect(created[COL.progress]).toBe("0");
    expect(created[COL.overdue]).toBe("Sesuai Rencana");

    // Case metadata is inherited so the case cannot split in two.
    const sibling = findRow(rows, "IP207", 1);
    expect(created[COL.title]).toBe(sibling[COL.title]);
    expect(created[COL.station]).toBe(sibling[COL.station]);
    for (let column = COL.contextIncident; column <= COL.contextKpis; column += 1) {
      expect(created[column]).toBe(sibling[column]);
    }

    expect(numbering(rows)).toEqual(contiguousFromOne(67));
    await expect(page.getByTestId("kpi-total")).toHaveText("67");
  });
});

test.describe("membuat kasus IAP baru", () => {
  test("foto evidence dipilih saat membuat kasus lalu diunggah setelah row tersedia", async ({
    page,
    request,
  }) => {
    const uploads: string[] = [];
    await page.route("**/api/evidence/NEW-UPLOAD/1", async (route) => {
      uploads.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://drive.google.com/file/d/new-upload-evidence/view",
          name: "foto-ramp.png",
        }),
      });
    });

    await startNewCase(page, {
      iapId: "NEW-UPLOAD",
      title: "NEW-UPLOAD - Uji Evidence",
      station: "Stasiun CGK",
    });
    await wizardTo(page, 2);
    await page.getByTestId("steps.0.field-step").fill("Investigasi");
    await page.getByTestId("steps.0.field-action").fill("Dokumentasi lapangan.");
    await page.getByTestId("steps.0.field-target-date").fill("2026-08-20");

    await page.getByTestId("steps.0.evidence-mode-photo").check();
    await page.getByTestId("steps.0.field-evidence-file").setInputFiles({
      name: "foto-ramp.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-png"),
    });
    await expect(page.getByTestId("steps.0.evidence-uploaded")).toContainText(
      "siap diunggah saat kasus disimpan",
    );

    // Changing evidence type discards the old selection; a photo must not be
    // uploaded while the UI says the active choice is a document.
    await page.getByTestId("steps.0.evidence-mode-document").check();
    await expect(page.getByTestId("steps.0.evidence-uploaded")).toHaveCount(0);
    await page.getByTestId("steps.0.evidence-mode-photo").check();
    await page.getByTestId("steps.0.field-evidence-file").setInputFiles({
      name: "foto-ramp.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-png"),
    });

    await page.getByTestId("case-save").click();
    await expectModalClosed(page, "case-modal");
    expect(uploads).toHaveLength(1);
    expect(findRow(await readDataRows(request), "NEW-UPLOAD", 1)[COL.step]).toBe(
      "Investigasi",
    );
  });

  test("pembangun langkah menulis seluruh baris kasus sekaligus", async ({
    page,
    request,
  }) => {
    await startNewCase(page, {
      iapId: "QZ7788",
      title: "QZ7788 - Keterlambatan Pushback (DPS)",
      station: "Indonesia AirAsia (QZ) - Stasiun DPS",
    });
    await wizardTo(page, 2);

    await page.getByTestId("case-add-step").click();
    await page.getByTestId("case-add-step").click();
    await expect(page.getByTestId("case-step-2")).toBeVisible();

    const steps = [
      {
        step: "Investigasi Awal",
        action: "Menyusun kronologi kejadian.",
        evidenceLink: "https://drive.google.com/file/d/qz7788-langkah-1/view",
      },
      { step: "Pembinaan Petugas", action: "Briefing tim ramp handling." },
      { step: "Penguatan SOP", action: "Revisi SOP pushback." },
    ];

    for (const [index, draft] of steps.entries()) {
      await page.getByTestId(`steps.${index}.field-step`).fill(draft.step);
      await page.getByTestId(`steps.${index}.field-action`).fill(draft.action);
      await page
        .getByTestId(`steps.${index}.field-target-date`)
        .fill("2026-11-30");
      if (draft.evidenceLink) {
        await page.getByTestId(`steps.${index}.evidence-mode-link`).check();
        await page
          .getByTestId(`steps.${index}.field-evidence-link`)
          .fill(draft.evidenceLink);
      }
    }

    await page.getByTestId("case-save").click();
    await expectModalClosed(page, "case-modal");

    const rows = await readDataRows(request);
    expect(rows).toHaveLength(69);

    for (const [index, draft] of steps.entries()) {
      const row = findRow(rows, "QZ7788", index + 1);
      expect(row[COL.step]).toBe(draft.step);
      expect(row[COL.action]).toBe(draft.action);
      expect(row[COL.title]).toBe("QZ7788 - Keterlambatan Pushback (DPS)");
      expect(row[COL.station]).toBe("Indonesia AirAsia (QZ) - Stasiun DPS");
      expect(row[COL.targetDate]).toBe("30 Nov 2026");
      expect(row[COL.evidenceLink] ?? "").toBe(draft.evidenceLink ?? "");
    }

    expect(numbering(rows)).toEqual(contiguousFromOne(69));
    await expect(page.getByTestId("case-row-QZ7788")).toBeVisible();
    await expect(page.getByTestId("kpi-total")).toHaveText("69");
  });

  test("langkah dapat dihapus kembali saat menyusun kasus", async ({ page }) => {
    await startNewCase(page, { iapId: "QZ0001", title: "Uji" });
    await wizardTo(page, 2);
    await page.getByTestId("case-add-step").click();
    await expect(page.getByTestId("case-step-1")).toBeVisible();

    await page.getByTestId("case-remove-step-1").click();

    await expect(page.getByTestId("case-step-1")).toHaveCount(0);
    await expect(page.getByTestId("case-step-0")).toBeVisible();
  });

  test("ID IAP yang sudah ada ditolak dan kembali ke halaman identitas", async ({
    page,
    request,
  }) => {
    await startNewCase(page, { iapId: "GA254", title: "Duplikat" });
    await wizardTo(page, 2);
    await page.getByTestId("steps.0.field-step").fill("Langkah");
    await page.getByTestId("steps.0.field-action").fill("Tindakan");
    await page.getByTestId("case-save").click();

    // The failure belongs to page 1, so the wizard goes back there to show it.
    await expect(page.getByTestId("case-page-0")).toBeVisible();
    await expect(page.getByTestId("case-error-id")).toContainText(
      'ID IAP "GA254" sudah digunakan oleh kasus lain.',
    );
    expect(await readDataRows(request)).toHaveLength(66);
  });

  test("kasus tanpa judul tidak dapat melewati halaman identitas", async ({
    page,
    request,
  }) => {
    await startNewCase(page, { iapId: "XX111" });
    await page.getByTestId("case-next").click();

    await expect(page.getByTestId("case-page-0")).toBeVisible();
    await expect(page.getByTestId("case-modal")).toContainText(
      "Judul IAP / Kasus wajib diisi.",
    );
    expect(await readDataRows(request)).toHaveLength(66);
  });
});

test.describe("stepper pembuatan kasus", () => {
  test("tiga langkah, maju dan mundur, tanpa melompati identitas", async ({
    page,
  }) => {
    await page.getByTestId("new-case").click();

    const stepper = page.getByTestId("case-stepper");
    await expect(stepper).toContainText("Identitas Kasus");
    await expect(stepper).toContainText("Konteks Kasus");
    await expect(stepper).toContainText("Langkah Perbaikan");

    // Nothing ahead is reachable until it has been walked.
    await expect(page.getByTestId("case-stepper-1")).toBeDisabled();
    await expect(page.getByTestId("case-stepper-2")).toBeDisabled();
    await expect(page.getByTestId("case-page-0")).toBeVisible();
    await expect(page.getByTestId("case-save")).toHaveCount(0);

    await page.getByTestId("case-field-id").fill("QZ4242");
    await page.getByTestId("case-field-title").fill("QZ4242 - Uji Stepper");

    await page.getByTestId("case-next").click();
    await expect(page.getByTestId("case-page-1")).toBeVisible();
    await expect(page.getByTestId("context-field-incident")).toBeVisible();

    await page.getByTestId("case-next").click();
    await expect(page.getByTestId("case-page-2")).toBeVisible();
    await expect(page.getByTestId("steps.0.field-step")).toBeVisible();
    // Save only exists on the last page.
    await expect(page.getByTestId("case-save")).toBeVisible();
    await expect(page.getByTestId("case-next")).toHaveCount(0);

    await page.getByTestId("case-back").click();
    await expect(page.getByTestId("case-page-1")).toBeVisible();

    // Ground already covered is clickable.
    await page.getByTestId("case-stepper-0").click();
    await expect(page.getByTestId("case-page-0")).toBeVisible();
    await expect(page.getByTestId("case-field-id")).toHaveValue("QZ4242");
  });

  test("isian tiap langkah bertahan saat berpindah halaman", async ({ page }) => {
    await startNewCase(page, { iapId: "QZ5151", title: "QZ5151 - Uji Simpan" });
    await wizardTo(page, 1);
    await page.getByTestId("context-field-parties").fill("Indonesia AirAsia (QZ)");
    await wizardTo(page, 2);
    await page.getByTestId("steps.0.field-step").fill("Investigasi Awal");

    await page.getByTestId("case-stepper-1").click();
    await expect(page.getByTestId("context-field-parties")).toHaveValue(
      "Indonesia AirAsia (QZ)",
    );
    await page.getByTestId("case-stepper-2").click();
    await expect(page.getByTestId("steps.0.field-step")).toHaveValue(
      "Investigasi Awal",
    );
  });
});
