import { test } from "node:test";
import assert from "node:assert/strict";
import { isOfflineAuth, isLocalFixtureMode } from "../../src/lib/offline";
import { applicationOrigin, callbackPath, sameOrigin, contentSecurityPolicy } from "../../src/lib/security";
import { coversCase, canAssignStation, hasGlobalAccess } from "../../src/domain/access";
import { branchesOf } from "../../src/domain/branches";
import { matchesEvidenceSignature } from "../../src/domain/evidence-file";
import { limitedFormData, UploadBodyTooLarge } from "../../src/lib/upload-body";
import { safeLinks } from "../../src/domain/rows";
import { validateCaseInput, validateStepInput } from "../../src/domain/validate";

function withEnv(values: Record<string, string>, run: () => void) {
  const before = { ...process.env };
  try { Object.assign(process.env, values); run(); }
  finally { process.env = before; }
}
const branch = { branchCode: "CGK", role: "user", status: "active" };

test("offline privileges cannot coexist with Vercel or Google credentials", () => {
  const local = { ENABLE_OFFLINE_TEST_MODE: "1", SHEETS_TRANSPORT: "memory", VERCEL: "", GOOGLE_SERVICE_ACCOUNT_EMAIL: "", GOOGLE_PRIVATE_KEY: "", GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "", REQUIRE_AUTH_IN_FIXTURE_MODE: "" };
  withEnv(local, () => assert.equal(isOfflineAuth(), true));
  for (const [key, value] of Object.entries({ VERCEL: "1", GOOGLE_SERVICE_ACCOUNT_EMAIL: "real@example.com", GOOGLE_PRIVATE_KEY: "secret", GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "secret", ENABLE_OFFLINE_TEST_MODE: "0", SHEETS_TRANSPORT: "google" })) {
    withEnv({ ...local, [key]: value }, () => assert.equal(isOfflineAuth(), false, key));
  }
  withEnv({ ...local, REQUIRE_AUTH_IN_FIXTURE_MODE: "1" }, () => {
    assert.equal(isLocalFixtureMode(), true); assert.equal(isOfflineAuth(), false);
  });
});
test("branch access covers all case rows and denies inactive/global users", () => {
  assert.equal(coversCase(branch, ["CGK", "DPS"]), false);
  assert.equal(coversCase(branch, ["CGK", "CGK & KNO"]), true);
  assert.equal(coversCase(branch, []), false);
  assert.equal(coversCase({ ...branch, status: "inactive", branchCode: "PUSAT" }, ["DPS"]), false);
  assert.equal(hasGlobalAccess({ ...branch, role: "admin" }), true);
  assert.equal(canAssignStation(branch, "CGK & DPS"), false);
  assert.equal(canAssignStation(branch, "CGK"), true);
  assert.equal(canAssignStation(branch, "DPS"), false);
  assert.equal(canAssignStation(branch, "Unknown"), false);
  assert.equal(branchesOf("CGK Jakarta").includes("HLP"), false);
});
test("auth redirects use canonical config and finite callback paths", () => {
  withEnv({ APP_URL: "https://tracker.example.com", VERCEL: "1" }, () => {
    assert.equal(applicationOrigin(), "https://tracker.example.com");
    assert.equal(sameOrigin(new Request("https://tracker.example.com/upload", { headers: { origin: "https://evil.example.com", "x-forwarded-host": "evil.example.com" } })), false);
    assert.equal(sameOrigin(new Request("https://tracker.example.com/upload", { headers: { origin: "https://tracker.example.com" } })), true);
    assert.equal(sameOrigin(new Request("https://tracker.example.com/upload")), false);
    assert.equal(sameOrigin(new Request("https://tracker.example.com/upload", { headers: { origin: "https://tracker.example.com", "sec-fetch-site": "cross-site" } })), false);
  });
  for (const bad of ["https://user:secret@example.com", "https://example.com/path", "http://example.com", "https://example.com/?x=1"]) {
    withEnv({ APP_URL: bad }, () => assert.throws(applicationOrigin));
  }
  for (const payload of ["//evil.example", "/\\evil.example", "/%5cevil.example", "/login?next=https://evil.example", "javascript:alert(1)", "/\r\nevil"]) assert.equal(callbackPath(payload), "/");
  assert.equal(callbackPath("/reset-password"), "/reset-password");
});
test("evidence rejects executable URLs and disguised upload formats", () => {
  assert.deepEqual(safeLinks("javascript:alert(1)\ndata:text/html,x\nhttps://user:pass@example.com\nhttps://example.com/evidence"), ["https://example.com/evidence"]);
  const fake = new TextEncoder().encode("<html><script>alert(1)</script></html>");
  for (const ext of ["png", "jpg", "pdf", "doc", "docx", "heic", "webp"]) assert.equal(matchesEvidenceSignature(fake, ext), false, ext);
  assert.equal(matchesEvidenceSignature(new TextEncoder().encode("%PDF-1.7\n"), "pdf"), true);
  assert.equal(matchesEvidenceSignature(new Uint8Array([0xff, 0xd8, 0xff]), "jpg"), true);
  assert.equal(matchesEvidenceSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "docx"), false);
});
test("upload body limits actual stream bytes without relying on declared length", async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(100)); controller.enqueue(new Uint8Array(100)); controller.close(); } });
  const request = new Request("http://localhost/upload", { method: "POST", body, duplex: "half", headers: { "content-length": "1" } } as RequestInit);
  await assert.rejects(limitedFormData(request, 150), UploadBodyTooLarge);
  const form = new FormData(); form.set("kind", "photo"); form.set("file", new Blob(["hello"]), "file.png");
  const parsed = await limitedFormData(new Request("http://localhost/upload", { method: "POST", body: form }), 4096);
  assert.equal(parsed.get("kind"), "photo");
});
test("oversized/malformed forms fail before Sheets writes", () => {
  assert.equal(validateStepInput(null as never).ok, false);
  assert.equal(validateCaseInput(null as never).ok, false);
  assert.equal(validateStepInput({ step: "x".repeat(20001), action: "valid" }).ok, false);
  assert.equal(validateCaseInput({ iapId: "x", title: "x", station: "CGK", steps: new Array(101).fill({}) }).ok, false);
});
test("production CSP forbids inline executable content and embedding", () => {
  withEnv({ NODE_ENV: "production" }, () => {
    const csp = contentSecurityPolicy("test-nonce");
    const scripts = csp.split(";").find(part => part.includes("script-src"))!;
    assert.ok(scripts.includes("'nonce-test-nonce'"));
    assert.ok(!scripts.includes("unsafe-inline") && !scripts.includes("unsafe-eval"));
    assert.ok(csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'none'"));
  });
});
