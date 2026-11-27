import localFont from "next/font/local";

/*
 * Afacad Flux (display) and Roboto (body), self-hosted from the Latin and Latin-ext
 * subsets so builds work offline. Equivalent to next/font/google with the same
 * families and weights; swap to next/font/google if the build may fetch Google Fonts.
 */
export const afacad = localFont({
  variable: "--font-afacad",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
  src: [
    { path: "../fonts/afacad-flux-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/afacad-flux-latin-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/afacad-flux-latin-700.woff2", weight: "700", style: "normal" },
  ],
});

export const roboto = localFont({
  variable: "--font-roboto",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
  src: [
    { path: "../fonts/roboto-latin.woff2", weight: "100 900", style: "normal" },
  ],
});
