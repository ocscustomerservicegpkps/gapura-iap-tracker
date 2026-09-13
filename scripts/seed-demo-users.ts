/**
 * Seed three demo accounts, one per access level.
 *
 *   admin.demo@gapura-iap.test  admin, PUSAT  full access + user management
 *   kps.demo@gapura-iap.test    user,  PUSAT  every branch, no user management
 *   cgk.demo@gapura-iap.test    user,  CGK    only rows whose station names CGK
 *
 * Run with `npm run seed-demo-users -- --apply`, and set the password through the
 * environment so it never lands in the repository:
 *
 *   DEMO_PASSWORD='...' npm run seed-demo-users -- --apply
 *
 * This goes through the Admin API rather than inserting into `auth.users` directly.
 * That table is owned by `supabase_auth_admin`, so a hand-written INSERT fails with
 * `42501: must be owner of table users` in the dashboard SQL editor — and even where
 * it does run, it hard-codes a schema that changes between GoTrue releases.
 *
 * Accounts are created already confirmed, so no mail is sent and the built-in
 * mailer's rate limit is not spent. The `.test` TLD is reserved by RFC 6761 and is
 * guaranteed non-routable: password recovery can never reach these accounts, which
 * is intended for demo logins but means they cannot exercise /forgot-password.
 *
 * To remove them again, delete them from Authentication → Users in the dashboard.
 */
import { createClient } from "@supabase/supabase-js";
import { isApply, announceDryRun } from "./config";

interface DemoAccount {
  email: string;
  fullName: string;
  branchCode: string;
  role: "admin" | "user";
}

const ACCOUNTS: readonly DemoAccount[] = [
  { email: "admin.demo@gapura-iap.test", fullName: "Demo Admin Pusat", branchCode: "PUSAT", role: "admin" },
  { email: "kps.demo@gapura-iap.test", fullName: "Demo Kantor Pusat", branchCode: "PUSAT", role: "user" },
  { email: "cgk.demo@gapura-iap.test", fullName: "Demo Cabang CGK", branchCode: "CGK", role: "user" },
];

function requireEnv(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n${name} is not set. ${hint}\n`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const url = requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "It is the same value the application uses; see .env.example.",
  );
  // The only thing in this project that needs the service role key. It stays in
  // .env.local, which is gitignored, and is never given to the application itself.
  const serviceKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "Copy it from Supabase → Project Settings → API keys → service_role (secret).",
  );
  const password = requireEnv(
    "DEMO_PASSWORD",
    "Pass it inline, e.g. DEMO_PASSWORD='...' npm run seed-demo-users -- --apply",
  );

  if (!isApply()) {
    for (const account of ACCOUNTS) {
      console.log(`would create ${account.email} — ${account.role}, ${account.branchCode}`);
    }
    announceDryRun();
    return;
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const account of ACCOUNTS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      // The trigger reads these, exactly as it does for a real registration — and
      // ignores role and status, so every account still lands pending and non-admin.
      user_metadata: { full_name: account.fullName, branch_code: account.branchCode },
    });

    if (error || !data.user) {
      console.error(`FAILED ${account.email}: ${error?.message ?? "no user returned"}`);
      process.exitCode = 1;
      continue;
    }

    // Approve it, and promote the one admin — the same two fields /admin/users sets.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ status: "active", role: account.role })
      .eq("id", data.user.id);

    if (profileError) {
      console.error(`FAILED to approve ${account.email}: ${profileError.message}`);
      process.exitCode = 1;
      continue;
    }

    console.log(`created ${account.email} — ${account.role}, ${account.branchCode}, active`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
