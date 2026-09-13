import { NextResponse, type NextRequest } from "next/server";
import { applicationOrigin, callbackPath } from "@/lib/security";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Where every link Supabase emails out lands — address confirmation and password
 * recovery alike. It trades the one-time code for a session cookie, then hands the
 * visitor on to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = applicationOrigin();
  const code = searchParams.get("code");
  // Only same-site paths, so a crafted link cannot bounce someone off to another host.
  const raw = searchParams.get("next") ?? "/";
  const next = callbackPath(raw);

  if (!code) {
    return NextResponse.redirect(`${origin}/login?notice=link-invalid`);
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?notice=link-invalid`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
