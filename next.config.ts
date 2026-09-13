import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.IAP_BUILD_DIR ?? ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
  // This project sits inside a directory that has other lockfiles above it; pin the
  // trace root so Next does not walk up and pick the wrong one.
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
};

export default nextConfig;
