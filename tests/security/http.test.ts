import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { once } from "node:events";

// Auth service is simulated locally. Nothing reaches Supabase/Google or live data.
test("HTTP security gates and server actions with simulated sessions", { timeout: 60000 }, async () => {
  const profiles: Record<string, Record<string, string>> = {
    branch: { id: "branch", email: "branch@example.test", full_name: "Branch", branch_code: "CGK", role: "user", status: "active" },
    other: { id: "other", email: "other@example.test", full_name: "Other", branch_code: "DPS", role: "user", status: "active" },
    inactive: { id: "inactive", email: "inactive@example.test", full_name: "Inactive", branch_code: "PUSAT", role: "admin", status: "inactive" },
    pending: { id: "pending", email: "pending@example.test", full_name: "Pending", branch_code: "CGK", role: "user", status: "pending" },
    admin: { id: "admin", email: "admin@example.test", full_name: "Admin", branch_code: "CGK", role: "admin", status: "active" },
    invalid: { id: "invalid", email: "invalid@example.test", full_name: "Invalid", branch_code: "CGK", role: "admin", status: "unexpected" },
  };
  const mock = createServer((req, res) => {
    const url = new URL(req.url!, "http://127.0.0.1:3202");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/user") {
      try {
        const jwt = req.headers.authorization!.split(" ")[1]!;
        const { sub } = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString());
        const profile = profiles[sub];
        if (!profile) throw new Error("invalid token");
        res.end(JSON.stringify({ id: sub, aud: "authenticated", role: "authenticated", email: profile.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }));
      } catch { res.statusCode = 401; res.end(JSON.stringify({ code: "bad_jwt", msg: "Invalid token" })); }
    } else if (url.pathname === "/rest/v1/profiles") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      res.end(JSON.stringify(profiles[id ?? ""] ?? null));
    } else { res.statusCode = 404; res.end("{}"); }
  });
  mock.listen(3202, "127.0.0.1"); await once(mock, "listening");
  const base = "http://127.0.0.1:3200";
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3200", "-H", "127.0.0.1"], {
    env: { ...process.env, NODE_ENV: "production", IAP_BUILD_DIR: ".next-security", SHEETS_TRANSPORT: "memory", ENABLE_OFFLINE_TEST_MODE: "1", REQUIRE_AUTH_IN_FIXTURE_MODE: "1", VERCEL: "", GOOGLE_SERVICE_ACCOUNT_EMAIL: "", GOOGLE_PRIVATE_KEY: "", GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3202", NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test-publishable", APP_URL: base, VERCEL_PROJECT_PRODUCTION_URL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", x => { logs += x.toString(); });
  child.stderr.on("data", x => { logs += x.toString(); });
  const cookie = (sub: string) => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub, exp, aud: "authenticated", role: "authenticated" })}.local-test-signature`;
    const session = { access_token: token, refresh_token: "local-refresh", expires_at: exp, expires_in: 3600, token_type: "bearer", user: { id: sub, email: profiles[sub]?.email } };
    return `sb-127-auth-token=base64-${encode(session)}`;
  };
  const get = (path: string, sub?: string, headers: Record<string, string> = {}) => fetch(base + path, { redirect: "manual", headers: { ...headers, ...(sub ? { cookie: cookie(sub) } : {}) } });
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await get("/api/health")).ok) break; } catch { /* startup */ }
      if (child.exitCode !== null) throw new Error("Local server failed: " + logs);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal((await get("/api/export/HU702")).status, 401, "anonymous export");
    assert.equal((await get("/api/export/HU702", "forged")).status, 401, "forged cookie");
    for (const sub of ["inactive", "pending", "invalid", "other"]) {
      const denied = await get("/api/export/HU702", sub);
      assert.equal(denied.status, 403, `${sub} export denial`);
      assert.ok(!(await denied.text()).includes("Hainan"));
    }
    const own = await get("/api/export/HU702", "branch", { "x-nonce": "attacker-nonce" });
    assert.equal(own.status, 200, "own branch export");
    const html = await own.text();
    assert.ok(html.includes("Hainan"));
    assert.ok(!html.includes('nonce="attacker-nonce"'));
    assert.equal(own.headers.get("x-content-type-options"), "nosniff");
    assert.equal(own.headers.get("x-frame-options"), "DENY");
    assert.ok(own.headers.get("cache-control")?.includes("no-store"));
    assert.ok(own.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"));
    assert.equal((await get("/api/export/GA254", "branch")).status, 403, "different branch export");
    assert.equal((await get("/api/export/GA254", "admin")).status, 200, "admin scope");
    for (const path of ["/api/test/snapshot", "/api/test/reset", "/api/test/write"]) assert.equal((await get(path, "admin")).status, 404, path);
    const dashboard = await get("/", "branch");
    const data = await dashboard.text();
    assert.ok(data.includes("HU702")); assert.ok(!data.includes('"iapId":"GA254"'), "cross-branch rows omitted from response");
    const userAdmin = await get("/admin/users", "branch");
    // Next can stream the layout before emitting its redirect, yielding HTTP 200.
    const adminHtml = await userAdmin.text();
    assert.ok(userAdmin.status === 307 || /NEXT_REDIRECT;replace;\/;307|content="0;url=\/"/.test(adminHtml), "non-admin redirected away from user management");
    assert.ok(!adminHtml.includes("Manajemen Pengguna"), "admin content omitted");
    assert.equal((await get("/api/export/HU702?step=not-a-number", "branch")).status, 400);
    const manifest = JSON.parse(await readFile(".next-security/server/server-reference-manifest.json", "utf8"));
    const action = async (name: string, args: unknown[], sub: string, origin = base, path = "/") => {
      const entry = Object.entries(manifest.node).find(([, value]) => (value as { exportedName: string }).exportedName === name);
      assert.ok(entry, name);
      return fetch(base + path, { method: "POST", redirect: "manual", headers: { cookie: cookie(sub), "Next-Action": entry[0], "Content-Type": "text/plain;charset=UTF-8", origin }, body: JSON.stringify(args) });
    };
    const blocked = await action("deleteCaseAction", ["GA254"], "branch");
    assert.ok((await blocked.text()).includes("Anda tidak memiliki akses"), "server action checks branch independently");
    const inactive = await action("deleteCaseAction", ["HU702"], "inactive");
    assert.ok((await inactive.text()).includes("Anda tidak memiliki akses"));
    const csrf = await action("deleteCaseAction", ["HU702"], "branch", "https://evil.example");
    assert.ok(csrf.status >= 400, "cross-origin server action rejected");
    const administrative = await action("approveUserAction", ["11111111-1111-1111-1111-111111111111"], "branch", base, "/admin/users");
    assert.ok(administrative.headers.get("x-action-redirect") || (await administrative.text()).includes("NEXT_REDIRECT"), "user cannot invoke admin action");
  } finally {
    child.kill("SIGTERM");
    await once(child, "exit");
    mock.closeAllConnections(); await new Promise<void>(resolve => mock.close(() => resolve()));
  }
});
