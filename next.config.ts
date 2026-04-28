import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  compress: true,
  // Pin trace root to this project so Next.js doesn't scan the home directory
  // when it detects the user's stray top-level package-lock.json.
  outputFileTracingRoot: __dirname,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Playwright pulls in chromium binary + native bindings — keep it external
  // so Next.js doesn't try to bundle it into the server build.
  serverExternalPackages: ["playwright", "playwright-core"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default withPWA(nextConfig);
