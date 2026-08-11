import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This project sits inside a directory that has other lockfiles above it; pin the
  // trace root so Next does not walk up and pick the wrong one.
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
};

export default nextConfig;
