import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Request-scoped client. Every query it makes runs as the signed-in user, so row
 * level security on `profiles` — not application code — is what stops one user
 * reading another's account.
 */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (written) => {
          try {
            for (const { name, value, options } of written) {
              store.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only. The
            // middleware has already refreshed the session, so nothing is lost.
          }
        },
      },
    },
  );
}
