import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Command Center",
  description: "Personal productivity command center",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Command Center",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0e1a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Middleware sets x-cc-bare-shell=1 for token-protected SEO report views
  // (magic link / Playwright print). When set, strip all operator chrome so
  // the recipient sees only their own scoped report.
  const headersList = await headers();
  const bareShell = headersList.get("x-cc-bare-shell") === "1";

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} dark h-full antialiased bg-background`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-full font-sans">
        <AppShell bareShell={bareShell}>{children}</AppShell>
      </body>
    </html>
  );
}
