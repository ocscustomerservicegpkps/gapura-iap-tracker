import { test, expect } from "@playwright/test";
import { resetSheet, openDashboard, revealItem, editSheetCell } from "./helpers";

test.beforeEach(async ({ request }) => { await resetSheet(request); });

test("unsafe evidence typed directly into Sheets never becomes a browser link", async ({ page, request }) => {
  await editSheetCell(request, "Tracker!Q2", "javascript:alert(document.cookie)");
  await openDashboard(page);
  await revealItem(page, "HU702", 1);
  await expect(page.getByTestId("evidence-link-HU702-1")).toHaveCount(0);
  await expect(page.getByTestId("card-evidence-link-HU702-1")).toHaveCount(0);
});

test("export escapes stored HTML and uses a nonce for printing", async ({ request }) => {
  await editSheetCell(request, "Tracker!C2", '<script>window.__securityProbe=1</script>');
  const response = await request.get("/api/export/HU702");
  const html = await response.text();
  expect(html).not.toContain('<script>window.__securityProbe=1</script>');
  expect(html).toContain('&lt;script&gt;window.__securityProbe=1&lt;/script&gt;');
  expect(html).toMatch(/<script nonce="[A-Za-z0-9+/=]+">/);
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("browser CSP blocks injected inline scripts and preserves dashboard interaction", async ({ page }) => {
  // Inject a parser-created script into the response, retaining the real CSP header.
  await page.route("**/", async route => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace("</body>", "<script>window.__securityProbe=1</script></body>") });
  });
  await openDashboard(page);
  const probe = await page.evaluate(() => (window as typeof window & { __securityProbe?: number }).__securityProbe);
  expect(probe).toBeUndefined();
  await page.getByTestId("case-edit-HU702").click();
  await expect(page.getByTestId("case-modal")).toBeVisible();
});

test("upload rejects absent/cross-site origins and spoofed proxy hosts", async ({ request }) => {
  const candidates: Record<string, string>[] = [{}, { origin: "https://evil.example" }, { origin: "https://evil.example", "x-forwarded-host": "evil.example" }];
  for (const headers of candidates) {
    const response = await request.post("/api/evidence/HU702/1", { headers });
    expect(response.status()).toBe(403);
  }
});
