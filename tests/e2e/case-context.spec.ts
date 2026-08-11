import { expect, test } from "@playwright/test";
import {
  CTX,
  expectModalClosed,
  openDashboard,
  readContextRows,
  resetSheet,
  startNewCase,
  wizardTo,
} from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await resetSheet(request);
  await openDashboard(page);
});

test.describe("konteks kasus", () => {
  test("tab Konteks menyimpan tepat enam bidang standar", async ({ request }) => {
    const header = (await readContextRows(request, { header: true }))[0]!;
    expect(header).toEqual([
      "ID IAP",
      "Kasus / Insiden",
      "Pihak Terkait",
      "Tujuan Dokumen",
      "Tanggal Efektif",
      "Latar Belakang & Analisis Akar Masalah",
      "Parameter Keberhasilan (KPI)",
    ]);
  });

  test("konteks dokumen ditampilkan dari tab Konteks, bukan dari kode", async ({
    page,
  }) => {
    await page.getByTestId("case-context-HU702").click();

    const modal = page.getByTestId("case-context-modal");
    await expect(modal).toContainText(
      "selisih jumlah bagasi terhadap load sheet",
    );
    await expect(modal).toContainText("Hainan Airlines (HU)");
    await expect(modal).toContainText("16 Juli 2026");
    await expect(page.getByTestId("case-context-kpis").locator("li")).toHaveCount(
      4,
    );
  });

  test("bagian yang kosong tidak ditampilkan", async ({ page, request }) => {
    await page.getByTestId("case-context-GA-121").click();
    await page.getByTestId("case-context-edit").click();
    await page.getByTestId("context-field-purpose").fill("");
    await page.getByTestId("case-save").click();
    await expectModalClosed(page, "case-modal");

    expect((await readContextRows(request)).get("GA-121")?.[CTX.purpose]).toBe("");

    await page.getByTestId("case-context-GA-121").click();
    const modal = page.getByTestId("case-context-modal");
    await expect(modal).toContainText("Latar Belakang & Analisis Akar Masalah");
    await expect(modal).not.toContainText("Tujuan Dokumen");
  });

  test("konteks kasus yang ada dapat diubah dan tersimpan ke sheet", async ({
    page,
    request,
  }) => {
    await page.getByTestId("case-context-GA-121").click();
    await page.getByTestId("case-context-edit").click();
    await expect(page.getByTestId("case-modal")).toBeVisible();

    await page.getByTestId("context-field-effective-date").fill("1 Sep 2026");
    await page.getByTestId("context-field-kpis").fill("KPI Satu\n\nKPI Dua");
    await page.getByTestId("case-save").click();
    await expectModalClosed(page, "case-modal");

    const row = (await readContextRows(request)).get("GA-121");
    expect(row?.[CTX.effectiveDate]).toBe("1 Sep 2026");
    // Blank lines are dropped rather than stored as empty bullets.
    expect(row?.[CTX.kpis]).toBe("KPI Satu\nKPI Dua");

    await page.getByTestId("case-context-GA-121").click();
    await expect(page.getByTestId("case-context-kpis").locator("li")).toHaveCount(
      2,
    );
  });

  test("kasus baru dapat menuliskan konteksnya sendiri saat dibuat", async ({
    page,
    request,
  }) => {
    await startNewCase(page, {
      iapId: "IP810",
      title: "IP810 - Pelanggaran Prosedur Bagasi Tercatat (CGK-KDI)",
    });

    await wizardTo(page, 1);
    await page
      .getByTestId("context-field-incident")
      .fill("IP810 CGK-KDI 27 Juli 2026 - penerbitan label bagasi tanpa bagasi fisik.");
    await page.getByTestId("context-field-effective-date").fill("12 Agustus 2026");
    await page
      .getByTestId("context-field-kpis")
      .fill("Zero Repeat Unofficial Payment\nZero HP Onduty Violation");

    await wizardTo(page, 2);
    await page.getByTestId("steps.0.field-step").fill("Investigasi & Klarifikasi Awal");
    await page
      .getByTestId("steps.0.field-action")
      .fill("Skorsing staff; investigasi bersama AVSEC Gapura CGK.");
    await page.getByTestId("case-save").click();
    await expectModalClosed(page, "case-modal");

    const row = (await readContextRows(request)).get("IP810");
    expect(row).toHaveLength(7);
    expect(row?.[CTX.effectiveDate]).toBe("12 Agustus 2026");
    expect(row?.[CTX.kpis]).toBe(
      "Zero Repeat Unofficial Payment\nZero HP Onduty Violation",
    );

    await page.getByTestId("case-context-IP810").click();
    await expect(page.getByTestId("case-context-modal")).toContainText(
      "12 Agustus 2026",
    );
  });

  test("kasus tanpa konteks menawarkan pengisian", async ({ page }) => {
    await startNewCase(page, {
      iapId: "XX999",
      title: "XX999 - Kasus Tanpa Dokumen",
    });
    await wizardTo(page, 2);
    await page.getByTestId("steps.0.field-step").fill("Langkah");
    await page.getByTestId("steps.0.field-action").fill("Tindakan");
    await page.getByTestId("case-save").click();
    await expectModalClosed(page, "case-modal");

    await expect(page.getByTestId("case-context-XX999")).toHaveText("+ Konteks");
    await page.getByTestId("case-context-XX999").click();
    await expect(page.getByTestId("case-context-empty")).toBeVisible();
    await expect(page.getByTestId("case-context-edit")).toHaveText("Isi Konteks");
  });

  test("menghapus kasus juga menghapus barisnya di tab Konteks", async ({
    page,
    request,
  }) => {
    expect((await readContextRows(request)).has("GA-121")).toBe(true);

    await page.getByTestId("case-delete-GA-121").click();
    await page.getByTestId("confirm-delete").click();
    await expectModalClosed(page, "confirm-dialog");

    expect((await readContextRows(request)).has("GA-121")).toBe(false);
  });

  test("langkah dapat diurutkan ulang sebelum kasus disimpan", async ({ page }) => {
    await startNewCase(page, { iapId: "QZ7070", title: "QZ7070 - Uji Urutan" });
    await wizardTo(page, 2);
    await page.getByTestId("case-add-step").click();

    await page.getByTestId("steps.0.field-step").fill("Pertama");
    await page.getByTestId("steps.1.field-step").fill("Kedua");
    await page.getByTestId("case-move-up-1").click();

    await expect(page.getByTestId("steps.0.field-step")).toHaveValue("Kedua");
    await expect(page.getByTestId("steps.1.field-step")).toHaveValue("Pertama");
    await expect(page.getByTestId("case-move-up-0")).toBeDisabled();
  });
});
