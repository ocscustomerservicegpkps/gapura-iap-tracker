import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";

const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "production",
  IAP_BUILD_DIR: ".next-security",
  DATA_BACKEND: "memory",
  SHEETS_TRANSPORT: "memory",
  ENABLE_OFFLINE_TEST_MODE: "1",
  REQUIRE_AUTH_IN_FIXTURE_MODE: "1",
  VERCEL: "",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
  GOOGLE_PRIVATE_KEY: "",
  GOOGLE_DRIVE_OAUTH_CLIENT_ID: "",
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: "",
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3202",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test-publishable",
  SUPABASE_SERVICE_ROLE_KEY: "",
  APP_URL: "http://127.0.0.1:3200",
  VERCEL_PROJECT_PRODUCTION_URL: "",
};
async function run(args: string[]) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", code => resolve(code ?? 1));
  });
}
async function main() {
  // NEXT_PUBLIC values are compiled in. Use an isolated build with mock endpoints.
  const built = await run(["node_modules/next/dist/bin/next", "build"]);
  if (built) { process.exitCode = built; return; }
  const tests = (await readdir("tests/security")).filter(file => file.endsWith(".test.ts")).map(file => `tests/security/${file}`);
  process.exitCode = await run(["--import", "tsx", "--test", ...tests]);
}
main().catch(() => { console.error("Security test setup failed."); process.exitCode = 1; });
