/** Deployment origins come from operator-controlled environment, never proxy headers. */
export function applicationOrigin(): string {
  const configured = process.env.APP_URL?.trim();
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = configured || (vercelHost ? `https://${vercelHost}` : "");
  if (!raw) throw new Error("APP_URL is required for authentication redirects.");
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && local && !process.env.VERCEL))) {
    throw new Error("APP_URL must be an HTTPS origin (HTTP loopback is local-only).");
  }
  return url.origin;
}

/** Callback destinations are finite; URL parser tricks cannot introduce another host. */
export function callbackPath(raw: string | null): string {
  return raw === "/reset-password" ? raw : "/";
}

export function sameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const supplied = request.headers.get("origin");
  if (!supplied) return false;
  try {
    const expected = process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? applicationOrigin()
      : new URL(request.url).origin;
    return supplied === expected;
  } catch {
    return false;
  }
}

export function contentSecurityPolicy(nonce: string): string {
  let supabase = "";
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.protocol === "https:") supabase = url.origin;
  } catch { /* Missing config must not widen the allowlist. */ }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' https://www.googleapis.com ${supabase}${process.env.NODE_ENV === "development" ? " ws: wss:" : ""}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; ");
}
