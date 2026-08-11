import { expect, test } from "@playwright/test";
import { openDashboard, resetSheet } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetSheet(request);
});

test.describe("membaca tracker", () => {
  test("kartu KPI menampilkan total dan rincian status", async ({ page }) => {
    await openDashboard(page);

    await expect(page.getByTestId("kpi-total")).toHaveText("66");
    await expect(page.getByTestId("kpi-closed")).toHaveText("27");
    await expect(page.getByTestId("kpi-inProgress")).toHaveText("21");
    await expect(page.getByTestId("kpi-open")).toHaveText("18");
    await expect(page.getByTestId("kpi-overdue")).toHaveText("11");
    await expect(page.getByTestId("pct-closed")).toHaveText("41%");
  });

  test("ringkasan per kasus menampilkan sembilan kasus dengan rinciannya", async ({
    page,
  }) => {
    await openDashboard(page);

    const summary = page.getByTestId("case-summary");
    await expect(summary.locator("tbody tr")).toHaveCount(9);

    const expected: Array<[string, number]> = [
      ["HU702", 6],
      ["GA254", 9],
      ["TR273/275/245", 8],
      ["FS-951", 9],
      ["IP200", 7],
      ["GA159", 8],
      ["GA-121", 6],
      ["CZ8138/CZ8354", 7],
      ["IP207", 6],
    ];

    for (const [iapId, total] of expected) {
      const row = page.getByTestId(`case-row-${iapId}`);
      // The ID cell is a row header (`th`), so Total is the first `td`.
      await expect(row.locator("td").nth(1)).toHaveText(String(total));
    }
  });

  test("tabel menampilkan seluruh 66 item aksi dengan kasus, stasiun dan bukti", async ({
    page,
  }) => {
    await openDashboard(page);

    const table = page.getByTestId("table-view");
    await expect(table.locator('[data-testid^="row-"]')).toHaveCount(10);
    await expect(page.getByTestId("result-count")).toHaveText(
      "Menampilkan 66 dari 66 item aksi.",
    );

    const firstRow = page.getByTestId("row-HU702-1");
    await expect(firstRow).toContainText("HU702");
    await expect(firstRow).toContainText("Hainan Airlines (HU) - Stasiun CGK");
    await expect(firstRow).toContainText(
      "Langkah 1: Respons Formal & Koordinasi Awal",
    );
    await expect(firstRow).toContainText("Intl. Airlines Account Management");
    await expect(firstRow).toContainText("18 Jul 2026");
    await expect(firstRow).toContainText("Completed");
    await expect(firstRow).toContainText("100%");
    await expect(firstRow).toContainText("Surat permohonan maaf telah dikirim.");
  });

  test("item terlambat dibedakan secara visual dari yang sesuai rencana", async ({
    page,
  }) => {
    await openDashboard(page);

    await expect(page.getByTestId("overdue-HU702-3")).toHaveText("Overdue");
    await expect(page.getByTestId("overdue-HU702-1")).toHaveText("-");

    const late = page.getByTestId("overdue-HU702-3");
    const onPlan = page.getByTestId("overdue-GA254-4");
    await expect(onPlan).toHaveText("On Track");
    expect(await late.evaluate((el) => getComputedStyle(el).color)).not.toBe(
      await onPlan.evaluate((el) => getComputedStyle(el).color),
    );
  });

  test("konteks kasus menampilkan enam bidang standar", async ({ page }) => {
    await openDashboard(page);

    await page.getByTestId("case-context-GA159").click();
    const modal = page.getByTestId("case-context-modal");

    await expect(modal).toContainText("Kasus / Insiden");
    await expect(modal).toContainText("Threads");
    await expect(modal).toContainText("Pihak Terkait");
    await expect(modal).toContainText("Tujuan Dokumen");
    await expect(modal).toContainText("Tanggal Efektif");
    await expect(modal).toContainText("Latar Belakang & Analisis Akar Masalah");
    await expect(modal).toContainText("Parameter Keberhasilan");
    await expect(modal.getByTestId("case-context-kpis").locator("li")).toHaveCount(6);
    // The standard has six fields and no seventh: no filename is shown anywhere.
    await expect(modal).not.toContainText("Sumber dokumen");
    await expect(modal).not.toContainText(".pdf");
    await expect(modal).not.toContainText(".docx");
  });

  test("grafik ringkasan ditampilkan", async ({ page }) => {
    await openDashboard(page);

    const charts = page.getByTestId("charts");
    await expect(charts).toContainText("Komposisi Status");
    await expect(charts).toContainText("Status per Kasus IAP");
    await expect(charts).toContainText("Jatuh Tempo Item Terbuka");
    await expect(charts.locator("svg text").first()).toHaveText("66");
  });
});
