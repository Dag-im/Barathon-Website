import { cn } from "@/lib/utils";

/**
 * Honest placeholder for a missing image (design 4.7): a tinted tile with the
 * ring mark and optional caption. Never a broken-image icon.
 */
export function ImagePlaceholder({ variant = "product", caption, tone = "light", className }: { variant?: "product" | "logo" | "generic"; caption?: string; tone?: "light" | "navy"; className?: string }) {
  const navy = tone === "navy";
  const markSize = variant === "logo" ? "40%" : "22%";
  return (
    <div className={cn("relative size-full overflow-hidden", navy ? "bg-[#1F2937]" : "bg-[#EEF1F8]", className)} role="img" aria-label={caption ? `No image for ${caption}` : "No image available"}>
      <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        {[140, 220, 300].map((r) => (
          <circle key={r} cx="200" cy="150" r={r} fill="none" stroke={navy ? "rgba(255,255,255,0.08)" : "#DDE3F1"} strokeWidth="1" />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <svg aria-hidden="true" viewBox="0 0 222 212" style={{ width: markSize, maxWidth: 96, height: "auto" }}>
          <path d="M79.53 28.12 A84 84 0 1 1 30.25 129.15" fill="none" stroke={navy ? "#6479B0" : "#BCC8E2"} strokeWidth="30" />
          <circle cx="110" cy="104" r="30" fill={navy ? "#D08A90" : "#E6B8BC"} />
        </svg>
      </div>
      {caption ? <p className={cn("absolute bottom-3 left-3 text-xs", navy ? "text-[#9CA3AF]" : "text-[#6B7280]")}>{caption}</p> : null}
    </div>
  );
}
