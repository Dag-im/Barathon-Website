import Image from "next/image";
import type { MediaDto } from "@/lib/api/types";
import { ImagePlaceholder } from "./image-placeholder";
import { cn } from "@/lib/utils";

/**
 * Renders a CMS media object with next/image, or the placeholder when absent.
 * `sizes` is required so the optimiser picks a correct srcset (plan 2.3).
 */
export function CmsImage({
  media, sizes, alt, priority = false, fill = true, className, fit = "cover", caption, variant = "product", tone = "light", width, height,
}: {
  media: MediaDto | null | undefined;
  sizes: string;
  alt?: string;
  priority?: boolean;
  fill?: boolean;
  className?: string;
  fit?: "cover" | "contain";
  caption?: string;
  variant?: "product" | "logo" | "generic";
  tone?: "light" | "navy";
  width?: number;
  height?: number;
}) {
  if (!media) return <div className={cn("relative size-full", className)}><ImagePlaceholder variant={variant} caption={caption} tone={tone} /></div>;
  const isSvg = media.mimeType === "image/svg+xml" || media.url.endsWith(".svg");
  const style = media.focal ? { objectPosition: `${media.focal.x * 100}% ${media.focal.y * 100}%` } : undefined;
  const common = {
    alt: alt ?? media.alt ?? "",
    sizes,
    priority,
    unoptimized: isSvg,
    className: cn(fit === "contain" ? "object-contain" : "object-cover", className),
    style,
  };
  if (fill) return <Image src={media.url} fill {...common} />;
  return <Image src={media.url} width={width ?? media.width ?? 1200} height={height ?? media.height ?? 900} {...common} />;
}
