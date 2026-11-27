import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Baraton Group Co.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default OG image (design 10.4): ring mark, tagline on the deep navy base. */
export default async function Image() {
  const font = await readFile(join(process.cwd(), "src/lib/og/afacad-700.woff"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#111B38", color: "#fff", padding: 80, fontFamily: "Afacad" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <svg width="96" height="92" viewBox="0 0 222 212"><path d="M79.53 28.12 A84 84 0 1 1 30.25 129.15" fill="none" stroke="#FFFFFF" strokeWidth="30" /><circle cx="110" cy="104" r="30" fill="#D08A90" /></svg>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>BARATON GROUP CO.</div>
          </div>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.05, maxWidth: 900 }}>Rock drilling, compressed air and construction machinery.</div>
          <div style={{ display: "flex", fontSize: 26, color: "#9CA3AF" }}>Importer and distributor since 2007 · Addis Ababa, Ethiopia</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Afacad", data: font, weight: 700, style: "normal" }] },
  );
}
