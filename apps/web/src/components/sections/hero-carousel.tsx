"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { CmsImage } from "@/components/media/cms-image";
import type { HeroSlideDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Home hero (design 7.1): persistent h1 headline, product index rail, pause control.
 * Only the background image and the active product change. Pauses on hover/focus
 * and for reduced motion; autoplay starts after mount.
 */
export function HeroCarousel({ slides, headline, subheadline, autoplayMs, eyebrow, ctaPrimary }: { slides: HeroSlideDto[]; headline: string; subheadline: string | null; autoplayMs: number; eyebrow?: string | null; ctaPrimary?: { label: string; href: string } }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [hovered, setHovered] = useState(false);
  const count = slides.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const playing = !paused && !reduced && !hovered && count > 1;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), autoplayMs);
    return () => clearInterval(t);
  }, [playing, count, autoplayMs]);

  const active = slides[index];
  if (!count) return null;

  return (
    <div
      className="section-navy relative isolate overflow-hidden bg-[#111B38] text-white"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHovered(false)}
    >
      {slides.map((s, i) => (
        <div key={s.id} className={cn("absolute inset-0 transition-opacity duration-700 ease-in-out", i === index ? "opacity-100" : "opacity-0")} aria-hidden={i !== index}>
          <CmsImage media={s.image} sizes="100vw" priority={i === 0} variant="product" tone="navy" className="opacity-40" />
        </div>
      ))}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,27,56,0.92)_0%,rgba(17,27,56,0.78)_38%,rgba(17,27,56,0.25)_70%,rgba(17,27,56,0)_100%)] max-md:bg-[linear-gradient(180deg,rgba(17,27,56,0.35)_0%,rgba(17,27,56,0.92)_70%)]" />
      <div className="container-site relative grid min-h-[640px] items-center gap-10 py-20 lg:min-h-[760px] lg:grid-cols-12">
        <div className="lg:col-span-7">
          {eyebrow ? <p className="eyebrow text-white"><span>{eyebrow}</span></p> : null}
          <h1 className="t-display mt-5 max-w-[14ch] text-white">{headline}</h1>
          {subheadline ? <p className="t-lead mt-6 max-w-[52ch] text-[#D1D5DB]">{subheadline}</p> : null}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            {ctaPrimary ? (
              <Link href={ctaPrimary.href} className="inline-flex h-13 items-center justify-center gap-2 bg-white px-7 font-display text-[17px] font-semibold text-[#111827] hover:bg-[#EEF1F8]">
                {ctaPrimary.label}
              </Link>
            ) : null}
            <Link href="/contact?subject=quote" className="inline-flex h-13 items-center justify-center gap-2 border border-white/24 px-7 font-display text-[17px] font-semibold text-white hover:bg-white/8">
              Request a quote
            </Link>
          </div>
        </div>
        <div className="lg:col-span-4 lg:col-start-9">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-[#D1D5DB]">Product lines</p>
            <p className="font-display text-sm font-semibold" aria-live="polite">{String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</p>
          </div>
          <ol className="mt-4 border-t border-white/12">
            {slides.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index}
                  data-testid={`hero-index-${i + 1}`}
                  className={cn("relative flex w-full items-center gap-4 border-b border-white/12 py-3 text-start transition-colors hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-[#60A5FA]", i === index ? "text-white" : "text-[#9CA3AF]")}
                >
                  <span className="w-7 font-display text-base font-semibold">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 font-display text-lg font-semibold leading-6">{s.heading}</span>
                  {i === index ? <span aria-hidden className="absolute start-0 top-0 h-full w-0.5 bg-white" /> : null}
                  {i === index && playing ? <span aria-hidden className="absolute bottom-0 start-0 h-0.5 w-full origin-left bg-white/60" style={{ animation: `progress ${autoplayMs}ms linear forwards` }} key={`${index}-${autoplayMs}`} /> : null}
                </button>
              </li>
            ))}
          </ol>
          {active ? (
            <div className="mt-5 min-h-[88px]">
              <p className="text-[15px] leading-[22px] text-[#D1D5DB] line-clamp-3">{active.subheading}</p>
              {active.href ? (
                <Link href={active.href} className="mt-3 inline-flex items-center gap-1 font-medium text-[#60A5FA] underline underline-offset-[3px] hover:text-white">
                  View {active.heading}<ArrowRight aria-hidden className="size-4" />
                </Link>
              ) : null}
            </div>
          ) : null}
          <button type="button" onClick={() => setPaused((p) => !p)} className="mt-2 inline-flex items-center gap-2 text-sm text-[#D1D5DB] hover:text-white focus-visible:outline-2 focus-visible:outline-[#60A5FA]" aria-pressed={paused}>
            {paused || reduced ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
            {paused || reduced ? "Play slides" : "Pause slides"}
          </button>
        </div>
      </div>
    </div>
  );
}
