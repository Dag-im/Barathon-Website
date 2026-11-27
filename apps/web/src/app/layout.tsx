import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { afacad, roboto } from "./fonts";
import { getSite } from "@/lib/api/public";
import { toMetadata } from "@/lib/seo/metadata";
import { env } from "@/lib/env";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite().catch(() => null);
  const siteName = site?.siteName ?? "Baraton Group Co.";
  const defaults = site?.seoDefaults;
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: defaults?.defaultTitle ?? siteName, template: defaults?.titleTemplate ?? "%s | Baraton Group Co." },
    description: defaults?.defaultDescription ?? undefined,
    applicationName: siteName,
    formatDetection: { telephone: true, email: true, address: false },
    openGraph: { siteName, locale: "en_US", type: "website" },
    twitter: { card: "summary_large_image", site: defaults?.twitterHandle ?? undefined },
    verification: site?.analytics.searchConsoleVerification ? { google: site.analytics.searchConsoleVerification } : undefined,
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/apple-icon.png" }] },
    manifest: "/manifest.webmanifest",
    robots: !env.enableIndexing || defaults?.siteNoindex ? { index: false, follow: false } : undefined,
    other: { "msapplication-TileColor": "#2F447D" },
  };
}

export const viewport = { themeColor: "#2F447D", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={env.defaultLocale} className={`${afacad.variable} ${roboto.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster position="bottom-right" richColors={false} />
      </body>
    </html>
  );
}
