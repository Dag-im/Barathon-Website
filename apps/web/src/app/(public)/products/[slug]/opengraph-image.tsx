import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getProduct } from "@/lib/api/public";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Product";

/** Product OG image (plan 5.3): title, country and brand on the navy base. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug).catch(() => null);
  const font = await readFile(join(process.cwd(), "src/lib/og/afacad-700.woff"));
  const title = p?.title ?? "Baraton Group Co.";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#111B38", color: "#fff", padding: 80, fontFamily: "Afacad" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 24, textTransform: "uppercase", color: "#D08A90", letterSpacing: 3 }}>{[p?.country.name, p?.brand?.name].filter(Boolean).join(" · ") || "Products"}</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 28, color: "#9CA3AF" }}>Baraton Group Co. · Addis Ababa, Ethiopia</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Afacad", data: font, weight: 700, style: "normal" }] },
  );
}
