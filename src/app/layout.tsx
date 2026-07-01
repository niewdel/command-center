import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { GeistMono } from "geist/font/mono";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";

// Brand v3 type system: Montserrat for structure, Inter for reading.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-montserrat",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  metadataBase: new URL("https://app.niewdel.com"),
  title: "Niewdel",
  description:
    "We build what you can't imagine yet. AI, automation, and SEO & AI visibility — by Niewdel.",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: "Niewdel",
    title: "Niewdel — Growth Services",
    description:
      "We build what you can't imagine yet. AI, automation, and SEO & AI visibility — by Niewdel.",
    url: "https://app.niewdel.com",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Niewdel — We build what you can't imagine yet.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Niewdel — Growth Services",
    description:
      "We build what you can't imagine yet. AI, automation, and SEO & AI visibility — by Niewdel.",
    images: ["/og.png"],
  },
  // Black "n" on white — the brand's light-surface mark.
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/favicon-apple-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Niewdel",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0D0D0D",
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
      className={`${inter.variable} ${montserrat.variable} ${GeistMono.variable} h-full antialiased bg-background`}
    >
      <body className="min-h-full font-sans text-foreground">
        <AppShell bareShell={bareShell}>{children}</AppShell>
      </body>
    </html>
  );
}
