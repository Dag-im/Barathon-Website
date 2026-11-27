import type { BlockDto, VideoDto } from "@/lib/api/types";
import { HeroSection } from "./hero-section";
import { BrandsMarqueeSection } from "./brands-marquee";
import { ImageTextSection } from "./image-text";
import { StatsSection } from "./stats";
import { FeaturedProductsSection } from "./featured-products";
import { ServicesSection } from "./services";
import { VideosSection } from "./videos";
import { CtaBannerSection } from "./cta-banner";
import { TimelineSection, LeaderSection, MissionVisionSection, CoreValuesSection, SubsidiariesSection } from "./about-sections";
import { FaqSection, TestimonialsSection, LatestPostsSection, BrandGridSection, RichTextSection } from "./misc-sections";

/**
 * Renders the API's ordered block list (backend plan 3.9.1). Unknown block
 * types render nothing; each block is isolated so one failure cannot blank a page.
 */
export function SectionRenderer({ blocks, headline, subheadline, eyebrow }: { blocks: BlockDto[]; headline?: string; subheadline?: string | null; eyebrow?: string | null }) {
  return (
    <>
      {blocks.map((b) => {
        const key = b.id;
        switch (b.type) {
          case "HERO_CAROUSEL": return <HeroSection key={key} block={b} headline={headline} subheadline={subheadline ?? null} eyebrow={eyebrow} />;
          case "BRANDS_MARQUEE": return <BrandsMarqueeSection key={key} block={b} />;
          case "IMAGE_TEXT": return <ImageTextSection key={key} block={b} />;
          case "STATS": return <StatsSection key={key} block={b} />;
          case "FEATURED_PRODUCTS": return <FeaturedProductsSection key={key} block={b} />;
          case "SERVICES_GRID": return <ServicesSection key={key} block={b} />;
          case "VIDEOS_GRID": return <VideosSection key={key} block={b} />;
          case "CTA_BANNER": return <CtaBannerSection key={key} block={b} />;
          case "TIMELINE": return <TimelineSection key={key} block={b} />;
          case "LEADER_MESSAGE": return <LeaderSection key={key} block={b} />;
          case "MISSION_VISION": return <MissionVisionSection key={key} block={b} />;
          case "CORE_VALUES": return <CoreValuesSection key={key} block={b} />;
          case "SUBSIDIARIES": return <SubsidiariesSection key={key} block={b} />;
          case "FAQ": return <FaqSection key={key} block={b} />;
          case "TESTIMONIALS": return <TestimonialsSection key={key} block={b} />;
          case "LATEST_POSTS": return <LatestPostsSection key={key} block={b} />;
          case "BRAND_GRID": return <BrandGridSection key={key} block={b} />;
          case "RICH_TEXT": return <RichTextSection key={key} block={b} />;
          default: return null;
        }
      })}
    </>
  );
}

export type { VideoDto };
