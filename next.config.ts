import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  compress: true,
  // Pin trace root to this project so Next.js doesn't scan the home directory
  // when it detects the user's stray top-level package-lock.json.
  outputFileTracingRoot: __dirname,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Playwright pulls in chromium binary + native bindings, keep it external
  // so Next.js doesn't try to bundle it into the server build.
  serverExternalPackages: ["playwright", "playwright-core"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

// Serwist replaces the older @ducanh2912/next-pwa we used before the
// Turbopack migration. Same install-to-home-screen behavior, plus
// runtime caching so repeat visits feel instant.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  cacheOnNavigation: true,
});

export default withSerwist(nextConfig);
