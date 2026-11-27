import type { MetadataRoute } from "next";
import { getSite } from "@/lib/api/public";

/** Web app manifest for icons and theme colour only (plan 4 / design 10.4). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await getSite().catch(() => null);
  return {
    name: site?.siteName ?? "Baraton Group Co.",
    short_name: "Baraton",
    description: site?.seoDefaults.defaultDescription ?? undefined,
    start_url: "/",
    display: "browser",
    background_color: "#F8F9FA",
    theme_color: site?.brandColors.themeColor ?? "#2F447D",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
