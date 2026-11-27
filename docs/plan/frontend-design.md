# Barathon Trading - Frontend Design Specification

Status: design specification. No application code. Companion to `docs/plan/frontend-plan.md` (architecture, routes, components, admin). Where this document and the plan disagree on visuals, this document wins; on structure and behaviour, the plan wins.

Audience: the engineer (or model) implementing `apps/web` with Next.js + Tailwind CSS 4 + shadcn/ui. Every value below is literal. When a value is not specified, do not invent one: pick the nearest token defined here.

Reading order for implementers: Sections 2, 3, 4 (tokens) first and wire them into `globals.css` and the Tailwind theme before building any component. Then Section 6 (components), then Section 7 (pages), then Section 8 (admin). Section 10 is the handoff and QA checklist.

Terminology: the public brand is "Baraton Group Co." (logo wordmark BARATON / GROUP CO.); the platform is "Barathon Trading". UI copy uses the configurable `siteName`. Copy marked **(proposed)** is new microcopy for editors to approve; unmarked copy is taken from the live site or `ui-strings.txt`.

---

## 1. Design principles, personality, anti-slop rules

### 1.1 Brand personality
Established heavy-industry B2B importer: confident, precise, engineered, trustworthy. The tone is that of a technical data sheet written by people who have stood on a drill site: short declarative sentences, real numbers, real brand names. The site is a catalogue and a credential, not a campaign.

Voice: plain, specific, third person for the group ("Baraton Group provides..."), second person for actions ("Request a quote"). No exclamation marks. No hype adjectives ("cutting-edge" is allowed only where it already exists in source copy, never added).

### 1.2 Seven principles (each with do / don't)

1. **Evidence over adornment.** Every section earns its place with a fact, a product, a number or a document.
   - Do: show founding year, origin country, official-agent status, spec rows, brochure size (e.g. "PDF, 2.4 MB").
   - Don't: add a section whose only content is a slogan and an icon.
2. **Engineered precision.** Alignment to a 12-column grid and a 4px base unit; hairline rules; small radii; consistent numerals.
   - Do: align every left edge to the grid; use 1px rules in `--border`; use tabular numerals in data.
   - Don't: use arbitrary margins, large radii (>6px except avatars), pill cards, or centred text for body paragraphs.
3. **One dominant blue, one rare burgundy.** Indigo/navy carries the brand; burgundy (from the logo dot) is a 1-2% punctuation mark.
   - Do: use burgundy for the eyebrow tick, the active indicator, one CTA per page at most, error-adjacent emphasis never.
   - Don't: use burgundy as a large fill, gradient stop, or card background.
4. **Hierarchy through scale and weight, not colour.** Large Afacad Flux headings, calm Roboto body, one accent per block.
   - Do: vary size 1.25x-1.5x between levels; keep body at 16/26.
   - Don't: use more than 3 text colours in one section.
5. **Real imagery or honest placeholders.** Industrial photography treated consistently; when an image is missing, show the brand-ring placeholder, never a broken image icon or stock filler.
   - Do: apply the one approved image treatment (Section 4.7).
   - Don't: use stock photos of handshakes, laptops, globes or abstract networks.
6. **Dense where it helps, airy where it frames.** Catalogue pages are information-dense (spec tables, facts); intro/hero blocks are generous.
   - Do: 96px section rhythm on desktop, 56px mobile; 16-24px inside cards.
   - Don't: pad every block equally; don't make every section a card grid.
7. **Motion explains, never decorates.** Movement reveals structure (reveal on scroll, carousel progress, header condense).
   - Do: 200-400ms ease-out, transform/opacity only; honour reduced motion.
   - Don't: parallax, floating shapes, infinite bobbing icons, auto-playing video backgrounds.

### 1.3 "What we avoid" (anti-slop rules; reviewers reject on sight)

1. No purple, pink, magenta, violet, or multi-hue gradients anywhere. The live site's purple "xyberlabs" credit and purple-blue footer logo gradient are NOT carried over. Only permitted gradient: a single-hue navy-to-transparent scrim over photographs (Section 4.7).
2. No gradient or blurred blob/orb/mesh shapes. No floating, bobbing or rotating decorative shapes.
3. No glassmorphism. `backdrop-filter` is allowed in exactly one place: the sticky header on scroll (8px blur, 92% opaque white). Nowhere else.
4. No emoji as icons or in copy. Icons are Lucide (outline, 1.5 stroke) or the brand ring.
5. No identical rounded-card grid repeated on every section. Each section type has its own composition (Section 7). Within one page, at most two sections may use a card grid, and they must differ in column count or card format.
6. No generic copy: banned phrases include "Empowering your future", "Your trusted partner in success", "Unlock", "Elevate", "Seamless", "Next-generation", "World-class", "Innovative solutions" (as a headline), "Welcome to". Use product names, countries, years, capabilities.
7. No stock photography of people at laptops/handshakes/skylines. Allowed imagery: machines, drilling sites, workshops, parts, brand logos, the CEO portrait, documents.
8. No centred-everything layouts. Headings are left-aligned by default; centred only for the 404 and the thank-you page and the logo-wall heading.
9. No drop-shadow stacks. Elevation tokens (Section 4.6) are the only shadows; the offset "plate" is a solid block, not a blur.
10. No oversized rounded buttons or pill CTAs; button radius is 4px.
11. No auto-playing sound or video; hero carousel is images only and pauses on hover/focus/reduced motion.
12. No placeholder "Lorem ipsum", "Title 1", "John Doe" in shipped UI (form placeholders use neutral examples listed in 6.3).
13. No "Read More" bare links: every link label is specific or has a visually hidden suffix (plan 5.9).

---

## 2. Color system

### 2.1 Identity derivation (evidence)
- Logo ring colour sampled from `docs/source/logo.png`: **#2F447D** (dominant indigo-navy; also the wordmark "BARATON").
- Logo dot and "GROUP CO." wordmark: **#843C40** (burgundy/maroon).
- Live-site computed brand blue `rgb(13,83,128)` = **#0D5380** (links, small emphasis).
- Live footer/dark sections: **#111827** and **#1F2937**; accent light blue **#60A5FA** (footer arrows and icons); page background **#F8F9FA**/**#F8FAFC**; contact panel tint **#E0E7FF**.
- Retained: all of the above. Changed: the purple gradient on the footer wordmark is removed (use white/`#60A5FA` single colour).

Role split: **Indigo #2F447D = primary (identity, headings accents, primary buttons)**. **Steel #0D5380 = secondary/information (links, focus ring, data accents)**. **Navy #111827/#0B1220 = dark surfaces**. **Burgundy #843C40 = rare accent**. **Light blue #60A5FA = on-dark accent only**.

### 2.2 Palette (exact HEX)

**Indigo (primary; logo ring = 700)**

| Step | HEX | Use |
|---|---|---|
| 50 | #EEF1F8 | hover surface, selected row, accent bg |
| 100 | #DDE3F1 | subtle fills, chip bg |
| 200 | #BCC8E2 | borders on indigo tints |
| 300 | #92A3CD | on-navy secondary text only |
| 400 | #6479B0 | decorative lines on dark |
| 500 | #475E98 | hover of primary on dark surfaces |
| 600 | #3A5188 | primary hover |
| 700 | #2F447D | **primary** (buttons, wordmark, key headings accents) |
| 800 | #25376A | primary active/pressed, dark panels |
| 900 | #1B2A52 | hero overlay mid |
| 950 | #111B38 | hero overlay dense / deepest brand navy |

**Steel (secondary; live brand blue = 600)**

| Step | HEX |
|---|---|
| 50 | #EDF6FB |
| 100 | #D5E9F5 |
| 200 | #AAD2EA |
| 300 | #74B3DB |
| 400 | #3C8DC1 |
| 500 | #1B6FA3 |
| 600 | #0D5380 |
| 700 | #0B4469 |
| 800 | #0A3652 |
| 900 | #082A40 |

**Burgundy (accent; logo dot = 600)**

| Step | HEX |
|---|---|
| 50 | #FBF1F2 |
| 100 | #F4DDDF |
| 200 | #E6B8BC |
| 300 | #D08A90 |
| 400 | #B35A62 |
| 500 | #9A454D |
| 600 | #843C40 |
| 700 | #6D3034 |
| 800 | #572628 |
| 900 | #3F1C1E |

**Neutral (cool slate; matches the live site's Tailwind grays)**

| Step | HEX | Notes |
|---|---|---|
| 50 | #F8F9FA | page background (live) |
| 100 | #F1F3F5 | muted surface |
| 200 | #E5E7EB | hairline border (live gray-200) |
| 300 | #D1D5DB | strong border, dark-section body text (live gray-300) |
| 400 | #9CA3AF | disabled text, dark-section tertiary (live gray-400) |
| 500 | #6B7280 | tertiary text on light (live gray-500) |
| 600 | #4B5563 | secondary text on light |
| 700 | #374151 | body text alt (live gray-700) |
| 800 | #1F2937 | dark surface 2 (live) |
| 900 | #111827 | dark surface 1 / primary text (live) |
| 950 | #0B1220 | footer base, deepest |

**Additional named colours**

| Name | HEX | Role |
|---|---|---|
| White | #FFFFFF | cards, inputs, popovers |
| Sky (light-blue accent) | #60A5FA | on-dark links, arrows, icons, focus ring on dark |
| Mist | #E0E7FF | contact info panel tint, selected-nav tint (live) |
| Input border | #878F9D | form control borders (3.26:1 on white, meets WCAG 1.4.11) |
| Dark hairline | rgba(255,255,255,0.12) | dividers inside navy sections |
| Dark hairline strong | rgba(255,255,255,0.24) | outlined buttons on navy |

**Semantic**

| Role | Foreground | Background tint | Border |
|---|---|---|---|
| Success | #15803D | #DCFCE7 (text on tint: #166534) | #86EFAC |
| Warning | #B45309 | #FEF3C7 (text on tint: #92400E) | #FCD34D |
| Danger | #B91C1C | #FEE2E2 (text on tint: #991B1B) | #FCA5A5 |
| Info | #0D5380 | #EDF6FB (text on tint: #0B4469) | #AAD2EA |

Status is never conveyed by colour alone: always an icon (check-circle, alert-triangle, x-octagon, info) or a text label.

### 2.3 Verified contrast pairs (WCAG 2.2 AA; computed with the WCAG relative-luminance formula)

Normal text needs >= 4.5:1; large text (>= 24px, or >= 18.66px bold) and UI boundaries/icons need >= 3:1.

| Foreground | Background | Ratio | Result | Use |
|---|---|---|---|---|
| #111827 | #F8F9FA | 16.83 | AAA | body headings on page |
| #374151 | #F8F9FA | 9.78 | AAA | body copy |
| #4B5563 | #F8F9FA | 7.17 | AAA | secondary text |
| #6B7280 | #FFFFFF | 4.83 | AA | tertiary text, captions (min 14px) |
| #6B7280 | #F8F9FA | 4.59 | AA | tertiary text on page bg |
| #9CA3AF | #FFFFFF | 2.54 | FAIL | never for text; decoration/disabled only (disabled exempt) |
| #2F447D | #FFFFFF | 9.36 | AAA | primary text/links, wordmark |
| #2F447D | #F8F9FA | 8.88 | AAA | |
| #0D5380 | #FFFFFF | 8.18 | AAA | inline links |
| #843C40 | #FFFFFF | 7.77 | AAA | burgundy text/eyebrow |
| #843C40 | #F8F9FA | 7.37 | AAA | |
| #FFFFFF | #2F447D | 9.36 | AAA | primary button text |
| #FFFFFF | #25376A | 11.46 | AAA | primary pressed |
| #FFFFFF | #0D5380 | 8.18 | AAA | steel button |
| #FFFFFF | #843C40 | 7.77 | AAA | burgundy CTA text |
| #FFFFFF | #111827 | 17.74 | AAA | text on navy |
| #FFFFFF | #0B1220 | 18.72 | AAA | text on footer |
| #D1D5DB | #111827 | 12.04 | AAA | secondary text on navy |
| #D1D5DB | #1F2937 | 9.96 | AAA | |
| #9CA3AF | #111827 | 6.99 | AA | tertiary text on navy (min 14px) |
| #9CA3AF | #1F2937 | 5.78 | AA | |
| #9CA3AF | #0B1220 | 7.37 | AA | footer legal row |
| #60A5FA | #111827 | 6.98 | AA | links/icons on navy |
| #60A5FA | #1F2937 | 5.77 | AA | |
| #60A5FA | #0B1220 | 7.36 | AA | |
| #60A5FA | #111B38 | 6.67 | AA | on hero overlay |
| #D08A90 | #0B1220 | 6.88 | AA | burgundy-tint text on navy (use 300, never 600, on dark) |
| #B35A62 | #0B1220 | 4.06 | FAIL for text | non-text indicator only (>= 3:1) |
| #E0E7FF | #111827 | 14.40 | AAA | |
| #2F447D | #E0E7FF | 7.60 | AAA | text on Mist panel |
| #2F447D | #EEF1F8 | 8.28 | AAA | text on accent bg |
| #4B5563 | #F1F3F5 | 6.79 | AA | muted text on muted surface |
| #15803D | #FFFFFF | 5.02 | AA | success text |
| #B45309 | #FFFFFF | 5.02 | AA | warning text |
| #B91C1C | #FFFFFF | 6.47 | AAA | danger text |
| #166534 | #DCFCE7 | 6.49 | AA | success chip |
| #92400E | #FEF3C7 | 6.37 | AA | warning chip |
| #991B1B | #FEE2E2 | 6.80 | AA | danger chip |
| #0B4469 | #EDF6FB | 9.38 | AAA | info chip |
| #6D3034 | #F4DDDF | 7.66 | AAA | burgundy chip |
| #878F9D | #FFFFFF | 3.26 | AA (non-text) | input borders |
| #0D5380 | #FFFFFF | 8.18 | AA (non-text) | focus ring on light (2px, 2px offset) |
| #60A5FA | #111827 | 6.98 | AA (non-text) | focus ring on navy |
| #2F447D | #92A3CD | 3.72 | large/non-text only | never body text on indigo-700 backgrounds |
| #111B38 | #92A3CD | 6.74 | AA | indigo-300 text on indigo-950 only |

Rule: on `#2F447D` backgrounds use white or `#DDE3F1` (7.28) text only. On burgundy 600 backgrounds use white text only. Never place `#60A5FA` on `#2F447D` (3.68, fails for text).

### 2.4 Usage ratios per page (by visual area, excluding photography)

| Page | Light surfaces (neutral 50/white) | Navy/indigo surfaces | Accent (steel, sky, burgundy) |
|---|---|---|---|
| Home | 58% | 35% (hero overlay, company story, CTA banner, footer) | 7% (burgundy <= 1.5%) |
| About | 60% | 33% (CEO block, subsidiaries header, footer) | 7% |
| Products / Brands / News lists | 82% | 14% (footer, header strip only) | 4% |
| Product / Brand / Service detail | 75% | 20% (inquiry strip, footer) | 5% |
| Contact | 60% | 36% (info panel + footer) | 4% |
| Generic / legal / FAQ / search | 88% | 10% (footer) | 2% |
| 404 / thank-you | 70% | 28% | 2% |

Light:dark alternation: never place two navy sections back to back except section-then-footer; a light section must sit between. The page-end CTA banner (navy) directly above the navy footer is separated by a 1px `rgba(255,255,255,0.12)` rule and the footer uses `#0B1220` (darker) so the seam is visible.

### 2.5 Dark-section rules ("navy" theme)
- A dark section sets class `section-navy` (public) which re-maps the semantic tokens (2.6, "navy" column). Admin dark mode uses the same tokens under `.dark`.
- Backgrounds: primary dark `#111827`; alternating/inset dark `#1F2937`; footer `#0B1220`; hero overlay uses indigo-950 `#111B38`.
- Text: headings `#FFFFFF`; body `#D1D5DB`; tertiary `#9CA3AF`; links/icons `#60A5FA` (hover `#FFFFFF` with underline).
- Borders: `rgba(255,255,255,0.12)`.
- Buttons on navy: primary = white bg `#FFFFFF` + text `#111827` (hover `#EEF1F8`); secondary = outlined 1px `rgba(255,255,255,0.24)` + white text (hover bg `rgba(255,255,255,0.08)`). Burgundy CTA on navy is NOT allowed (4.06 on `#0B1220` for 400; 600 on navy is invisible).
- Images on navy sections keep their natural colour (no extra overlay unless text sits on them).

### 2.6 CSS custom properties / shadcn theme tokens (paste-ready spec for `globals.css`)

Tailwind 4 is the mandated target. All values are hex so they can be used directly: `@theme inline { --color-background: var(--background); ... }` maps each token. (If Tailwind 3.4 is forced, convert each hex to `H S% L%` triplets and wrap with `hsl(var(--x) / <alpha-value>)` mechanically; do not change values.)

```css
:root {
  /* shadcn core, light theme (default) */
  --background: #F8F9FA;
  --foreground: #111827;
  --card: #FFFFFF;
  --card-foreground: #111827;
  --popover: #FFFFFF;
  --popover-foreground: #111827;
  --primary: #2F447D;
  --primary-foreground: #FFFFFF;
  --secondary: #E5E7EB;
  --secondary-foreground: #1F2937;
  --muted: #F1F3F5;
  --muted-foreground: #4B5563;
  --accent: #EEF1F8;
  --accent-foreground: #25376A;
  --destructive: #B91C1C;
  --destructive-foreground: #FFFFFF;
  --border: #E5E7EB;
  --input: #878F9D;
  --ring: #0D5380;
  --radius: 0.25rem;               /* 4px: policy base */

  /* brand extensions */
  --brand-indigo: #2F447D;
  --brand-indigo-hover: #3A5188;
  --brand-indigo-active: #25376A;
  --brand-steel: #0D5380;
  --brand-burgundy: #843C40;
  --brand-burgundy-hover: #6D3034;
  --brand-burgundy-foreground: #FFFFFF;
  --sky: #60A5FA;
  --mist: #E0E7FF;
  --link: #0D5380;
  --link-hover: #2F447D;
  --surface-navy: #111827;
  --surface-navy-2: #1F2937;
  --surface-footer: #0B1220;
  --surface-hero: #111B38;
  --hairline: #E5E7EB;
  --hairline-strong: #D1D5DB;
  --text-tertiary: #6B7280;
  --success: #15803D;  --success-bg: #DCFCE7;  --success-fg: #166534;  --success-border: #86EFAC;
  --warning: #B45309;  --warning-bg: #FEF3C7;  --warning-fg: #92400E;  --warning-border: #FCD34D;
  --danger:  #B91C1C;  --danger-bg:  #FEE2E2;  --danger-fg:  #991B1B;  --danger-border:  #FCA5A5;
  --info:    #0D5380;  --info-bg:    #EDF6FB;  --info-fg:    #0B4469;  --info-border:    #AAD2EA;

  /* charts (admin dashboard); order is fixed, lightness varies for colour-blind safety */
  --chart-1: #2F447D;
  --chart-2: #3C8DC1;
  --chart-3: #843C40;
  --chart-4: #B45309;
  --chart-5: #6B7280;

  /* sidebar (admin shell is navy in BOTH themes) */
  --sidebar: #111827;
  --sidebar-foreground: #D1D5DB;
  --sidebar-primary: #60A5FA;
  --sidebar-primary-foreground: #0B1220;
  --sidebar-accent: #1F2937;
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: rgba(255,255,255,0.10);
  --sidebar-ring: #60A5FA;

  /* shadows (restrained; see 4.6) */
  --shadow-xs: 0 1px 2px rgba(17,24,39,0.06);
  --shadow-sm: 0 1px 3px rgba(17,24,39,0.08), 0 1px 2px rgba(17,24,39,0.04);
  --shadow-md: 0 4px 12px rgba(17,24,39,0.08);
  --shadow-lg: 0 12px 32px rgba(17,24,39,0.12);
  --shadow-header: 0 1px 0 rgba(17,24,39,0.08);
}

/* Navy variant: applied by class on a public section (.section-navy) AND as admin dark mode (.dark) */
.dark,
.section-navy {
  --background: #111827;
  --foreground: #FFFFFF;
  --card: #1F2937;
  --card-foreground: #FFFFFF;
  --popover: #1F2937;
  --popover-foreground: #FFFFFF;
  --primary: #FFFFFF;              /* buttons on navy are white */
  --primary-foreground: #111827;
  --secondary: #1F2937;
  --secondary-foreground: #FFFFFF;
  --muted: #1F2937;
  --muted-foreground: #9CA3AF;
  --accent: rgba(255,255,255,0.08);
  --accent-foreground: #FFFFFF;
  --destructive: #F87171;          /* 5.9:1 on #111827 */
  --destructive-foreground: #111827;
  --border: rgba(255,255,255,0.12);
  --input: #6B7280;                /* 3.0:1 on #1F2937 */
  --ring: #60A5FA;
  --link: #60A5FA;
  --link-hover: #FFFFFF;
  --text-tertiary: #9CA3AF;
  --hairline: rgba(255,255,255,0.12);
  --hairline-strong: rgba(255,255,255,0.24);
  --chart-1: #60A5FA;
  --chart-2: #92A3CD;
  --chart-3: #D08A90;
  --chart-4: #FCD34D;
  --chart-5: #9CA3AF;
  --success: #4ADE80; --success-bg: rgba(74,222,128,0.12); --success-fg: #86EFAC;
  --warning: #FBBF24; --warning-bg: rgba(251,191,36,0.12); --warning-fg: #FCD34D;
  --danger:  #F87171; --danger-bg:  rgba(248,113,113,0.12); --danger-fg:  #FCA5A5;
  --info:    #60A5FA; --info-bg:    rgba(96,165,250,0.12); --info-fg:    #BFDBFE;
  color-scheme: dark;
}
/* Footer is a navy section with the darker base */
.section-footer { --background: #0B1220; }
```

Token usage mapping (what the implementer binds):
- Page canvas `bg-background`; cards/popovers `bg-card`; hairlines `border-border`; form control borders `border-input`; focus `ring-ring`.
- Primary buttons `bg-primary text-primary-foreground`; hover `bg-[--brand-indigo-hover]`; active `bg-[--brand-indigo-active]`.
- Burgundy CTA/indicator `bg-[--brand-burgundy]` (add Tailwind colour `burgundy` in the theme; see 10.2).
- `.dark` is only toggled in the admin (user preference stored in `localStorage`, default light). The public site has no global dark mode in v1; it only uses `.section-navy` scopes.

---

## 3. Typography

### 3.1 Font pairing (decision and justification)
- **Display / headings / nav / buttons / eyebrows / numerals in hero: Afacad Flux** (Google Fonts, variable weight 100-1000; already the live heading face, so identity is preserved). It is a humanist, slightly condensed sans with engineered terminals: suits drilling/engineering. Use weights 500, 600, 700 only.
- **Body / UI text / forms / tables: Roboto** (Google Fonts variable, `wght` 100-900; already live body face; excellent small-size legibility and tabular numerals).
- No third Latin family (plan limit: max 2 families). The tabular data face is Roboto with `font-variant-numeric: tabular-nums`.
- **Ethiopic script**: **Noto Sans Ethiopic** (Google Fonts, variable weight 100-900), loaded only when `<html lang="am">` (future); declared in the font stacks as the fallback after Roboto/Afacad so mixed text works; subset `ethiopic` only. It is the one permitted extra family because it is conditional.
- Refinement vs live: heading weight 700 for display (live used 600-700 inconsistently), body line-height raised to 1.65, and strict scale below.

`next/font` configuration (spec):
- `Afacad_Flux`: `subsets: ['latin','latin-ext']`, `weight: 'variable'` (if the package lacks axes use `['500','600','700']`), `display: 'swap'`, CSS variable `--font-display`, `preload: true`.
- `Roboto`: `subsets: ['latin','latin-ext']`, `weight: 'variable'` (fallback `['400','500','700']`), `display: 'swap'`, CSS variable `--font-sans`, `preload: true`.
- `Noto_Sans_Ethiopic`: `subsets: ['ethiopic']`, `display: 'swap'`, variable `--font-ethiopic`, `preload: false`.
- Fallback stacks: display `var(--font-display), "Segoe UI", system-ui, -apple-system, Arial, sans-serif`; sans `var(--font-sans), system-ui, -apple-system, "Segoe UI", Arial, sans-serif`. Both with `adjustFontFallback` enabled (default) to prevent layout shift.
- Utility classes: `font-display` (Afacad Flux), `font-sans` (Roboto) default on `body`.

### 3.2 Type scale (desktop >= 1024 / tablet 640-1023 / mobile < 640)

Sizes in px (rem = px/16). Letter-spacing in em.

| Token | Font | Weight | Desktop size/line-height | Tablet | Mobile | Tracking | Notes |
|---|---|---|---|---|---|---|---|
| `display` | Afacad Flux | 700 | 72 / 72 (1.0) | 56 / 58 | 40 / 42 | -0.02em | home hero h1 only |
| `h1` | Afacad Flux | 700 | 52 / 56 (1.077) | 42 / 46 | 34 / 38 | -0.015em | one per page |
| `h2` | Afacad Flux | 700 | 40 / 44 (1.1) | 34 / 38 | 28 / 32 | -0.01em | section titles |
| `h3` | Afacad Flux | 600 | 28 / 34 (1.21) | 26 / 32 | 22 / 28 | -0.005em | card titles, subsections |
| `h4` | Afacad Flux | 600 | 22 / 28 (1.27) | 20 / 26 | 20 / 26 | 0 | |
| `h5` | Afacad Flux | 600 | 18 / 24 (1.33) | 18 / 24 | 17 / 24 | 0 | |
| `h6` | Afacad Flux | 600 | 14 / 20 (1.43) | 14 / 20 | 14 / 20 | 0.08em UPPERCASE | |
| `lead` | Roboto | 400 | 20 / 32 (1.6) | 19 / 30 | 18 / 28 | 0 | page intros, hero sub |
| `body-lg` | Roboto | 400 | 18 / 30 (1.667) | 17 / 28 | 17 / 28 | 0 | company story |
| `body` | Roboto | 400 | 16 / 26 (1.625) | 16 / 26 | 16 / 26 | 0 | default |
| `small` | Roboto | 400 | 14 / 22 (1.571) | 14 / 22 | 14 / 22 | 0 | meta, table body (admin 14) |
| `caption` | Roboto | 400 | 12 / 18 (1.5) | 12 / 18 | 12 / 18 | 0.01em | image captions, legal row (never below 12) |
| `eyebrow` | Afacad Flux | 600 | 13 / 16 | 13 / 16 | 12 / 16 | 0.14em UPPERCASE | section kicker with burgundy tick |
| `stat` | Afacad Flux | 700 | 64 / 64 | 52 / 52 | 44 / 44 | -0.02em | numerals; `tabular-nums` off (Afacad), use lining |
| `stat-label` | Roboto | 500 | 13 / 18 | 13 / 18 | 12 / 16 | 0.06em UPPERCASE | |
| `button` | Afacad Flux | 600 | 16 / 1 | 16 / 1 | 16 / 1 | 0.01em | height defined in 6.1 |
| `nav` | Afacad Flux | 500 | 16 / 1 | - | 20 / 28 in sheet | 0.01em | active 600 |
| `utility` (top bar) | Roboto | 400 | 13 / 18 | 13 / 18 | n/a | 0 | |
| `table-head` | Roboto | 500 | 12 / 16 | 12 / 16 | 12 / 16 | 0.06em UPPERCASE | |
| `spec-value` | Roboto | 500 | 15 / 22 | 15 / 22 | 15 / 22 | 0 | `tabular-nums` |
| `quote` | Afacad Flux | 500 | 26 / 38 | 22 / 34 | 20 / 30 | 0 | CEO message |

Colours on light: headings `#111827`; lead `#374151`; body `#374151`; small/meta `#4B5563`; caption `#4B5563`; tertiary `#6B7280` only at >= 14px. On navy: headings `#FFFFFF`, lead `#D1D5DB`, body `#D1D5DB`, meta `#9CA3AF`.

Rules:
- Uppercase only for: `eyebrow`, `h6`, `stat-label`, `table-head`, badges (country, status), the logo wordmark. Never uppercase nav, buttons, h1-h5, body.
- Max line length: body paragraphs 68ch (`max-width: 68ch`); lead 56ch; h1/h2 `max-width: 22ch` for editorial headings (e.g. hero h1 14ch per line at display size, allow 3 lines); card descriptions clamp to 3 lines.
- Text wrapping: `text-wrap: balance` on h1-h3, `text-wrap: pretty` on paragraphs.
- Hyphenation: `hyphens: manual` globally; `hyphens: auto` + `lang` only inside `.prose` columns narrower than 40ch (mobile). Never hyphenate headings or brand names. Brand names (FURUKAWA, AIRMAN, Montabert, Elsasser, Walter, Carmix, Monark, Nakayama, Sumitomo) are `white-space: nowrap`.
- Numerals: `font-variant-numeric: tabular-nums lining-nums` on tables, specs, stat counters, prices-none, phone numbers; phone numbers `white-space: nowrap`.
- Links in prose: colour `--link` (#0D5380), underline 1px, `text-underline-offset: 3px`; hover colour `#2F447D`, underline thickness 2px.
- Font smoothing: `antialiased`. `font-synthesis: none`.
- Preferred `text-size-adjust: 100%`.

Responsive behaviour: use `clamp()` between breakpoints only for `display` (`clamp(40px, 5vw + 8px, 72px)`) and `h1` (`clamp(34px, 3.2vw + 12px, 52px)`); all others step at breakpoints.

---

## 4. Layout system

### 4.1 Breakpoints
`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Design reference widths: **1440 desktop, 768 tablet, 390 mobile**. Layout changes occur at `md` (768) and `lg` (1024).

### 4.2 Container and grid
| Viewport | Columns | Gutter | Side margin | Container max |
|---|---|---|---|---|
| < 640 | 4 | 16px | 16px | fluid |
| 640-1023 | 8 | 16px | 32px | fluid |
| 1024-1279 | 12 | 24px | 40px | fluid |
| >= 1280 | 12 | 24px | 40px | 1280px outer (content 1200px) |
| >= 1536 | 12 | 24px | auto | 1280px (centred; hero imagery stays full-bleed) |

Container classes: `.container-site` (max 1280, padding-x as above), `.container-prose` (max 720px for legal/news body, centred within grid cols 3-10), `.container-wide` (max 1440 for hero and image bands).
Full-bleed elements: hero, image bands, navy sections' backgrounds; their content aligns to `.container-site`.
Header and footer content align to the same container (the live header is slightly misaligned versus the page; fix).

### 4.3 Spacing scale (4px base)
`0, 1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48, 16=64, 20=80, 24=96, 32=128`. Only these values are allowed for margins/padding/gaps.

Section vertical rhythm (padding-top = padding-bottom):
| Size | Desktop | Tablet | Mobile | Used for |
|---|---|---|---|---|
| `lg` (default) | 96 | 72 | 56 | major sections |
| `md` | 72 | 56 | 40 | list/catalogue sections |
| `sm` | 48 | 40 | 32 | strips (stats, logo wall, inquiry) |
Section heading block to content: 48 desktop / 40 tablet / 32 mobile. Heading to intro paragraph: 16. Card internal padding: 24 desktop / 20 mobile (dense admin: 16). Page header (title area) padding: 64 top / 48 bottom desktop; 40 / 32 mobile.

### 4.4 Radius policy
`--radius` = 4px (0.25rem). Tokens: `rounded-none 0` (images, tables, hero, navy panels, cards: **images and cards are square, matching the engineered look and the live site's square panels**), `rounded-sm 2px` (badges, chips, kbd), `rounded 4px` (buttons, inputs, selects, popovers, dialogs 6px = `rounded-md`), `rounded-full` only for: avatar, ring dot, carousel dots, switch thumb, the circular icon buttons in the footer socials. Forbidden: `rounded-xl/2xl/3xl` anywhere.

### 4.5 Borders and dividers
- Hairline `1px solid var(--border)` between list rows, around cards (cards have border and no shadow at rest).
- Strong rule `1px solid var(--hairline-strong)` under the page header and above the footer legal row.
- Section divider with ring motif: `RingDivider`: a 1px line spanning the container with a 16px open-ring mark (logo-derived) centred at left edge; used between `companyStory` paragraphs and before the CTA banner only (max 2 per page).
- Left accent rule on quotes and callouts: 3px solid `#843C40` (burgundy) - the only large-ish burgundy use.
- Table rules: header bottom 2px `#111827`, rows 1px `#E5E7EB`.

### 4.6 Elevation (restrained)
| Token | Value | Use |
|---|---|---|
| `shadow-none` | none | default for cards, header at top |
| `shadow-xs` | `0 1px 2px rgba(17,24,39,0.06)` | small chips, kbd, switch thumb |
| `shadow-sm` | `0 1px 3px rgba(17,24,39,0.08), 0 1px 2px rgba(17,24,39,0.04)` | cards on hover, dropdown triggers |
| `shadow-md` | `0 4px 12px rgba(17,24,39,0.08)` | popovers, menus, mega-menu panel |
| `shadow-lg` | `0 12px 32px rgba(17,24,39,0.12)` | dialogs, command palette, sheets |
| `shadow-header` | `0 1px 0 rgba(17,24,39,0.08)` | sticky header condensed state |
| `plate` (offset device) | solid block `#E5E7EB` offset 12px right / 12px down behind the element (CSS pseudo-element, `z-index:-1`), hover offset 8px | product card image (evolves the live offset-shadow tile; on navy sections the plate is `#1F2937`) |
No coloured shadows. No glows. Focus is a ring, not a shadow.

### 4.7 Imagery rules
**Treatment (single, consistent):** industrial photography is shown in natural colour with a *navy scrim only where text overlays it*. Scrim: `linear-gradient(90deg, rgba(17,27,56,0.92) 0%, rgba(17,27,56,0.78) 38%, rgba(17,27,56,0.25) 70%, rgba(17,27,56,0) 100%)` on desktop (text left); on mobile `linear-gradient(180deg, rgba(17,27,56,0.35) 0%, rgba(17,27,56,0.92) 70%)` (text bottom). Uncovered photos get no overlay. Optional duotone (brand indigo) is used only for non-product decorative bands such as the CTA banner background image: `mix-blend-mode: multiply` over `#2F447D` at 85% opacity, grayscale(100%) photo.
**Product photos** are cut-outs or on-site shots; display `object-fit: contain` on `#FFFFFF` tile for cut-outs (padding 24px) and `object-fit: cover` for scenes. CMS decides via media `focalPoint`; cards default `cover` with the focal point.
**Aspect ratios:**
| Context | Ratio |
|---|---|
| Hero slide | 16:9 desktop (min-height 640px), 4:5 mobile (height 560px) |
| Product card | 4:3 |
| Product detail main | 4:3 (gallery thumbs 1:1, 80px) |
| Brand card logo tile | 3:2 (logo contained, 72% of tile width max) |
| Service card | 16:10 |
| News card | 16:10; featured post 21:9 |
| Video thumbnail | 16:9 |
| Brand logo in marquee | height 40px, auto width (max 140px), grayscale 100% opacity 0.7 -> colour on hover |
| CEO portrait | 4:5 |
| OG image | 1.91:1 (1200x630) |
**Loading:** `placeholder="blur"` with `blurDataURL`; while loading show background `#E5E7EB`. Fade-in 200ms opacity on load (not under reduced motion).
**Missing image (elegant placeholder `ImagePlaceholder`)**: fills the slot with `#EEF1F8` (on navy: `#1F2937`), 1px inner border `#DDE3F1`, a centred outline of the logo ring mark (stroke `#BCC8E2`, 1.5px, size 22% of the shorter side, max 96px; dot filled `#E6B8BC`), and, for product/brand context, a bottom-left caption in `caption` style (`#6B7280`) with the entity name. Fine concentric rings (3 rings, stroke `#DDE3F1`, radii 140/220/300% of the mark) fill the tile at 100% opacity, clipped. No broken-image icon, no alt text visible, no grey X. Variants: `product` (4:3 plate), `logo` (3:2, mark smaller 40%), `generic`.
**Alt text:** CMS-required; decorative images `alt=""`.

### 4.8 Iconography
- Library: `lucide-react`. Stroke width **1.5** (default 2 is too heavy); sizes: 16 (inline/meta), 20 (buttons, nav), 24 (feature/contact rows), 32 (service/empty states). Colour inherits `currentColor`; on light default `#2F447D` for feature icons, `#4B5563` for meta icons; on navy `#60A5FA`.
- Never put icons in coloured circles except the Contact info rows (36px circle `rgba(255,255,255,0.08)` on navy, icon `#FFFFFF`; matches live) and footer social buttons (36px, `rgba(255,255,255,0.08)`).
- Social brand icons: inline SVG in `components/icons/social.tsx` (Facebook, X, LinkedIn, Instagram, YouTube, TikTok, Telegram, WhatsApp) monochrome, 20px.
- Arrow glyph for links: `ArrowRight` 16px, translates 4px right on hover.
- Icon set used (map): phone `Phone`, email `Mail`, address `MapPin`, search `Search`, menu `Menu`, close `X`, share `Share2`, download `Download`, file `FileText`, play `Play`, external `ArrowUpRight`, check `Check`, chevrons `ChevronDown/Right`, filter `SlidersHorizontal`, calendar `Calendar`, clock `Clock`, quote none (see 7.2), services `Wrench` (maintenance), `Boxes` (parts), country none (text only).

### 4.9 Logo usage
- Files: `logo-full.svg` (mark + BARATON GROUP CO. wordmark, colour), `logo-full-white.svg` (all white, for navy; the maroon dot becomes `#D08A90`), `logo-mark.svg` (ring + dot only), `logo-mark-white.svg`. Raster source `docs/source/logo.png` (222x212) must be vectorised; do not ship the PNG in the header.
- Clear space: minimum = the diameter of the dot (approx 0.28 x ring height) on all sides, practical minimum 12px.
- Minimum sizes: full logo 120px wide (header mobile 132px); mark alone 20px.
- Header size: full logo height 44px desktop (top bar state), 36px condensed, 32px mobile.
- On dark: use the white variant; never place the colour logo on indigo-700 or navy; never recolour the wordmark; never apply gradients (the live purple gradient is removed); never stretch, rotate, outline or add shadows.
- Wordmark text in footer is the logo image; not live text.
- Favicon: ring mark only (indigo ring, burgundy dot) on transparent; sizes in 10.4.

### 4.10 Graphic devices derived from the logo (use with restraint)
1. **Ring motif**: a circular ring with an open gap (as in the logo "b" bowl). Drawn as SVG stroke, never filled, always at low contrast.
   - Concentric ring field: 3-4 rings, stroke 1px, colour `rgba(255,255,255,0.08)` on navy / `#DDE3F1` on light, centred on the right edge of navy sections (e.g. company story, CTA banner), clipped by the section. Max one per page per two sections; never behind body text (keep text column clear).
   - Ring bullet: 8px open ring (1.5px stroke indigo) with 3px burgundy dot, as list markers in the company capabilities lists (replaces default bullets in `Prose` lists only where specified).
   - Loading spinner: the ring mark with a rotating gap (1s linear).
2. **Technical grid lines**: 1px vertical lines at the 12-column edges at `rgba(255,255,255,0.05)` inside the hero and navy sections (desktop only), plus "+" registration crosses (10px, 1px, `rgba(255,255,255,0.35)`) at the four corners of the hero image. Hidden below 1024px.
3. **Section index numerals**: oversized numerals "01"-"08" (Afacad Flux 700, 120px, stroke-only: `-webkit-text-stroke: 1px #BCC8E2; color: transparent` on light, `rgba(255,255,255,0.18)` stroke on navy) positioned top-left of a section behind the heading, 0.5 opacity; used in About (4 numbered subsections) and the Home services section. Decorative (`aria-hidden`). Never more than one per viewport. Mobile: 64px.
4. **Eyebrow with burgundy tick**: 24px x 2px burgundy bar before the eyebrow text, 8px gap.
5. **Spec-sheet style**: tables with a 2px dark top rule, label column in `eyebrow`-like caps.
Forbidden: ring used as an icon background, rings in colour fills, more than one ring field visible simultaneously, animated rings (except the spinner).

---

## 5. Motion

### 5.1 Principles
Purposeful, short, physical. Transform and opacity only (no layout-affecting animation). Everything must have a reduced-motion fallback: `@media (prefers-reduced-motion: reduce)` sets all durations to 0.01ms, removes transforms/parallax/marquee animation/counters (shows final values), disables carousel autoplay, and replaces fades with instant state changes.

### 5.2 Tokens
| Token | Value |
|---|---|
| `--ease-out` | cubic-bezier(0.22, 1, 0.36, 1) |
| `--ease-in-out` | cubic-bezier(0.65, 0, 0.35, 1) |
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) |
| `--dur-instant` | 100ms |
| `--dur-fast` | 150ms |
| `--dur-base` | 250ms |
| `--dur-slow` | 400ms |
| `--dur-hero` | 700ms |
Tailwind: `duration-150/250/400`, `ease-out` mapped to `--ease-out`.

### 5.3 Specific interactions
| Interaction | Spec |
|---|---|
| Header on scroll | At scrollY > 24: top utility bar collapses (height 40 -> 0, 250ms, `--ease-standard`), main bar height 80 -> 64, logo height 44 -> 36, background `rgba(255,255,255,0.92)` + `backdrop-filter: blur(8px)` + `shadow-header`. Header stays fixed; hides nothing else. Without JS: header stays in the expanded state (sticky only). |
| Hero carousel | Image crossfade 700ms `--ease-in-out` while the image scale eases 1.04 -> 1.00 over 6000ms (slow settle, no pan). Text block: headline stays static; product panel title/description slide up 12px + fade, 400ms `--ease-out`, 80ms stagger. Autoplay 6000ms (CMS `autoplayMs`); progress bar 2px (#FFFFFF at 40%, fill #FFFFFF) under the active index item animates `scaleX` 0 -> 1 over the autoplay duration. Pauses on hover/focus within, on tab hidden, and permanently when reduced motion is set (then a visible Play button exists). Swipe on touch. |
| Logo marquee | CSS `translateX(0 -> -50%)` linear infinite; speed `normal` = 40s per loop, `slow` = 60s; pause on `:hover`/`:focus-within`; reduced motion: no animation, logos wrap in a static 5-column grid (2 on mobile). Edge fade masks 64px (`mask-image` linear). |
| Counters | When 40% visible, count 0 -> value over 1200ms `--ease-out` (stepped via rAF), once only; years (2007) are not counted, they fade in. Reduced motion: final value immediately. |
| Card hover (product/brand) | Image `scale(1.03)` over 400ms `--ease-out` inside overflow-hidden frame; plate offset 12 -> 8px (150ms); title underline grows left-to-right (150ms); "Read More" arrow +4px. Card lifts: none (no translateY). No hover on touch. |
| Button | Background colour 150ms; pressed: translateY(1px), no scale. Loading: label fades to 0 and ring spinner shows (button width fixed). |
| Mega-menu | Panel opens with opacity 0 -> 1 and translateY(-4px -> 0), 150ms `--ease-out`, close 100ms; hover-intent delay 120ms open / 200ms close. |
| Page transitions | None between routes except: top loading bar (2px, `#2F447D`, `scaleX` progress, 250ms) driven by navigation state; content fades in 150ms on mount (opacity only). Reduced motion: no fade. |
| Reveal on scroll | Elements with `data-reveal` fade + translateY(16px -> 0), 400ms `--ease-out`, trigger at 15% in view, once. Stagger children by 60ms (max 6 children). Only applied to: section headings, spec table, stat items, subsidiary cards, timeline items. NOT to product grids (avoid layout jank) or hero. Above-the-fold content never waits for reveal. No-JS: visible by default (reveal class added by JS before first paint of the observed element). |
| Accordion | Height auto-animate 250ms `--ease-standard`, chevron rotate 180deg 250ms. |
| Dialog/sheet | Overlay `rgba(11,18,32,0.6)` fade 150ms; dialog scale 0.98 -> 1 + fade 150ms; sheet slides from right 250ms `--ease-out`. |
| Toast | Slide in from bottom-right 250ms; auto-dismiss 5s (errors 8s, with hover pause). |
| Focus | Instant (no transition) so keyboard users see it without delay. |
| Skeleton | Static `#E5E7EB` blocks with a 1.4s opacity pulse 1 -> 0.6 (no shimmer gradient); reduced motion: static. |

---

## 6. Component design specs

Global state rules (apply to every interactive component unless overridden):
- **Focus-visible**: `outline: 2px solid var(--ring); outline-offset: 2px;` (light: `#0D5380`, navy: `#60A5FA`). Never remove outlines; use `:focus-visible` only. For inputs the ring replaces the border colour change and adds `border-color: var(--ring)`.
- **Disabled**: opacity 0.5 on the whole control, `cursor: not-allowed`, no hover. (Disabled text is WCAG-exempt.)
- **Loading**: control keeps its size; label replaced by the 16px ring spinner (1s linear); `aria-busy="true"`; pointer events none.
- **Error**: border `#B91C1C` 1px + 1px inset ring same colour, message below in `small` `#B91C1C` with `AlertCircle` 16px; `aria-invalid="true"`, `aria-describedby`.
- Touch target >= 44x44 (CSS or invisible hit area) on public site; >= 36px height on admin dense controls with 44px on touch devices.

### 6.1 Buttons (shadcn `button` extended via cva)

Sizes (height / padding-x / font):
| Size | Height | Padding-x | Icon size | Font |
|---|---|---|---|---|
| `sm` | 36 | 14 | 16 | button 15px |
| `md` (default) | 44 | 20 | 20 | button 16px |
| `lg` | 52 | 28 | 20 | button 17px |
| `icon` | 44 x 44 | 0 | 20 | - |
| `icon-sm` | 36 x 36 | 0 | 16 | - |
Radius 4px. Gap between icon and label 8px. Font Afacad Flux 600.

Variants (light surface):
| Variant | Default | Hover | Active | Focus | Disabled |
|---|---|---|---|---|---|
| `primary` | bg #2F447D, text #FFFFFF | bg #3A5188 | bg #25376A, translateY(1px) | ring #0D5380 2px/2px offset | opacity .5 |
| `dark` (the live "Let's Talk" look; header CTA) | bg #111827, text #FFFFFF | bg #1F2937 | bg #0B1220 | ring | opacity .5 |
| `secondary` | bg #EEF1F8, text #25376A | bg #DDE3F1 | bg #BCC8E2 | ring | |
| `outline` | bg transparent, 1px #2F447D border (inset), text #2F447D | bg #EEF1F8 | bg #DDE3F1 | ring | |
| `ghost` | transparent, text #374151 | bg #F1F3F5, text #111827 | bg #E5E7EB | ring | |
| `accent` (burgundy; max one per page: the primary conversion on detail pages "Request a quote") | bg #843C40, text #FFFFFF | bg #6D3034 | bg #572628 | ring | |
| `link` | text #0D5380, underline 1px offset 3px, no padding, height auto | text #2F447D, underline 2px | text #25376A | ring | |
| `destructive` (admin) | bg #B91C1C, text #FFFFFF | bg #991B1B | bg #7F1D1D | ring | |
On navy (`.section-navy`): `primary` = bg #FFFFFF text #111827 hover #EEF1F8 active #DDE3F1; `outline` = 1px rgba(255,255,255,0.24), text #FFFFFF, hover bg rgba(255,255,255,0.08); `ghost` text #D1D5DB hover bg rgba(255,255,255,0.08); `link` colour #60A5FA hover #FFFFFF. `accent` is not used on navy.
Loading: spinner replaces label, width locked. Trailing icon (ArrowRight / Send / Phone) inherits colour. Buttons never wrap (`white-space: nowrap`); on mobile full-width when alone in a form or hero CTA stack (stack gap 12px).
Header "Let's Talk": variant `dark`, size `md`, `Phone` icon trailing; keeps the live look.

### 6.2 Links and text actions
"Read More" style = `link` variant with trailing `ArrowRight 16`. Label pattern: `Read more` + visually hidden ` about {title}`. Underline appears on hover on cards; always underlined inside prose.

### 6.3 Form controls (shadcn `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `label`)
- Label: `small` 14px, weight 500, `#111827`, 6px above the control; required marker: `*` in `#B91C1C` after the label text plus `required` attribute; helper text below, `small` `#4B5563`, 6px gap.
- **Input / select trigger**: height 44px (admin 36px), padding-x 14px, bg `#FFFFFF`, border 1px `#878F9D`, radius 4px, text 16px `#111827` (16px prevents iOS zoom), placeholder `#6B7280`. Hover: border `#4B5563`. Focus: border `#0D5380` + 2px outer ring `#0D5380` at offset 0 (so total visual 3px). Disabled: bg `#F1F3F5`, text `#6B7280`. Read-only: bg `#F8F9FA`, border dashed `#D1D5DB`. Error: see global. Success (optional): border `#15803D` + `Check` icon right.
- **Textarea**: min-height 144px (6 rows), vertically resizable, counter bottom-right `caption`.
- **Select**: shadcn Radix select; trigger shows `ChevronDown 16` right; popover `shadow-md`, item height 40, selected item has `Check` and bg `#EEF1F8`.
- **Checkbox**: 20x20, radius 2px, border 1.5px `#878F9D`; checked bg `#2F447D` with white `Check` 14px; focus ring as global; label 16px aligned top with 12px gap; hit area includes label (44px min height).
- **Radio**: 20px circle, checked inner dot 8px `#2F447D`.
- **Switch**: 40x24 track, off `#878F9D`, on `#2F447D`, thumb white 18px with `shadow-xs`.
- **Phone input**: free text with `inputMode="tel"`, placeholder `+251 911 123456`.
- Placeholders (neutral, replace "John Doe"): name `Full name`, email `name@company.com`, phone `+251 911 123456`, company `Company name`, message `Tell us which machine, part or service you need.` **(proposed)**.
- Form layout: single column on mobile, two columns for name/email on >= 768; vertical gap between fields 20px; submit button `primary` `lg` full-width on mobile, auto width on desktop, placed below the consent checkbox and left-aligned.
- Inline validation on blur, summary alert above the form on submit with error count and links to fields.

### 6.4 Badges and chips (shadcn `badge`)
Shape radius 2px, height 24 (small 20), padding-x 8, font Roboto 12px/16 weight 500, uppercase tracking 0.06em, no border unless noted.
| Variant | bg / text | Use |
|---|---|---|
| `country` (flag-free) | bg #FFFFFF with 1px #D1D5DB border, text #374151, text only (no icon). Format: country name uppercase, preceded by a 3px x 12px `#843C40` vertical tick (the burgundy punctuation); e.g. `| JAPAN` | product/brand cards (top-left over the image on a white label) |
| `agent` ("Official agent") | bg #2F447D text #FFFFFF, leading `Check 12` | brands flagged `isExclusiveAgent` |
| `status-published` | bg #DCFCE7 text #166534, dot `#15803D` | admin |
| `status-draft` | bg #F1F3F5 text #374151, dot `#6B7280` | |
| `status-scheduled` | bg #EDF6FB text #0B4469, `Clock 12` | |
| `status-archived` | bg #FEF3C7 text #92400E, `Archive 12` | |
| `status-new` (messages) | bg #F4DDDF text #6D3034, dot #843C40 | unread inbox |
| `tag` (news) | bg #EEF1F8 text #25376A, no uppercase, 13px | |
| `count` | bg #111827 text #FFFFFF, min-width 20, radius full | unread/filter counts |
Country badge never uses flag emoji or flag images. Show text from normalised `country` (e.g. "Japan", "France", "Sweden", "Italy", "Germany").

### 6.5 Cards (each type has its own composition)

**Common**: square corners, bg `#FFFFFF`, 1px `#E5E7EB` border, no shadow at rest. Hover (only where interactive): `shadow-sm`, border `#BCC8E2`. Whole card is one link target via a stretched pseudo-element on the title link; secondary actions (share) sit above with `position: relative; z-index: 1`.

**Product card (`ProductCard`)**: vertical.
1. Image frame 4:3 on `#FFFFFF`, with the **plate** offset block (`#E5E7EB`, 12px) behind it; image `object-fit: contain` for cut-outs (padding 24) or `cover`. Top-left: country badge; top-right: share icon button (`icon-sm`, ghost on white 90%). 
2. Body (padding 24 top, 0 sides inside card margin): title `h3` 22/28 (Afacad 600, 2 lines max), description `small` 14/22 `#4B5563` clamp 3 lines, 12px gap.
3. Footer row (border-top 1px `#E5E7EB`, padding 16): `Read more` link left; optional "Request quote" ghost button right on >= 1024 only.
Grid gap 32 horizontal, 40 vertical (plates need the room). Skeleton: same frame with `#E5E7EB` blocks.

**Brand card (`BrandCard`)**: horizontal-feel tile, not an image card. 3:2 logo tile on `#FFFFFF` with 1px border; logo contained (max 60% width), grayscale at rest 100% -> colour on hover (150ms). Under the tile: name `h4` 20/26, country badge inline right of name, description clamp 2 lines `small`, "View brand" link. `agent` badge overlays top-left of the tile. Fallback: `ImagePlaceholder variant="logo"` plus the brand name set in Afacad 600 centred as text.

**Service card (`ServiceCard`)**: split composition, full-width rows on the list page (see 7.8) but a compact vertical card in the home section: navy `#1F2937` panel (kept from the live site), 32px padding, top: 32px Lucide icon in `#60A5FA` + oversized stroke index numeral "01"; `h3` white; description `#D1D5DB` 3 lines; first 3 features as ring-bullet list `#D1D5DB`; bottom-left `link` variant on navy "Learn more". 

**News card (`PostCard`)**: image 16:10, tag badges row below image (8px), title `h3` 22/28 (3 lines max), excerpt `small` 2 lines, meta row: `<time>` `caption` + reading time separated by a 1px x 12px `#D1D5DB` divider. Featured variant spans 2 columns: image 21:9 left 7 cols, text right 5 cols.

**Stat card (`StatCounter` item)**: no box. Number `stat` token in `#2F447D` (on navy `#FFFFFF`), 3px x 24px burgundy tick above (on navy `#D08A90`), label `stat-label` below. Items separated by 1px vertical hairlines (desktop) with 32px padding; mobile 2x2 grid with horizontal hairlines.

**Spec / fact tile** (product key facts): label `eyebrow`-like 12px caps `#6B7280` over value 18px Afacad 600 `#111827`, in a 1px bordered strip, no card.

### 6.6 Header (`SiteHeader`, `MegaMenu`, `SearchCommand`)

Structure top to bottom (desktop >= 1024):
1. **Utility bar** (optional by `topbarEnabled`): height 40px, bg `#111827`, text `utility` 13px `#D1D5DB`, container-aligned. Left: `Phone` 14px + the three phone numbers separated by 1px dividers (`+251 911 514558`, `+251 911 175644`, `+251 114 709133`, each a `tel:` link, hover white), `Mail` + email. Right: "Addis Ababa, Ethiopia" `MapPin` 14px text; then a text link "Baraton Trade LLC (USA)" **(proposed)** is NOT shown; keep it simple. Hidden < 1024.
2. **Main bar**: height 80px, bg `#FFFFFF`, bottom hairline `#E5E7EB`. Left: logo (height 44). Centre-left: primary nav (items 16px Afacad 500 `#111827`, gap 32px, vertical padding 8px; active item `#111827` weight 600 with a 2px underline `#843C40` offset 6px; hover underline `#2F447D` 2px). Right: search trigger (see below), "Let's Talk" button (`dark`, `md`, Phone icon). Items: Home, About Us, Products (with `ChevronDown 16`), Service, Contact Us (live order and labels; plan allows CMS edit).
   - The live two-row header (logo row + nav row) is merged into one row at desktop: logo | nav | search + CTA. Nav row below is not used. At 1024-1279 the search collapses to an icon button.
3. **Search trigger**: desktop >= 1280 renders a fake input look (width 240, height 44, border 1px `#878F9D`, placeholder "Search products..." with `Search 20` left, right shows `kbd` "/" 12px in a 2px-radius `#F1F3F5` chip). Click/`/`/Cmd+K opens `SearchCommand`. < 1280: 44px icon button.
4. **Mega-menu (Products)**: panel full-container width (max 1200) anchored under the main bar, bg `#FFFFFF`, 1px border-bottom `#E5E7EB`, `shadow-md`, padding 32. Layout 12-col: cols 1-3 "Categories" (eyebrow header + link list `body` 16, each with count `caption` right-aligned), cols 4-6 "Brands" (two-column list of brand names with country in `caption`), cols 7-12 "Featured products" three compact cards (image 4:3 120px tall, title `h5`, country badge). Bottom strip (border-top, padding-top 16): "View all products" `link` + "Need a part or a quote? Talk to us" **(proposed)** `link`. Opens on hover-intent 120ms / click / Enter; Esc closes; arrows navigate.
5. **Condensed state** per Section 5.3.
Command palette (`SearchCommand`, shadcn `command` in `dialog`): width 640 max, radius 6, `shadow-lg`, input 56px tall 18px text with `Search 20`, group headings `eyebrow`-style 12px caps `#6B7280` (Products, Brands, Services, News, Pages), item height 48 with 40px 1:1 thumbnail (or ring placeholder) + title + country/type `caption`; selected row bg `#EEF1F8` with 3px left bar `#2F447D`; footer row: "Enter to open" "Esc to close" `kbd` hints and "See all results for '{q}'" link. Empty state: "No matches for '{q}'. Try a product or brand name." **(proposed)**. Recent searches list when empty (max 5, clock icon).
Header on mobile: see 6.7.

### 6.7 Mobile sheet nav (`MobileNav`)
Bar (< 1024): height 64 (condensed 56), logo 32px high left, right: search icon button (44) and menu button (44, `Menu 24`). Sheet (shadcn `sheet`, from right, width `min(92vw, 400px)`, bg `#FFFFFF`):
- Top row: logo + close button.
- Search field (full width, 48px) triggers the palette.
- Nav list: each row 56px high, text 20/28 Afacad 500, hairline between rows; items with children are accordions (chevron right-aligned), children rows 48px at indent 16 with `#4B5563`, 17px.
- Sticky bottom block (bg `#111827`, padding 20): "Let's Talk" `primary` on-navy full width 52px; below it phone links (each row 44px, `Phone 20` `#60A5FA` + number white) and email; socials row (36px buttons).
- Closes on route change; focus trapped; scroll locked.

### 6.8 Footer (`SiteFooter`)
Navy section (`section-footer` bg `#0B1220`), text colours per navy rules. Padding 72px top / 40px bottom (mobile 48 / 32).
- Row 1 (4 columns on the 12-col grid: brand 4 cols, Quick Links 2, Our Products 3, Contact Us 3; mobile stacked, columns 2-3 side by side (2 cols) then contact):
  1. Brand: `logo-full-white.svg` height 40, blurb `small` 14/22 `#D1D5DB` max 36ch ("Founded in 2007, BARATON Group started with importing Tata-Daewoo trucks spare parts and has grown into a diversified importer and distributor."), socials as 36px round buttons (`rgba(255,255,255,0.08)` bg, icon white, hover bg `#60A5FA` icon `#0B1220`).
  2. Quick Links: column title `h6` style (14px caps? live uses sentence case 18px bold): use `h5` 18/24 white; links 15px `#D1D5DB` with leading `ArrowRight 14` `#60A5FA` (live motif retained), row height 36, hover white + arrow shifts 4px. Links: About Us, Our Products, Our Services, Contact Us (+ News, FAQ when enabled).
  3. Our Products: first 5 featured products (FURUKAWA Rock Drills, Air Compressor, Montabert, Monark, Carmix) same link style; last row "All products" `link` on navy.
  4. Contact Us: `<address>`: `MapPin 18` `#60A5FA` + "Bole Road, Wollo Sefer / Addis Ababa, Ethiopia / P.O.Box 62716"; `Phone 18` + three numbers (each `tel:`); `Mail 18` + email. Icon column 28px, text 15px.
- Divider: 1px `rgba(255,255,255,0.12)` between row 1 and legal row, margin 48px.
- Legal row: left `caption` 13px `#9CA3AF`: "© {year} Baraton Group Co. All rights reserved." Centre/right: legal links (Privacy Policy, Terms) `#9CA3AF` hover white. Far right: **"Developed by Dagim Meseret"** in 13px: "Developed by" `#9CA3AF`, name `#FFFFFF` weight 500 (single colour; no gradient; link only if `NEXT_PUBLIC_DEVELOPER_URL` set, then underline on hover). The credit is fixed and not CMS-editable (plan 7.1). Mobile: stacked left-aligned, credit last.
- Optional top band above row 1: none (avoid redundant CTA; CtaBanner is a page section).

### 6.9 Breadcrumbs
Height 48, `small` 14px, `#4B5563`, separator `ChevronRight 14` `#9CA3AF` with 8px margins, links hover `#2F447D` underline, last item `#111827` weight 500 `aria-current`. Lives directly under the header on `#F8F9FA`, bottom hairline `#E5E7EB`. On mobile it shows only "< Parent" (back chevron + parent label) to save height; full trail in DOM (visually hidden alternate).

### 6.10 Tabs (shadcn `tabs`)
Underline style, not pills. List: border-bottom 1px `#E5E7EB`, tab height 48, padding-x 4px, gap 32px, font Afacad 600 17px `#4B5563`; active: `#111827` with 3px bottom bar `#2F447D` (overlapping the border); hover `#111827`; focus ring on the tab. Scrollable horizontally on mobile with edge fade; on product detail mobile tabs convert to accordion per plan 6.4.
**In-page sub-nav (About)**: sticky below header (top 80, height 56, bg `#FFFFFF` 92%, bottom hairline), items same as tabs with active tracked by IntersectionObserver.

### 6.11 Accordion (shadcn `accordion`; FAQ, product FAQ, mobile product sections)
Row: border-bottom 1px `#E5E7EB` (first row border-top 2px `#111827` for the FAQ list), trigger height min 64, padding 20 0, question `h4`-ish 20/28 Afacad 600 `#111827`, chevron (`ChevronDown 20`) right in `#2F447D`; open: chevron rotated, trigger text `#2F447D`; content `body` `#374151` padding-bottom 24, max-width 68ch. Index number "Q01" `caption` caps `#6B7280` left on desktop FAQ (optional).

### 6.12 Tables (`SpecTable`, generic table, admin DataTable base)
**Spec table (public)**: spec-sheet style. Full width, `border-top: 2px solid #111827`. Group header row (when `group` present): bg `#F1F3F5`, `eyebrow`-like 12px caps `#374151`, padding 10 16. Row: padding 14 16, border-bottom 1px `#E5E7EB`; label column 34% `small` 14px `#4B5563` weight 500; value column `spec-value` 15px `#111827` with `tabular-nums`, unit in `#6B7280` 13px after a thin space. Zebra none. Mobile: label above value (stacked, 2-line rows) not horizontal scroll. Implement as `<dl>` within `<table>` semantics or `<table>` with `th scope="row"`.
**Generic table (news facts, downloads)**: header row bg `#FFFFFF`, `table-head` 12px caps `#4B5563`, border-bottom 2px `#111827`; rows 56px; hover bg `#F8F9FA`. Responsive: > 640 normal; below becomes stacked rows.
**Downloads list**: row = `FileText 24` `#2F447D` + title (`h5`) + meta `caption` ("PDF, 2.4 MB, English") + `Download` outline `sm` button right.

### 6.13 Pagination (shadcn `pagination`, anchors)
Left-aligned, with the result summary on the right ("Showing 1-12 of 38" `small`). Items 44x44, radius 4px, `small` 15px, current: bg `#2F447D` text white, others text `#374151` hover bg `#EEF1F8`; prev/next with chevrons and labels "Previous"/"Next" (labels hidden < 640). Disabled ends 0.5 opacity. Max 7 visible with ellipsis.

### 6.14 Toasts (sonner)
Position bottom-right desktop, top-center mobile. Width 360, radius 4px, bg `#FFFFFF`, 1px border `#E5E7EB`, `shadow-lg`, left 4px accent bar by type (success `#15803D`, error `#B91C1C`, warning `#B45309`, info `#0D5380`), leading 20px icon in that colour, title 15px 600 `#111827`, description 14px `#4B5563`, action button `link` variant. Close button 32px. Never auto-dismiss errors under 8s.

### 6.15 Dialogs and sheets (shadcn `dialog`, `alert-dialog`, `sheet`, `drawer`)
Overlay `rgba(11,18,32,0.6)`. Dialog: bg `#FFFFFF`, radius 6, `shadow-lg`, max-width 520 (confirm) / 720 (forms) / 960 (media picker), padding 24, title `h4`, description `small` `#4B5563`, footer buttons right-aligned (secondary left of primary), destructive dialogs use `destructive`. Close `X` 36px top-right. Mobile: dialogs become bottom drawers (`drawer`) with 6px top corners (radius policy still applies).
Lightbox: full-screen bg `#0B1220` 96%, image `contain`, counter "03 / 12" `caption` white bottom-centre, arrows 48px circular ghost buttons white 12% bg, caption below image, thumbnails none.

### 6.16 Video facade (`VideoFacade`)
16:9 frame with thumbnail (CMS or `i.ytimg.com/vi/{id}/hqdefault.jpg`), `#111827` 25% overlay, centred play button: 72px square (radius 4) `#FFFFFF` 95% with `Play 28` filled `#2F447D`; hover: bg `#2F447D` icon white (150ms). Bottom-left over a scrim: title in white 16px Afacad 600, "YouTube" `caption`. Click replaces with `youtube-nocookie` iframe (autoplay, `title` set). Focusable button with label "Play video: {title}". Skeleton when thumbnail missing: ring placeholder on `#1F2937`.

### 6.17 Map facade (`MapEmbed`)
Frame 16:9 (mobile 4:3) with bg `#EEF1F8`, thin technical grid pattern (1px lines `#DDE3F1` every 32px), a centred ring-mark pin (ring 56px stroke `#2F447D` 2px, dot `#843C40`), address text in `body` and button "Load map" (`outline`). Below: "Get directions" `link` with `ArrowUpRight`. After click: iframe replaces content, `loading="lazy"`, `title="Map of {office}"`. Multiple offices: tabs (6.10) above the frame.

### 6.18 Empty states and errors (`StatusEmpty`, `StatusError`)
Centred in container (max-width 480), padding 64 24. 32px Lucide icon `#6B7280` (never illustrations), `h4` title, `body` description `#4B5563`, action button. Copy from ui-strings: "No products found", "No services found", "No companies found", "No messages found", plus "Add your first product/service/Company" in admin; public: "No products match these filters" + "Clear filters" **(proposed)**. Error: `AlertTriangle` `#B45309`, "Something went wrong" + "Try again" button + digest `caption`.

### 6.19 404 and error pages
See 7.14.

### 6.20 Other small components
- **Kbd**: 20px high, padding 0 6, radius 2, bg `#F1F3F5`, border 1px `#D1D5DB`, 12px Roboto 500.
- **Tooltip**: bg `#111827`, text white 13px, padding 6 10, radius 4, delay 300ms.
- **Skeleton**: see Section 5.
- **Progress / top loader**: 2px `#2F447D`.
- **Separator**: 1px `#E5E7EB`.
- **Avatar** (testimonials, admin): circle, initials Afacad 600 on `#DDE3F1` text `#25376A`.
- **Callout / note**: bg `#EEF1F8`, left bar 3px `#2F447D`, padding 16 20, `body`; warning variant bg `#FEF3C7` bar `#B45309`.
- **Quote block (markdown blockquote)**: left bar 3px `#843C40`, padding-left 24, Afacad 500 22/32 `#111827`.
- **Prose (markdown)**: `.prose` max 68ch; h2 `h3` token (28/34) margin-top 48 / bottom 16; h3 `h4`; h4 `h5`; paragraphs margin-bottom 20; lists: ul uses ring bullets (8px) with 12px gap, ol numerals in Afacad 600 `#2F447D`; images full width with `caption` and 1px border; tables use the spec table style; links per 3.2; hr = RingDivider; inline code none.
- **Share dropdown**: popover list rows 44px: Copy link, WhatsApp, LinkedIn, X, Facebook, Email.
- **Cookie consent**: bottom-left card 420 wide (mobile full width bottom sheet), bg `#FFFFFF`, 1px border, `shadow-lg`, radius 6; buttons: "Accept all" primary, "Reject" outline, "Preferences" link. No overlay.
- **Preview banner**: full-width 36px bar `#FEF3C7` text `#92400E` 13px "Preview mode - Exit" link.
- **SkipLink**: hidden until focus; then top-left fixed, bg `#111827`, text white, padding 12 20, z 100.

---

## 7. Page-by-page visual descriptions

Conventions: Widths = 1440 desktop / 768 tablet / 390 mobile. Section names match plan block types (`hero`, `brandsMarquee`, `companyStory`, `stats`, `featuredProducts`, `services`, `videos`, `testimonials`, `news`, `ctaBanner`, `ceoMessage`, `missionVision`, `subsidiaries`, `timeline`, `richText`, `imageText`, `cardGrid`, `faq`, `contactCta`). All pages share: SiteHeader (6.6), Breadcrumbs (6.9, not on home), `<main>`, SiteFooter (6.8). "Navy" = `.section-navy` `#111827`. Section padding sizes refer to 4.3 (`lg`/`md`/`sm`). Every section heading block = optional index numeral + eyebrow + `h2` + optional `lead`.

Page header pattern (`PageHeader`) used on non-home pages: bg `#F8F9FA`; breadcrumb row above; padding 48 top / 40 bottom; left 8 cols: eyebrow (burgundy tick + section name), `h1`, `lead` (max 56ch); right 4 cols (desktop): optional fact stack or action; bottom 1px `#D1D5DB` rule. Ring field decoration right-aligned at 6% (`#DDE3F1`) allowed once.

### 7.1 Home `/`

**Hero concept ("The Plant Floor")** - not a stock slider. A full-bleed industrial photograph (drill rig on a quarry face / Furukawa rock drill in operation; CMS image per slide) fills a 1440 x 760 band (min-height 640, `100svh - header` capped at 820). Over it, the indigo scrim (4.7). The **persistent headline does not slide**; only the right-hand "product index" and the background image change per slide. This keeps `h1` stable and gives real hierarchy.
Composition at 1440 (container 1200, 12-col):
- Cols 1-7, vertically centred, left-aligned: eyebrow "Official agent of Furukawa Rock Drill and Airman in Ethiopia" (white, 13px caps, burgundy-tint tick `#D08A90`); `h1` `display` token 72/72 white, max 14ch per line: **"Rock drilling, compressed air and construction machinery for Ethiopia."** **(proposed headline, built from the real positioning: "Today, the group provides a wide array of services, including rock drilling, compressed air systems, filtration, construction machinery attachments, and real estate.")** CMS field = block `heading`; render it as the page `h1` (this overrides the plan's hidden-h1 option for visible text; slide titles render `h2`/`p`). Below: `lead` white 20/32 `#D1D5DB` max 52ch: "Importer and distributor since 2007: genuine machines, parts and field service from Furukawa, Airman, Montabert and more." **(proposed)**. CTA row (gap 12, margin-top 40): `primary`-on-navy `lg` "Explore products" (-> /products), `outline`-on-navy `lg` "Request a quote" (-> /contact?subject=quote).
- Cols 9-12: **Product index rail**: a vertical list of the slide products, replacing the live "1/8" counter + thumbnail strip: each row 56px: index "01" (Afacad 600 16px `#9CA3AF`, active `#FFFFFF`), product title (Afacad 600 18px white, `#D1D5DB` inactive), country `caption` right-aligned; active row has 2px left bar white and a 2px progress line along its bottom edge (autoplay progress, 5.3); hover bg `rgba(255,255,255,0.06)`. Above the rail: `h2`-level `caption` "Product lines" and the counter "01 / 08" (Afacad 600 14px). Under the rail, the active product's `shortDescription` (14/22 `#D1D5DB`, 3 lines) and link "View {product}" (`link` on navy).
- Corner crosses and 12-column grid lines (4.10) at 5% white. No other ornament.
- **Key facts strip** (overlaps the hero bottom, anchored to the bottom edge, bg solid `#0B1220`, height 96, container-aligned): 5 facts separated by 1px `rgba(255,255,255,0.12)` verticals: "2007" / "Founded", "9" / "Partner brands", "Furukawa and Airman" / "Official agent in Ethiopia", "2019" / "USA subsidiary, Baraton Trade LLC", "Addis Ababa" / "Bole Road, Wollo Sefer". Numerals Afacad 700 28px white, labels `stat-label` `#9CA3AF`. These come from `stats` / settings; if CMS values are missing, a fact is dropped, never "0".
Tablet 768: image band 640 high; headline `display` 56/58; index rail moves under the CTA as a horizontal row of 4 compact index chips (scrollable); facts strip 2 rows x 3 (auto height).
Mobile 390: band `4:5` height 640; image focus top; scrim vertical (4.7); content bottom-aligned: eyebrow, `h1` 40/42, lead (hidden, replaced by 1 line "Importer and distributor since 2007"), CTA stack (full width, 52px); progress as 4px dots row (`01`..`08` collapsed to dots, active white 24px wide bar) above the CTAs; facts strip becomes a 2x2 grid below the hero on `#0B1220` (first four facts).
Missing slide image: `ImagePlaceholder` on `#111B38` with large ring field; text remains legible.

**Section 2 `brandsMarquee`** (`sm`, bg `#FFFFFF`, border-bottom hairline): heading left-aligned "Brands We Work With" `h3`-size 28/34, `small` "Trusted by industry leaders worldwide" right-aligned on desktop. Track: logos 40px high in uniform 180x80 cells with no borders, grayscale + 70% opacity, hairline vertical separators `#E5E7EB` between cells; hover: colour, 100%. Edge masks 64px. Official-agent logos (Furukawa, Airman) are first in order. Missing logo -> text name in Afacad 600 18px `#6B7280`. Mobile: cell 140x64, same behaviour. Each logo link `aria-label="{name}, {country}"`.

**Section 3 `companyStory`** (navy `#111827`, `lg`): desktop 12-col. Left cols 1-5: oversized index numeral "01" hidden; eyebrow "About the group" **(proposed)**; the **colour logo on a white 4:3 plate** (live site has the logo on a white block; keep: white panel 100% col width, padding 48, logo contained) with plate offset `#1F2937`; under it a 3-item milestone list (`milestones[]`): "2007 Import and distribution begins" / "2019 Baraton Trade LLC (USA) and woodworking factory" / "Today Rock drilling, compressed air, filtration, attachments, real estate" with year in `#60A5FA` Afacad 600 and text `#D1D5DB`, separated by hairlines. Right cols 7-12: paragraphs from CMS in `body-lg` 18/30 `#D1D5DB` (first paragraph `lead`-size 20/32 `#FFFFFF`), max 60ch, 24px gaps; CTA row: `primary` "Learn more" (-> /about) and `outline` "Our Products". Ring field right edge 8%. Tablet: logo plate top, text below, 8 cols. Mobile: plate 100% (padding 32), paragraphs 17/28, CTAs stacked.

**Section 4 `stats`** (`sm`, bg `#F8F9FA`): 4 stat items in one row (desktop) with vertical hairlines; each: burgundy tick, `stat` numeral 64 `#2F447D`, `stat-label`. Seed: "2007 / Founded", "9 / Partner brands", "8 / Product lines", "5 / Countries of manufacture" **(derived from product data: Japan, France, Sweden, Italy, Germany; bind to data)**. Counters per 5.3. Mobile 2x2. Reveal stagger.

**Section 5 `featuredProducts`** (`lg`, bg `#F8F9FA`): header row: eyebrow "Catalogue" **(proposed)**, `h2` "Our Products", right-aligned `link` "View all products". Grid of `ProductCard` (3 columns desktop, gap 32/40; 2 tablet; 1 mobile). All cards are the same format; the grid is preceded by a **country filter row** (static chips linking to `/products?country=Japan`, etc.; `ghost` chips 36px). Limit 6.

**Section 6 `services`** (`lg`, bg `#FFFFFF`): heading "Our Services" `h2`. Desktop: 2 `ServiceCard` navy panels side by side (cols 1-6, 7-12), each tall with the index numeral "01"/"02" at 120px stroke at the card top-right (`rgba(255,255,255,0.12)` stroke), icon, title (live: "Parts and Accessories", "Maintenance and Service"), shortDescription, 3 features (ring bullets), link. With more than 2 services the layout becomes a 3-up grid with the same card. Mobile stacks.

**Section 7 `videos`** (`lg`, bg `#F8F9FA`): heading "Featured Videos" + subheading "Discover our work through these immersive experiences". Layout is **1 + 4**, not a 3x2 grid of identical cards: first video large (cols 1-8, 16:9) with title/description to its right? Plan 6.1 says 3x2 grid. Decision (design wins on visuals): desktop = large featured video (cols 1-7, 16:9) + vertical list of the next 5 (cols 8-12) as rows of 120x68 thumbnail + title (`h5`) + brand/product `caption`; clicking a list row swaps the large player (client). Tablet: large video above, list in 2 columns below. Mobile: large video + list rows stacked. Without JS the list rows link to the YouTube watch page. Facade per 6.16.

**Section 8 `testimonials`** (hidden when empty; `lg`, bg `#EEF1F8`): single large quote at a time, Afacad 500 `quote` token, left burgundy 3px bar, author name + company in `small`; prev/next square ghost buttons, counter "1 / 3". Not a 3-card row.

**Section 9 `news`** (hidden when empty; `lg`, bg `#FFFFFF`): heading "News", 3 `PostCard` (first featured wide on desktop: 2 cols + 1 stacked list of 2). 

**Section 10 `ctaBanner`** (`lg`, navy `#111827` with duotone background image optional, ring field 8%): left cols 1-8 `h2` white "Need a machine, a part or a service quote?" **(proposed)**; `lead` "Tell us what you run. We reply with availability and lead time." **(proposed)**; right cols 9-12: `primary`-on-navy `lg` "Let's Talk" with `Phone` icon, below it the primary phone `+251 911 514558` as a large `tel:` link (Afacad 600 28px white) and the email in `#60A5FA`. Mobile: stacked, button full width. Directly followed by the footer (see 2.4 seam rule).

Home wireframe, desktop 1440 (ASCII; `#` = navy, `.` = light):
```
+------------------------------------------------------------------------------------------+
| ################ utility bar (40): tel x3 | mail                    Addis Ababa ########## |
+------------------------------------------------------------------------------------------+
| (o)BARATON  Home  About Us  Products v  Service  Contact Us     [ Search products.. / ][Let's Talk] |  80px, white
+------------------------------------------------------------------------------------------+
|##### HERO 1440x760 photo + indigo scrim  +                                              +|
|## ---- Official agent of Furukawa Rock Drill and Airman in Ethiopia     PRODUCT LINES 01/08|
|##                                                                      | 01 FURUKAWA Rock Drills  JAPAN|
|## Rock drilling, compressed                                            | 02 Air Compressor        JAPAN|
|## air and construction                                                 | 03 Montabert            FRANCE|
|## machinery for Ethiopia.                                              | 04 Monark              SWEDEN|
|##                                                                      | 05 Carmix               ITALY|
|## Importer and distributor since 2007...                               | 06 Elsasser           GERMANY|
|##                                                                      | 07 Walter             GERMANY|
|## [Explore products] [Request a quote]                                 | 08 Nakayama             JAPAN|
|## +---------+---------+----------------------+---------+----------------+  (facts strip 96, #0B1220)|
|## | 2007    | 9       | Furukawa and Airman  | 2019    | Addis Ababa    |                          |
|## | Founded | Brands  | Official agent in ET | USA sub | Bole Road      |                          |
+------------------------------------------------------------------------------------------+
| Brands We Work With ................................ Trusted by industry leaders worldwide|
| [FURUKAWA] [AIRMAN] [Montabert] [Monark] [Carmix] [Elsasser] [Walter] [Nakayama] ->->->   |
+------------------------------------------------------------------------------------------+
|######## companyStory (navy)                                                              |
|##  +--------------------+   BARATON Group began operating in 2007, as importer and...    |
|##  |   (o) BARATON      |   These included FURUKAWA Rock Drilling Machines from Japan... |
|##  |   GROUP CO. (white)|   In 2019, BARATON Group expanded further...                   |
|##  +--------------------+   Since its formation...  [Learn more] [Our Products]          |
|##  2007 ... / 2019 ... / Today ...                                           ((ring field))|
+------------------------------------------------------------------------------------------+
|  2007 Founded  |  9 Partner brands  |  8 Product lines  |  5 Countries      (stats strip)|
+------------------------------------------------------------------------------------------+
| CATALOGUE                                                                                 |
| Our Products                                                         View all products -> |
| [Japan][France][Sweden][Italy][Germany]                                                   |
| +--------+ +--------+ +--------+                                                          |
| | plate  | | plate  | | plate  |   3 x 2 ProductCards (4:3 image, country badge, share)   |
| +--------+ +--------+ +--------+                                                          |
+------------------------------------------------------------------------------------------+
| Our Services       [ 01 Parts and Accessories (navy) ]  [ 02 Maintenance and Service ]   |
+------------------------------------------------------------------------------------------+
| Featured Videos  / Discover our work...                                                  |
| [ large 16:9 player (7 cols) ]   | 02 title  thumb | 03 title thumb | 04 ... (list 5 cols)|
+------------------------------------------------------------------------------------------+
| (testimonials, news: only when populated)                                                 |
+------------------------------------------------------------------------------------------+
|######## CTA: Need a machine, a part or a service quote?          [Let's Talk]  +251 911..|
|######## footer: logo+blurb | Quick Links | Our Products | Contact Us ... Developed by ... |
+------------------------------------------------------------------------------------------+
```
Home wireframe, mobile 390:
```
+----------------------------+
| (o)BARATON GROUP CO.  [Q][=]|  64px
+----------------------------+
|############################|
|##  photo + bottom scrim  ##|
|##                        ##|
|## OFFICIAL AGENT OF       |
|## FURUKAWA AND AIRMAN     |
|## Rock drilling,           |
|## compressed air and      |
|## construction machinery  |
|## for Ethiopia.           |
|## [ ===--  ] dots 01/08   |
|## [ Explore products    ] |
|## [ Request a quote     ] |
+----------------------------+
| 2007      | 9              |
| Founded   | Partner brands |
| Furukawa+Airman | 2019     |
+----------------------------+
| Brands We Work With        |
| [logo][logo][logo] ->      |
+----------------------------+
|## companyStory (navy)      |
|## [white logo plate]       |
|## paragraphs               |
|## [Learn more]             |
|## [Our Products]           |
+----------------------------+
| stats 2x2                  |
| Our Products               |
| [card]  (1 col)            |
| [card]                     |
| View all products ->       |
| Our Services (stack)       |
| Featured Videos (1+list)   |
|## CTA  [Let's Talk]        |
|## footer (stacked)         |
+----------------------------+
```
Data binding: `hero.heading` -> h1; slides auto-filled from featured products (`image`, `title`, `country`, `shortDescription`); facts from `stats.items`; brands from published brands ordered `sortOrder`; sections whose data is empty are skipped.

### 7.2 About `/about`

Sticky in-page sub-nav (6.10): CEO Message | Philosophy | Baraton Trade LLC | Baraton Trade PLC (live labels; plan uses anchors).
1. **`pageHeader`** (`PageHeader`, bg `#F8F9FA`): eyebrow "About Us", `h1` "About Us" `h1` token, `lead` from `intro`; right column: a 4:5 `heroImage` (company/site photo) with plate offset OR, when missing, the large concentric ring placeholder. Desktop 8/4 split; tablet stacked; mobile: image hidden if missing.
2. **`companyStory` + `timeline`** (bg `#FFFFFF`, `lg`): left cols 1-5 sticky `h2` ("Our story" **(proposed)**) + the 2007/2019 lead; right cols 6-12: paragraphs in `body-lg`, then **vertical timeline**: a 1px `#D1D5DB` line at x=8px of the column with 16px ring nodes (open ring, burgundy dot for the current/last item); each item: year `h3` 28 Afacad 700 `#2F447D`, title `h5`, description `body`. Seed: 2007 (import and distribution of Tata-Daewoo truck spare parts, heavy construction machinery rental), brand additions (Furukawa, Airman, Hifi Filtration, Robit), 2019 (Baraton Trade LLC, USA and woodworking factory). Reveal stagger.
3. **`ceoMessage`** (navy `#1F2937` full-bleed band, `lg`; mirrors the live dark CEO block but composed better): heading "CEO's Message" `h2` white left-aligned. 12-col: cols 1-4 portrait (4:5, cut-out photo on a `#25376A` plate with 12px offset `#111B38`, name + role caption below: "{name}, {role}"); cols 6-12 quote in `quote` token (26/38 Afacad 500, white), a 4px x 48px `#D08A90` bar above, two paragraphs from ui-strings (the first as the quote opening; the second `body-lg` `#D1D5DB`); decorative large quotation mark SVG at 80px `rgba(255,255,255,0.12)`. Mobile: portrait 60% width left-aligned, text below.
4. **`missionVision`** (bg `#F8F9FA`, `lg`; label "Philosophy"): two columns. Left "Mission": four numbered rows (01-04, numerals `h3` `#2F447D`) each separated by hairlines: the four live mission statements as `body-lg`. Right "Vision": a bordered white panel (1px, padding 40) with the vision paragraph in `lead` 20/32, top 4px `#2F447D` bar, closing line "Together, we shape the future!" in Afacad 600 `#2F447D`. 
5. **`subsidiaries`** (bg `#FFFFFF`, `lg`, anchors `#baraton-trade-llc`, `#baraton-trade-plc`): two full-width panels stacked (not side-by-side cards), each a 12-col row with a 2px top rule `#111827`: left cols 1-4: oversized index numeral "01"/"02", name in `h2` ("Baraton Trade LLC", "Baraton Trade PLC"), country in `country` badge ("USA, Florida", "Ethiopia"), `agent` badge on PLC ("Official agent of Furukawa and Airman in Ethiopia"); right cols 5-12: description paragraphs; highlights as a **2-column checklist** with ring bullets (LLC: Technological Solutions; Real Estate Development and Portfolio Management; Stock and Share Portfolio Management; Global Product Distribution - PLC: Genuine replacement parts; Technical support; Self-repair resources); LLC "exclusive sales and marketing rights" list as a mini spec table (Furukawa Rock Drill Co. Ltd - Japan, Ethiopia / Airman Industries Ltd - Japan, Ethiopia). 
6. **`capabilities`** (cardGrid, bg navy `#111827`, `md`): four capabilities in a **single row divided by hairlines** (not cards): Construction machinery, Rock drilling tools, Hydraulic attachments, Equipment servicing and support; each with a 32px Lucide icon (`Drill`, `Cog`, `Wrench`, `Hammer`) in `#60A5FA` and text `h4` white.
7. `brandsMarquee`, 8. `stats`, 9. `ctaBanner` (as Home).
Responsive: sub-nav chips scroll; two-column blocks stack; timeline line stays left with 16px indent on mobile.

### 7.3 Products list `/products`
- `PageHeader`: eyebrow "Catalogue" **(proposed)**, `h1` "Products", `lead` from `productsIntro`; right: result count stat ("8 product lines" in `stat` 44).
- **Toolbar** (sticky below header: top 80/64 condensed, bg `#FFFFFF` 96% opacity, borders top/bottom hairline, height 64): search input (width 320, 44px), Country select, Category select, Brand select (each 44px, radius 4), Sort select right-aligned; result count `small` "8 products" `aria-live`. "Clear filters" `link` appears when active. Mobile: toolbar shows search + a "Filters (n)" `outline` button opening a bottom `drawer` (selects stacked, sticky "Show {n} products" `primary` button).
- **Grid** (bg `#F8F9FA`, `md`): ProductCards 3 columns (4 at >= 1440? keep 3: plates need width), 2 tablet, 1 mobile; vertical gap 48 to give plates room. Skeleton: 6 cards.
- Active filter chips row above grid (`tag` chips with `X`). 
- `Pagination` below (6.13), 12 per page.
- Empty: StatusEmpty "No products match these filters" + "Clear filters" + contact link.
- After grid (once): a **"Can't find your model?" band** (bg `#EEF1F8`, 1px borders, padding 32): left text "Can't find the model or part you need? Send us the make and part number." **(proposed)**; right `primary` "Request a quote".
Category pages: same with `h1` = category name, description in `lead`, indexable.

### 7.4 Product detail `/products/[slug]`
Layout 1440: breadcrumb; then top block 12-col with 24 gutters; gallery cols 1-7, summary cols 8-12 (no sticky behaviour).
1. **Gallery** (cols 1-7): main image 4:3 on white `#FFFFFF` with 1px border and the plate offset; thumbnails row below (5 x 80px 1:1, 8px gap, active 2px `#2F447D` border); zoom icon button (`Maximize2`) bottom-right opens Lightbox; counter "1 / 6" `caption`. Missing: `ImagePlaceholder variant="product"`.
2. **Summary** (cols 8-12): country badge + `agent` badge row; `h1` (52/56 desktop; product names are short); brand link row: "by **{brand}**" with 24px brand logo (grayscale) linking to `/brands/{slug}`; `lead` shortDescription (20/32, clamp none); **key facts list** (`features`, max 5) with ring bullets `body`; spec tile strip (up to 3 headline specs from `specs` in the "fact tile" format, 3 across, 1px bordered); CTA stack: `accent` (burgundy) `lg` "Request a quote" full-width, below two buttons side by side: `outline` `md` "Download brochure" (`Download`; "PDF, 2.4 MB" caption below), and `ghost` `md` "Share" (`Share2`). Under the stack: reassurance line `small` `#4B5563` with `Phone 16`: "Questions? Call +251 911 514558" **(proposed)**.
3. **Tabs** (full container width, `lg` padding 64 top): Overview | Specifications | Downloads | Video. Overview = `Prose` in cols 1-8 with a right rail cols 9-12 containing "At a glance" fact table (brand, origin country, category, SKU) in spec-table style and "Related services" links. Specifications = full-width `SpecTable` with group headers (the spec-sheet centrepiece; first group open); Downloads = downloads list (6.12); Video = facade 16:9 in cols 1-8. Mobile: tabs -> accordion (6.11), Overview open by default.
4. **Inquiry strip** (navy `#111827`, `sm`, full-bleed): row: "Interested in {title}?" `h3` white; sub "Send us the details of your site and we will confirm availability." **(proposed)**; right: phone number (Afacad 600 24px, `tel:`), WhatsApp button (`outline` on navy, `MessageCircle`) when set, `primary`-on-navy "Request a quote". Mobile stacked.
5. **FAQ** (bg `#FFFFFF`, `md`): `h2` "Frequently asked questions" **(proposed heading)**; accordion cols 1-8.
6. **Related products** (bg `#F8F9FA`, `lg`): `h2` "Related products"; 4 compact `ProductCard`s in one row (carousel on tablet/mobile with 1.15 visible, `carousel` Embla) ; below "Related services" as 2 horizontal text rows with `link`.
States: 404 -> branded 404; missing gallery -> placeholder; missing brochure -> button hidden and facts strip adjusts.

Product detail wireframe, desktop 1440:
```
+------------------------------------------------------------------------------------------+
| header (80) ........................................................................... |
| Home > Products > Rock Drills > FURUKAWA Rock Drills                                      |
+------------------------------------------------------------------------------------------+
| +--------------------------------------+  | | JAPAN | | OFFICIAL AGENT                  |
| |                                      |  |                                              |
| |        MAIN IMAGE 4:3  (plate)       |  | FURUKAWA Rock Drills            (h1)         |
| |                               [zoom] |  | by [logo] FURUKAWA Rock Drill Co.            |
| +--------------------------------------+  | FURUKAWA Co., began as a copper mining...    |
| [t1][t2][t3][t4][t5]          1 / 6       |  (lead)                                      |
|                                           | o Feature one      o Feature two             |
|                                           | [spec tile][spec tile][spec tile]            |
|                                           | [      Request a quote (burgundy)      ]     |
|                                           | [Download brochure]   [Share]                |
+------------------------------------------------------------------------------------------+
| Overview | Specifications | Downloads | Video                                              |
|-------------------------------------------------------------------------------------------|
| Prose (cols 1-8)                                         | AT A GLANCE (cols 9-12)       |
| h2.. paragraph.. list.. image                            | Brand   FURUKAWA              |
|                                                          | Origin  Japan                 |
|                                                          | Category Rock drills          |
|                                                          | Related services ->           |
+------------------------------------------------------------------------------------------+
|######## Interested in FURUKAWA Rock Drills?   +251 911 514558  [WhatsApp] [Request a quote]|
+------------------------------------------------------------------------------------------+
| FAQ (accordion)                                                                           |
| Related products  [card][card][card][card]                                                |
|######## CTA / footer                                                                      |
+------------------------------------------------------------------------------------------+
```
Tablet: gallery full width above summary (single column), thumbnails 6 across; summary 2-col (text left 5, CTAs right 3) at 768? Keep single column, CTA buttons side by side. Mobile: gallery swipe carousel with dots (no thumbnails), summary single column, sticky bottom bar (64px, bg `#FFFFFF`, top hairline, `shadow-header` inverted) with the `accent` "Request a quote" and a 44px phone icon button; tabs -> accordion.

### 7.5 Brands list `/brands`
- `PageHeader`: `h1` "Brands We Work With", lead from `brandsIntro`.
- **Country filter chips** row (`ghost` chips 36px, active `primary` chip): All, Japan, France, Sweden, Italy, Germany (from facets, with counts in `caption`).
- **"Official agents" feature band** (bg `#111827`, `md`): the two exclusive-agent brands (Furukawa Rock Drill Co, Airman) as two large horizontal panels (logo tile 3:2 white left 5 cols; right: name `h3` white, country, `agent` badge, description 3 lines, `link` "View brand"). Title eyebrow "Official agent in Ethiopia".
- **All brands** (bg `#F8F9FA`, `lg`): `BrandCard` grid 4 across at 1440 (3 at 1024, 2 tablet, 1 mobile? 2 on mobile with compact tile: yes 2 columns at 390 with description hidden). Gap 24.
- Closing `ctaBanner` with copy "Looking for a brand that is not listed?" **(proposed)**.

### 7.6 Brand detail `/brands/[slug]`
1. `BrandHero` (bg `#FFFFFF`, bottom hairline, padding 56/48): left cols 1-3 logo tile (3:2, 1px border, white) ; cols 4-9: `agent` + `country` badges, `h1` brand name, `lead` shortDescription; right cols 10-12 (desktop): `primary` "Contact us about {name}" + `link` external "Visit {name} website" with `ArrowUpRight`. Missing logo: name set as `h1` over the logo placeholder.
2. **Description** (bg `#F8F9FA`, `lg`): `Prose` cols 3-9 (centred reading column? left aligned to cols 1-8) with a sticky right rail (cols 10-12) "Brand facts": country, products count, "Official agent" yes/no, website - spec-table style.
3. **Video** (bg `#111827`, `lg`, only when valid id): `h2` "{name} in action" **(proposed)**, facade 16:9 centred cols 2-11 with plate `#1F2937`.
4. **Products from {name}** (`lg`, bg `#F8F9FA`): ProductCard grid 3 columns (hidden if empty).
5. Related services (2 text rows), other brands (carousel of brand tiles, 5 visible), `ctaBanner`.
Mobile: BrandHero stacks (logo tile 60% width), CTAs full width.

### 7.7 Services list `/services`
- `PageHeader`: `h1` "Our Services", `lead` intro.
- **Service rows** (bg `#FFFFFF`, `lg`): each service a full-width 12-col row separated by 2px `#111827` top rule, 64px vertical padding: left cols 1-3: index numeral "01", icon 32; cols 4-8: `h2`-size title (34/38 Afacad 700) + `lead` description + `link` "Learn more about {title}"; cols 9-12: **"What is included"** checklist (first 5 features, ring bullets, `body` 16) in a `#F8F9FA` bordered panel; services image 16:10 shown above on tablet/mobile (hidden when missing: no placeholder in list rows; the panel carries the layout). This replaces the live two-navy-boxes with a ledger-like list.
- `ctaBanner` "Request a service" (-> /contact?subject=service).

### 7.8 Service detail `/services/[slug]`
1. Hero (bg navy `#111827`, `lg`): breadcrumb (navy variant), eyebrow "Service", `h1` white, `lead` `#D1D5DB`, `primary`-on-navy "Request this service", right cols 8-12 image 16:10 with plate `#1F2937` (placeholder on `#1F2937` when missing).
2. **What is included** (bg `#FFFFFF`, `lg`): `h2` "What is included"; features as a numbered list in a 2-column ledger: number `h3` `#2F447D` "01", feature title (text before the en dash in source e.g. "Preventive Maintenance") as `h4` and its description after the dash as `body`; rows divided by hairlines. (Importer splits "Title - description" strings; if no separator, whole string is `h4`.)
3. `descriptionMarkdown` (Prose cols 1-8) if present.
4. **Process** (`process[]`, bg `#F8F9FA`, `lg`): horizontal 4-step track on desktop: step number in a 40px ring (open ring, numeral inside Afacad 700), connecting 1px line, title `h4`, text `small`; vertical stack on mobile with the line on the left.
5. Related brands (logo row) and products (3 cards), FAQ accordion, `ctaBanner`.

### 7.9 Contact `/contact`
1. `PageHeader` "Contact Us" (title per plan) + lead "Fill out the form or contact us through these channels".
2. **Main block** (bg `#F8F9FA`, `lg`) - the live split panel, refined: one 12-col container with a 1px `#E5E7EB` border and `shadow-sm`: left cols 1-5 navy `#111827` panel (padding 48): heading "Contact Information" `h3` white; lead; three info rows each with a 36px circular icon (`Phone`, `Mail`, `MapPin`) and label `h5` white + values `body` `#D1D5DB`: Phone (3 numbers each own line, `tel:`), Email, Address ("Bole Road, Wollo Sefer / P.O.Box 62716 / Addis Ababa, Ethiopia"), then a hairline and "Follow Us" with 36px social buttons; a second office block (Baraton Trade LLC, Florida) appears when `offices[1]` has an address, separated by hairline, with the office name `h5` and `country` badge. Right cols 6-12 white panel (padding 48): `h3` "Send us a message"; form per 6.3: Name + Email (2 cols), Phone + Company (2 cols), Subject select, product chip "Inquiry about: {product title}" (removable `tag` chip with `X`) when prefilled, Message (6 rows) with counter, consent checkbox, submit `primary` `lg` "Send Message" with `Send` icon; honeypot hidden; captcha slot above the button. Success: panel content replaced by a check-circle (`#15803D` 32px), `h3` "Message sent" **(proposed)**, body from `successMessage`, `link` "Back to home". Errors per 6.3.
   - Mist `#E0E7FF` is used as the form panel's field-group highlight background for the product chip only (chip bg `#E0E7FF`, text `#2F447D`).
3. **Map** (bg `#FFFFFF`, `md`): per-office tabs + `MapEmbed` facade 16:9 cols 1-8 and cols 9-12 an `<address>` card with "Get directions" `link`, hours (`Clock 16`) when set.
4. Optional `faq` snippet (3 items) when FAQ enabled **(proposed)**.
Responsive: tablet stacks navy info panel above the form? Decision (plan: form first on mobile): at 768 the layout is two columns 4/8; at < 768 form first (white panel), navy info panel below, then map.

Contact wireframe, desktop 1440:
```
+------------------------------------------------------------------------------------------+
| header                                                                                    |
| Home > Contact Us                                                                         |
| CONTACT                                                                                   |
| Contact Us (h1)                                                                           |
| Fill out the form or contact us through these channels                                    |
+------------------------------------------------------------------------------------------+
| +------------------------------+-----------------------------------------------------+   |
| |#### Contact Information #####|  Send us a message                                  |   |
| |#### lead                #####|  [Your Name        ] [Email Address       ]         |   |
| |## (ph) Phone                ##|  [Phone Number     ] [Company             ]         |   |
| |##      +251 911 514558     ##|  [Subject v                               ]         |   |
| |##      +251 911 175644     ##|  [Inquiry about: FURUKAWA Rock Drills  x ]          |   |
| |##      +251 114 709133     ##|  [Your Message                            ]         |   |
| |## (@) Email                 ##|  [                                        ]         |   |
| |##      aboma.taye@gmail.com##|  [] I agree to the processing of my data           |   |
| |## (pin) Address             ##|  [ Send Message  > ]                                |   |
| |##      Bole Road, Wollo Sefer ##|                                                     |   |
| |##      P.O.Box 62716         ##|                                                     |   |
| |##      Addis Ababa, Ethiopia ##|                                                     |   |
| |## Follow Us (in)(x)(ig)     ##|                                                     |   |
| +------------------------------+-----------------------------------------------------+   |
+------------------------------------------------------------------------------------------+
| Find us                              [Addis Ababa (PLC)] [Florida, USA (LLC)]            |
| +----------------------------------------------+  Baraton Trade PLC                       |
| | map facade 16:9: grid + ring pin [Load map]  |  Bole Road, Wollo Sefer ...              |
| +----------------------------------------------+  Get directions ->                       |
+------------------------------------------------------------------------------------------+
|######## footer                                                                            |
+------------------------------------------------------------------------------------------+
```

### 7.10 News list `/news` and detail `/news/[slug]`
**List**: `PageHeader` "News"; tag chips row (`ghost`, active `primary`); **featured post** (first, bg `#FFFFFF` bordered, 12-col: image 21:9 cols 1-7, text cols 8-12: tags, `h2`, excerpt `lead`, meta, `link` "Read article"); then grid of `PostCard` 3 columns (2 tablet, 1 mobile), pagination 9 per page. Empty: "No news yet."
**Detail**: header block (bg `#F8F9FA`): tags, `h1` (max 22ch, 3 lines), meta row (author, `<time>`, reading time; `Share2` button right); cover image full container width 21:9 (tablet 16:10) under the header with `caption`; body: 12-col, prose cols 3-9 (max 720), sticky table of contents cols 10-12 (appears when >= 3 `h2`: `eyebrow` "On this page", links `small`, active item left bar `#2F447D`); mobile: TOC collapses into an accordion above the body. After body: related products (3 compact cards), related posts (3 `PostCard`), `ctaBanner`. Article typography: `body-lg` 18/30, h2 `h3` token.

### 7.11 FAQ `/faq`
`PageHeader` "Frequently Asked Questions" + intro; filter input (44px, `Search`) top-right (hidden without JS). Body (bg `#FFFFFF`, `lg`): 12-col; left cols 1-3 sticky group index (links with counts; active left bar `#2F447D`), right cols 4-11 accordion groups: group title `h2` 34/38 with 2px `#111827` top rule, items per 6.11. Mobile: group index becomes horizontally scrollable chips. End: `ctaBanner` "Didn't find your answer?" **(proposed)** -> Contact.

### 7.12 Generic page `/[slug]`
`default`: `PageHeader` + `Prose` in `.container-prose` (720) centred on cols 3-10, then optional sections via the registry. `legal`: `PageHeader` with "Last updated {date}" meta; two-column: sticky auto TOC cols 1-3 (`small`), prose cols 4-10; section numbering in h2 ("1. ...") via CSS counters in Afacad 600 `#2F447D`; print stylesheet removes header/footer. `landing`: sections only; first section is hero-like `PageHeader` variant on navy.

### 7.13 Search `/search?q=`
`PageHeader` compact (padding 32): `h1` "Search" (visually `h2` size 34/38), large search input (56px, full container up to 720) autofocus when empty. Result summary "{n} results for '{q}'" `small`. Chips (All, Products, Brands, Services, News) with counts. Results: list rows (not cards): 80px thumbnail (4:3, `ImagePlaceholder` on missing) + type label (`eyebrow` 12px caps `#4B5563` with a type icon) + title `h4` with highlighted match (`mark` bg `#E0E7FF`, text `#111827`, no italic) + snippet `small` clamp 2 lines + URL path `caption` `#6B7280`; row divider hairline; hover bg `#FFFFFF`. Pagination. Empty: "No results for '{q}'" + suggestions (4 featured product `ProductCard` compact) + contact link.

### 7.14 404 `not-found`
Bg `#F8F9FA`, centred layout (permitted exception): large concentric ring field (4 rings, stroke `#DDE3F1`, diameter up to 640px) centred behind the content, in the ring mark's centre the figure "404" in `display` size Afacad 700 `#2F447D` replacing the dot area; below: `h1` "Page not found" (34px), `lead` "The page may have moved or never existed. Try search, or go to one of these sections." **(proposed)**; search input 56px width 480; link row: Home, Products, Brands, Contact (`outline` `md`); below: "Popular products" 4 compact cards (hidden if API unavailable). Mobile: ring field scaled to 320px, 404 at 80px. HTTP 404.

### 7.15 Thank you `/thank-you`
Bg `#F8F9FA`, centred (exception): check-circle ring (64px open ring stroke `#15803D`, check inside), `h1` "Thank you. Your message has been sent." **(proposed)**, `lead` "We usually reply within one business day. For urgent requests call +251 911 514558." **(proposed; replace "one business day" with an approved SLA before launch)**, buttons `primary` "Back to home", `outline` "Browse products". Noindex.

### 7.16 Cross-page details that make it feel designed (checklist for implementers)
1. Eyebrow with burgundy tick above every `h2`/`h1`.
2. Oversized stroke numerals on About, Home services, Services list.
3. Spec-sheet tables (2px top rule, caps labels, tabular numerals) on product, brand facts, subsidiaries.
4. Product plates (solid offset block) on product images only.
5. Ring field (max one per two sections), ring bullets in lists, ring spinner and ring placeholder.
6. Hairline-divided stat strips instead of boxed stat cards.
7. Real brand names in `white-space: nowrap`, countries as text badges with burgundy tick.
8. Navy/light alternation with the footer seam rule.

---

## 8. Admin CMS visual design

Principle: the admin shares the public tokens (same colours, fonts, radius, focus ring) but is a calm, dense work tool: smaller type, tighter spacing, no hero imagery, no decorative motifs (no ring fields, no index numerals, no plates). The ring mark appears only in the sidebar logo, the login card and the spinner.

### 8.1 Tokens and density
- Base font size 14px (Roboto 400, line-height 20px); headings Afacad Flux: page title 24/30 weight 700, section title 18/24 weight 600, card title 16/22 weight 600. Table text 14/20; meta 12/16.
- Spacing steps used: 4, 8, 12, 16, 24 (never 48+). Page padding 24 (mobile 16). Card padding 16 (dense) / 24 (forms).
- Controls: height 36 (default), 32 (compact table filters), 44 on touch devices (< 1024). Radius 4. Inputs border `#878F9D`.
- Row heights: table rows 40 (density "Compact" 32, "Comfortable" 48), user toggle persisted in `localStorage` (default 40).
- Colours: canvas `#F8F9FA`, cards `#FFFFFF` with 1px `#E5E7EB` border, no shadow (popovers/dialogs use shadows). Admin dark mode (`.dark`): canvas `#0B1220`, cards `#111827`, border `rgba(255,255,255,0.12)`.

### 8.2 Shell (`AdminShell`)
- **Sidebar**: width 248px expanded, 64px collapsed (icon-only with tooltips); bg `#111827` in both themes; logo block 64px high (mark 28px + "Admin" label `small` `#9CA3AF`); group labels `eyebrow`-style 11px caps `#9CA3AF`, 12px padding; item height 36, radius 4, icon 18 stroke 1.5 `#9CA3AF`, text 14px `#D1D5DB`; hover bg `#1F2937` text white; **active**: bg `#1F2937`, text white, 3px left bar `#60A5FA`, icon `#60A5FA`. Badges (unread messages) `count` badge on the navy sidebar uses bg `#D08A90` text `#0B1220` (6.88 contrast). Footer of sidebar: user avatar + name + "Sign out". Groups per plan 8.1 (Overview, Content, Media, Inbox, Site, System).
- **Topbar**: height 52, bg `#FFFFFF` (dark: `#111827`), bottom hairline; left: sidebar toggle (icon-sm) + breadcrumb (`small`); centre-left: command trigger (`Search` + "Go to..." + `kbd` Ctrl K, width 320, height 32, border `#D1D5DB`); right: "View site" `ghost sm` with `ArrowUpRight`, bell/unread count (icon-sm with `count` badge), theme toggle (`Sun/Moon`), user menu.
- Content area: max-width none for lists; forms max 1200 (main column + 320 sidebar).
- Mobile (< 1024): sidebar becomes a `sheet`; topbar 52 with menu button, title, user menu; tables become card-lists (see 8.4).

### 8.3 Dashboard
12-col grid, gap 16. Row 1: 4 `StatCard`s (Published products, brands, services, posts) then Unread messages as an emphasised card (left 3px `#843C40` bar). StatCard: bg white, border, padding 16, label `small` `#4B5563`, value Afacad 700 32/36 `#111827` (tabular), delta chip (`+3 this week`) `status` style, optional sparkline (40px, stroke `--chart-1`, no fill). Row 2: Messages chart (bar, last 30 days; cols 1-8) with Recharts via shadcn `chart`: bars `--chart-1`, grid lines `#E5E7EB`, axis `#6B7280` 12px, tooltip card style; cols 9-12 "Needs attention" checklist (missing SEO, missing alt text, broken YouTube links, 404 hits) each row with `AlertTriangle 16` `#B45309` + count + link. Row 3: Recent messages (5 rows, unread bold + `#843C40` dot), Content status table, Recently edited, Scheduled. Quick actions as a row of `outline sm` buttons under the page title (New product, New post, Upload media, Edit homepage, Revalidate cache). Per-widget skeleton/error (6.18 compact variant, icon 20, text `small`).

### 8.4 Data tables (`DataTable`)
- Header row: height 40, bg `#F1F3F5`, `table-head` 12px caps `#4B5563`, sticky under the topbar (`top: 52`), sortable columns show `ArrowUp/Down 14`; border-bottom 1px `#D1D5DB`.
- Rows: bg white, hover `#F8F9FA`, selected `#EEF1F8` with 2px left bar `#2F447D`, border-bottom `#E5E7EB`. Checkbox column 40px. Title column: link 14px 500 `#111827` + slug `caption` `#6B7280` below. Thumbnails 40x30 radius 2 with `ImagePlaceholder` (compact: ring only).
- Status chips per 6.4 (`status-*`). SEO score dot 10px (green `#15803D`, amber `#B45309`, red `#B91C1C`) always with `title`/`aria-label` text.
- Toolbar above table: search (width 280, 36), filter selects, status tabs as underline tabs (6.10 at height 40), column visibility, density toggle. Bulk bar replaces toolbar when rows are selected: bg `#111827` text white, radius 4, height 48, actions as `ghost` white buttons, "n selected" count.
- Pagination bottom: "Rows per page 25" select, range text, prev/next icon buttons.
- Mobile: each row becomes a 2-line list item (thumbnail, title, status chip, kebab menu); filters in a `drawer`.
- Empty: `StatusEmpty` compact ("No products found" + "Add your first product"); Error: retry.

### 8.5 Forms (`EntityFormScreen`)
- Layout: sticky `PublishBar` (height 56, bg white, bottom hairline, z 30): left: back arrow + entity title (`h1` 20/26 truncated) + `StatusBadge` + "Saved 2 min ago" `caption`; right: `ghost` History, `outline` Preview, `outline` Save draft, `primary` Publish (or Update), kebab (Duplicate, Archive, Delete). Dirty indicator: 8px `#B45309` dot + "Unsaved changes" `caption`; autosave: "Draft autosaved" fades after 3s.
- Two columns >= 1280: main (cols 1-8, white card sections separated by 16px) and a 320px aside (status, slug, featured, sort order, dates) sticky at top 72. Tabs (Content | Media | Details | SEO | Relations) underline style under the PublishBar, sticky.
- Field groups: card with title `h3` 16/22, description `small` `#4B5563`, 16px gaps between fields, labels 14px 500. Two-column field rows for short fields. Repeaters (`RepeaterField`): each row a bordered `#E5E7EB` strip with drag handle (`GripVertical 16` `#6B7280`), fields, delete `icon-sm ghost` (`Trash2`); "Add {item}" `outline sm` with `Plus`. Counters on length-limited fields (`caption`, turn `#B45309` beyond 90%, `#B91C1C` over).
- Slug field: prefix chip `/products/` `#F1F3F5` + input + lock/unlock icon; URL preview below `caption`.
- Validation messages as in 6 (global error state). Form-level error alert at top (shadcn `alert`, danger tokens, `AlertCircle`).
- Concurrency/unsaved dialogs use `alert-dialog` (6.15).

### 8.6 Rich text editor (`RichTextEditor`, Tiptap)
Bordered container (1px `#878F9D`, radius 4, focus ring as inputs). Toolbar (height 44, bg `#F8F9FA`, bottom hairline, sticky within the field when taller than viewport): groups separated by 1px dividers: Heading select (Paragraph/H2/H3/H4), Bold, Italic, Link, Bullet list, Numbered list, Quote, Table, Image (opens media picker), YouTube, Horizontal rule | right: "Visual / Source" `toggle-group`, word count `caption`. Toolbar buttons 32x32 icon `ghost`, active state bg `#DDE3F1` text `#25376A`. Editing surface uses the same `.prose` styles as the public site at 16px (WYSIWYG fidelity), min-height 320, padding 16. Source tab: no monospace face is introduced; use Roboto 14px in a textarea with `#F8F9FA` bg.

### 8.7 Media library
Left folder tree (width 240, bg `#FFFFFF`, border-right; selected folder bg `#EEF1F8` + 3px left bar; count `caption`), main area: toolbar (search, type filter, sort, view toggle `toggle-group`, Upload `primary sm`), drag-drop overlay: whole page dashed 2px `#2F447D` border, bg `rgba(47,68,125,0.06)`, centred text "Drop files to upload". Grid cards: 4:3 thumbnails (min 180px) on `#F1F3F5` with `ImagePlaceholder` for non-images (file-type icon + extension caps), filename `small` truncated, dimensions/size `caption`; hover shows select checkbox top-left and "Needs alt" `warning` chip top-right when alt missing. Selected: 2px `#2F447D` border. Detail drawer (sheet right, 420px): preview on checker-free `#F1F3F5`, form fields, usage list (links), crop/focal point tool: preview with a draggable 20px ring marker (open ring + dot) for the focal point and aspect preset `toggle-group` (1:1, 4:3, 16:9, 1.91:1) with overlay frame `rgba(17,24,39,0.5)` outside the crop. `UploadQueue`: fixed bottom-right panel 360 wide, rows with 4px progress bar (`#2F447D`), cancel/retry icons, success check `#15803D`.

### 8.8 Homepage builder
Two-panel: left (width 360) ordered section list: each row 56px, bg white, border, radius 4, drag handle, section icon (Lucide per registry) 20, label `small` 500, type `caption` `#6B7280`, `switch` (enabled), kebab; active row bg `#EEF1F8` + 3px left bar `#2F447D`; dragging: `shadow-md`, 2px dashed drop line `#2F447D`. Right: editor form for selected section (card, 8.5 styles) with a header (icon + name + "Reset section"). Optional bottom preview thumbnail: low-fidelity wireframe of the section (grey bars) - no live render. "Add section" dialog: 2-column grid of registry types, each a bordered tile with icon, label, one-line description, `allowedOn` caption; keyboard selectable. Top bar actions per plan 8.7.

### 8.9 Navigation editor
Tree rows with indent 24 per level, connector line 1px `#D1D5DB`, drag handle, label input inline, type `select` compact, visibility `switch`, "Add child" `ghost sm`. Mega item rows show a `Layers` icon and `megaSource` select. Right pane: live preview card: `MegaMenu` + `MobileNav` miniatures at 50% scale inside a framed `#F1F3F5` viewport (non-interactive). Broken target rows get a `danger` chip "Target missing".

### 8.10 SEO panel and SERP preview
`SeoPanel`: collapsible card; inputs with live counters and a coloured length bar (4px, grey -> green within ideal range `#15803D`, amber `#B45309` out of range, red `#B91C1C` over cap). **SERP preview** (white card, border, padding 16, desktop/mobile `toggle-group`): breadcrumb line (favicon 16 + site name + path) in 12px `#4B5563`, title 20/26 Roboto `#2F447D` (never a purple link colour), URL line `#4B5563`; description 14/22 `#4B5563`, truncated at 600px title width / 920px description with ellipsis (desktop), 360px mobile. **Social preview** card: 1.91:1 image placeholder (`ImagePlaceholder`), domain `caption` caps, title `h5`, description 2 lines, in a 1px bordered box. **Score**: 0-100 ring gauge 56px (stroke 6px: red <50 `#B91C1C`, amber 50-79 `#B45309`, green >= 80 `#15803D`) with the number centred; checklist rows with icons `CheckCircle2` (green), `AlertTriangle` (amber), `XCircle` (red) + rule text + fix hint in `caption`. Never colour alone: icon and text always present.

### 8.11 Status chips (admin)
See 6.4 status variants. Message statuses: `new` (burgundy-tint), `read` (neutral), `in_progress` (info), `replied` (success), `archived` (neutral outlined), `spam` (danger outlined). Publish state in `PublishBar` uses the same chip, 28px high.

### 8.12 Messages inbox
Two panes >= 1024: list 400px (rows 72px: unread dot 8px `#843C40`, sender 14px 600, time `caption` right, subject 14px, preview 13px `#4B5563` 1 line, product chip `tag`), detail flexible: header (name, email `mailto`, phone `tel`, received `caption`), status select, message body in `body` 16/26 `#111827` preserving line breaks in a white card with padding 24, metadata `dl` in `small`, internal notes textarea, actions row. Empty detail: centred "Select a message / Choose a message from the list to view details" (live copy). Selected row bg `#EEF1F8` + left bar. Mobile: list then full-screen detail with back button.

### 8.13 Auth screens
Centred card (width 400, padding 32, radius 6, border, `shadow-md`) on `#F8F9FA`; logo mark 40px above `h1` "Baraton Login" (Afacad 700 28/32), form fields 44px, `primary` full width `lg`; "Forgot Password?" `link`; error alert above fields; OTP step uses 6 boxes 48x56 with 1px `#878F9D`, radius 4. Footer line `caption` `#6B7280`. Background: plain; optional 1px grid pattern at 3% (technical-grid motif) is NOT used.

### 8.14 Empty / error / loading states
Empty tables and lists: 32px icon, `h4`, `small` description, `primary sm` action ("Add your first product"). Error: `AlertTriangle`, message, "Try again". Loading: skeleton rows matching row height; buttons show spinner; page-level top loader 2px. 403/404 inside admin: same compact status component.

### 8.15 Sharing tokens with the public site
Same CSS variables (`:root`), same fonts via `next/font`, same shadcn components with the same variants. Differences are only: base size 14, control height 36, no motifs, sidebar navy in both themes, `.dark` allowed (admin only), no public-only effects (plates, ring fields, reveal-on-scroll, header condense). `AdminShell` sets `data-admin` on `<body>` so density tokens (`--control-h: 36px`, `--text-base: 14px`) apply.

---

## 9. Responsive and accessibility rules

### 9.1 Responsive
- Mobile-first CSS; layouts defined at 390, 768, 1024, 1280, 1440. No horizontal page scroll at any width >= 320. Content reflows at 320 with no loss; text scales to 200% without clipping.
- Breakpoint behaviour summary: nav collapses < 1024; two-column blocks stack < 768 (< 1024 for product detail); grids 1/2/3 columns at <640 / 640-1023 / >= 1024; tables stack < 640.
- Images use `sizes` matching the grid (e.g. product card `(min-width:1024px) 384px, (min-width:640px) 50vw, 100vw`).
- Safe areas: bottom sticky bars add `env(safe-area-inset-bottom)`.

### 9.2 Tap targets and spacing
Minimum 44x44 CSS px on the public site (WCAG 2.2 target size AA minimum is 24x24; this spec uses 44 as the standard); minimum 8px between adjacent targets. Admin: 36px on desktop, 44px under 1024. Inline text links in prose are exempt but have 3px offset underline and >= 24px line pitch.

### 9.3 Focus
All interactive elements show the 2px focus ring (light `#0D5380`, navy `#60A5FA`, offset 2px). Order follows DOM = visual order. Skip link first focusable. Focus returns to the trigger after dialogs/sheets/menus close. On route change focus moves to the page `h1` (`tabIndex=-1`). Carousel: arrow keys within; autoplay pauses on focus.

### 9.4 Colour-blind safety and non-colour cues
Status always has icon + text. Charts: series differ in lightness and use direct labels/patterns (dash styles) in addition to colour; chart-1 (indigo) and chart-3 (burgundy) have similar luminance, so line series add distinct marker shapes and dash patterns and never rely on those two colours alone. Links in text are underlined. Form errors have icon + message. Selected states use bar + background (not colour only). Do not rely on red/green alone for pass/fail: use `CheckCircle2`/`XCircle` icons.

### 9.5 Reduced motion and other preferences
`prefers-reduced-motion: reduce`: see 5.1. `prefers-contrast: more`: `--border` becomes `#6B7280`, text-tertiary becomes `#374151`, focus ring 3px. `forced-colors: active`: rely on system colours; keep borders on buttons (`border: 1px solid ButtonText`), SVG icons use `currentColor`. `prefers-color-scheme` is not auto-applied on the public site.

### 9.6 Semantics (design-relevant)
One `h1`; headings never skipped; landmarks per plan 5.9; every icon-only button has `aria-label`; decorative rings/numerals/crosses `aria-hidden="true"`; marquee duplicate track `aria-hidden` and non-focusable (`inert`); status messages (`aria-live="polite"`) for filter result counts and form success; error summary `role="alert"`. Language attribute on foreign-language snippets when added.

### 9.7 Ethiopic / Amharic / RTL readiness
- Ethiopic script reads left-to-right (no RTL needed for Amharic). The system must still be written with logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline-start`, `text-align: start`) so an RTL locale (e.g. Arabic) can be added without rewrites; use `dir` on `<html>` from locale settings.
- Font: when `lang="am"` (or `lang="ti"`), body and headings stack: `var(--font-ethiopic), "Noto Sans Ethiopic", "Nyala", sans-serif`. Noto Sans Ethiopic subset `ethiopic` only; weights 400/600/700 mapped from 400/500/600/700 (500 -> 400... keep 600 for headings).
- Metrics: Ethiopic glyphs are taller; apply +0.1 line-height (`body` 1.75, headings 1.3) and remove negative letter-spacing and uppercase transforms when `lang` is `am`; allow +25% width in buttons/nav (never fixed widths); mark `eyebrow` text as sentence case in `am`.
- Layouts must tolerate 30-40% longer strings (nav, buttons, badges wrap to two lines gracefully; badge min-width not max-width).
- Numerals: Latin digits for phone numbers and dates; Ethiopic numerals not used.

---

## 10. Design-to-code handoff

### 10.1 shadcn components to customize (and how)

All shadcn components live in `components/ui`. Customize only via tokens (`globals.css`) and the `cva` variant definitions below (edit the generated file's `cva` config; do not fork logic). Keep Radix behaviour.

| Component | Customization |
|---|---|
| `button` | `cva` variants: `primary` (new default, replaces shadcn `default`), `dark`, `secondary`, `outline`, `ghost`, `accent`, `link`, `destructive`; sizes `sm`/`md`/`lg`/`icon`/`icon-sm` per 6.1; base classes `rounded font-display font-semibold tracking-[0.01em] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`; add `loading` prop (spinner, `aria-busy`); add `navy` handled automatically via `.section-navy` tokens (variants use token colours `bg-primary`, not hex). |
| `badge` | variants `country`, `agent`, `tag`, `count`, `status-published|draft|scheduled|archived|new|read|in_progress|replied|spam`; radius 2px; uppercase variants set `tracking-[0.06em] text-xs uppercase`. |
| `card` | no shadow, `rounded-none`, border `border-border`; add `interactive` variant (hover `shadow-sm border-indigo-200`, stretched-link support) and `plate` variant (offset device). |
| `input`, `textarea`, `select` | height `h-11` (public) / `h-9` under `[data-admin]`, `border-input`, `rounded`, focus `border-ring ring-2 ring-ring`, error via `aria-invalid:border-destructive aria-invalid:ring-destructive`. |
| `checkbox`, `radio-group`, `switch` | sizes and colours per 6.3 using `bg-primary` for checked. |
| `label` | `text-sm font-medium`. |
| `navigation-menu` | header nav + mega panel per 6.6; viewport `shadow-md`, `rounded-none`, width container. |
| `sheet` | mobile nav (right, `w-[min(92vw,400px)]`), admin sidebar (left), filters. |
| `command` | search palette per 6.6; selected item bar. |
| `dialog`, `alert-dialog`, `drawer` | radius 6, overlay `bg-[rgba(11,18,32,0.6)]`, `shadow-lg`. |
| `tabs` | underline variant (6.10) as default; `TabsList` no background. |
| `accordion` | per 6.11 (border rows, chevron indigo). |
| `table` | spec table + generic + admin styles via variants `spec`, `default`, `admin`. |
| `breadcrumb` | per 6.9. |
| `pagination` | per 6.13, anchor-based. |
| `carousel` | Embla; hero uses custom controls; arrows are `icon` `outline` buttons 44px at edges on desktop, hidden on touch. |
| `sonner` | per 6.14 (`toastOptions.classNames`). |
| `skeleton` | static `bg-border` with `animate-pulse` replaced by custom keyframe `skeleton-pulse` (opacity 1 -> .6, 1.4s). |
| `tooltip`, `popover`, `dropdown-menu`, `select` content | `rounded`, `shadow-md`, `border-border`, item height 40. |
| `sidebar` | tokens `--sidebar-*`; width 248 / 64; active bar via `data-[active=true]:before:` 3px `bg-sidebar-primary`. |
| `chart` | colours from `--chart-1..5`, grid `stroke-border`. |
| `form` | label/description/message styles from 6.3. |
| `calendar`, `slider`, `progress`, `toggle`, `toggle-group`, `input-otp`, `scroll-area`, `separator`, `skeleton`, `avatar`, `aspect-ratio`, `collapsible`, `hover-card`, `alert` | token-driven; `alert` variants `info|success|warning|destructive` use semantic token pairs (2.6). |
New project components (not shadcn): `ImagePlaceholder`, `RingMark`, `RingDivider`, `RingField`, `Eyebrow`, `SectionIndex`, `StatItem`, `SpecTable`, `FactTile`, `ProductPlate`, `Kbd`, `Callout`.

### 10.2 Tailwind theme extension (spec; Tailwind 4 `@theme`)

```css
@theme inline {
  /* colour roles -> shadcn tokens */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);  --color-chart-4: var(--chart-4);  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-link: var(--link);  --color-sky: var(--sky);  --color-mist: var(--mist);
  --color-success: var(--success);  --color-warning: var(--warning);
  --color-danger: var(--danger);    --color-info: var(--info);

  /* fixed palette scales (literal hex; use sparingly, prefer role tokens) */
  --color-indigo-50:#EEF1F8; --color-indigo-100:#DDE3F1; --color-indigo-200:#BCC8E2; --color-indigo-300:#92A3CD;
  --color-indigo-400:#6479B0; --color-indigo-500:#475E98; --color-indigo-600:#3A5188; --color-indigo-700:#2F447D;
  --color-indigo-800:#25376A; --color-indigo-900:#1B2A52; --color-indigo-950:#111B38;
  --color-steel-50:#EDF6FB; --color-steel-100:#D5E9F5; --color-steel-200:#AAD2EA; --color-steel-300:#74B3DB;
  --color-steel-400:#3C8DC1; --color-steel-500:#1B6FA3; --color-steel-600:#0D5380; --color-steel-700:#0B4469;
  --color-steel-800:#0A3652; --color-steel-900:#082A40;
  --color-burgundy-50:#FBF1F2; --color-burgundy-100:#F4DDDF; --color-burgundy-200:#E6B8BC; --color-burgundy-300:#D08A90;
  --color-burgundy-400:#B35A62; --color-burgundy-500:#9A454D; --color-burgundy-600:#843C40; --color-burgundy-700:#6D3034;
  --color-burgundy-800:#572628; --color-burgundy-900:#3F1C1E;
  --color-slate-50:#F8F9FA; --color-slate-100:#F1F3F5; --color-slate-200:#E5E7EB; --color-slate-300:#D1D5DB;
  --color-slate-400:#9CA3AF; --color-slate-500:#6B7280; --color-slate-600:#4B5563; --color-slate-700:#374151;
  --color-slate-800:#1F2937; --color-slate-900:#111827; --color-slate-950:#0B1220;

  /* fonts */
  --font-display: var(--font-display), "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
  --font-sans: var(--font-sans), system-ui, -apple-system, "Segoe UI", Arial, sans-serif;

  /* breakpoints */
  --breakpoint-sm: 40rem; --breakpoint-md: 48rem; --breakpoint-lg: 64rem; --breakpoint-xl: 80rem; --breakpoint-2xl: 96rem;

  /* radius */
  --radius-none: 0; --radius-sm: 2px; --radius: 4px; --radius-md: 6px; --radius-lg: 6px; --radius-full: 9999px;

  /* spacing base 4px: Tailwind default --spacing: 0.25rem (do not change) */

  /* shadows */
  --shadow-xs: 0 1px 2px rgba(17,24,39,0.06);
  --shadow-sm: 0 1px 3px rgba(17,24,39,0.08), 0 1px 2px rgba(17,24,39,0.04);
  --shadow-md: 0 4px 12px rgba(17,24,39,0.08);
  --shadow-lg: 0 12px 32px rgba(17,24,39,0.12);
  --shadow-header: 0 1px 0 rgba(17,24,39,0.08);

  /* font sizes: [size, line-height, letter-spacing] per 3.2 desktop values; responsive via utility classes below */
  --text-display: 4.5rem;   --text-display--line-height: 1;        --text-display--letter-spacing: -0.02em;
  --text-h1: 3.25rem;       --text-h1--line-height: 1.077;         --text-h1--letter-spacing: -0.015em;
  --text-h2: 2.5rem;        --text-h2--line-height: 1.1;           --text-h2--letter-spacing: -0.01em;
  --text-h3: 1.75rem;       --text-h3--line-height: 1.214;
  --text-h4: 1.375rem;      --text-h4--line-height: 1.273;
  --text-h5: 1.125rem;      --text-h5--line-height: 1.333;
  --text-lead: 1.25rem;     --text-lead--line-height: 1.6;
  --text-body-lg: 1.125rem; --text-body-lg--line-height: 1.667;
  --text-body: 1rem;        --text-body--line-height: 1.625;
  --text-small: 0.875rem;   --text-small--line-height: 1.571;
  --text-caption: 0.75rem;  --text-caption--line-height: 1.5;
  --text-eyebrow: 0.8125rem; --text-eyebrow--line-height: 1.231;   --text-eyebrow--letter-spacing: 0.14em;
  --text-stat: 4rem;        --text-stat--line-height: 1;           --text-stat--letter-spacing: -0.02em;

  /* motion */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* keyframes */
  --animate-marquee: marquee 40s linear infinite;
  --animate-marquee-slow: marquee 60s linear infinite;
  --animate-reveal: reveal 400ms var(--ease-out) both;
  --animate-fade-in: fade-in 150ms var(--ease-out) both;
  --animate-spin-ring: spin 1s linear infinite;
  --animate-skeleton: skeleton-pulse 1.4s ease-in-out infinite;
  --animate-progress: progress var(--autoplay, 6000ms) linear forwards;
  @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
  @keyframes reveal { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
  @keyframes skeleton-pulse { 0%,100% { opacity: 1 } 50% { opacity: .6 } }
  @keyframes progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }
}
```
Responsive type utilities (add as `@utility` or component classes; values from 3.2): `.t-display` = `clamp(40px, 5vw + 8px, 72px)`/1.0; `.t-h1` = `clamp(34px, 3.2vw + 12px, 52px)`; `.t-h2` = 28px (<640) / 34px (640-1023) / 40px (>=1024); `.t-h3` = 22 / 26 / 28; `.t-lead` = 18 / 19 / 20. Heading elements get `font-display`, `text-wrap: balance`, colour `foreground` via base layer.
Container utilities: `.container-site`, `.container-prose`, `.container-wide` per 4.2.
Section spacing utilities: `.section-lg`, `.section-md`, `.section-sm` per 4.3 (responsive padding-block).

### 10.3 Naming conventions
- Tokens: CSS variables kebab-case without prefix for shadcn roles (`--primary`), `--brand-*`, `--surface-*`, `--text-*`. Tailwind usage prefers role tokens (`bg-primary`, `text-muted-foreground`, `border-border`); raw palette utilities (`bg-indigo-700`) only inside token definitions, the logo/graphic devices and the navy hero overlays.
- Components: PascalCase files (per plan 3.1); variants via `cva` named `xxxVariants`; sections `XxxSection`; props follow the plan's block contracts exactly.
- CSS classes for utilities/devices: `section-navy`, `section-footer`, `plate`, `ring-field`, `ring-bullet`, `eyebrow`, `spec-table`, `t-*` type utilities.
- Data attributes: `data-reveal`, `data-theme` (none on the public site), `data-admin` on admin body, `data-state` (Radix).
- Test ids: `data-testid="section-{type}"`, `hero-index-{n}`, `product-card-{slug}`.
- Icon names: Lucide import names exactly; one central `icons.ts` re-export for sizing helper `Icon size={16|20|24|32}` with stroke 1.5.

### 10.4 Asset list to produce
| Asset | Spec |
|---|---|
| `logo-full.svg` | vectorised from `docs/source/logo.png`; ring `#2F447D`, dot `#843C40`, "BARATON" `#2F447D`, "GROUP CO." `#843C40`; transparent bg; viewBox tight to clear space |
| `logo-full-white.svg` | all `#FFFFFF`, dot `#D08A90` |
| `logo-mark.svg`, `logo-mark-white.svg` | ring + dot only, square viewBox 0 0 100 100 |
| Favicon set | `favicon.ico` (16/32/48), `icon.svg` (mark; dot stays burgundy; ring `#2F447D`; `prefers-color-scheme: dark` variant ring `#FFFFFF`), `favicon-32x32.png`, `apple-touch-icon.png` 180x180 (mark on `#FFFFFF`, 20% padding), `android-chrome-192x192.png`, `512x512.png`, `maskable-512.png` (white ring mark on `#111827`, safe zone 80%), `site.webmanifest` `theme_color` `#2F447D`, `background_color` `#F8F9FA`; `safari-pinned-tab.svg` monochrome |
| OG image template (1200x630) | bg `#111B38`, ring field `rgba(255,255,255,0.08)` right, left column: `logo-full-white`, eyebrow caps (type/country) `#D08A90`, title Afacad Flux 700 64/68 white max 2 lines, bottom row site name + domain `#9CA3AF` 24px, optional cover image on the right half with scrim; default variant (no entity): tagline from settings |
| Placeholder artwork | `/placeholders/product.svg`, `logo.svg`, `generic.svg`: ring-mark placeholder per 4.7 in light and navy variants (`*-dark.svg`) at 1200x900 / 900x600 |
| Ring pattern SVGs | `ring-field.svg` (3-4 concentric open rings, stroke 1px, `currentColor`), `ring-bullet.svg`, `ring-spinner.svg` |
| Social icons | inline SVGs for Facebook, X, LinkedIn, Instagram, YouTube, TikTok, Telegram, WhatsApp (20px, `currentColor`) |
| Hero fallback | no stock image is shipped; fallback is a solid `#111B38` with the ring field |
| Fonts | loaded via `next/font/google` (no self-hosted files except OG `ImageResponse` TTFs: Afacad Flux 700 and Roboto 400/500 in `public/fonts`) |

### 10.5 Visual QA checklist (numbered, verifiable)

Tokens and global
1. `globals.css` defines every token in 2.6 with exactly those hex values; DevTools shows `--primary` = `#2F447D` on `:root` and `#FFFFFF` inside `.section-navy`.
2. Page background computes to `rgb(248,249,250)`; default text colour `rgb(17,24,39)`; body text colour in prose `rgb(55,65,81)`.
3. Only two Latin font families load (Network tab: Afacad Flux + Roboto); `h1`-`h6`, nav, buttons are Afacad Flux; body, inputs, tables are Roboto; no layout shift on font swap (CLS < 0.02).
4. Type scale: at 1440 `h1` computes to 52px/56px weight 700; `display` 72/72; body 16/26; at 390 `h1` 34/38, `display` 40/42.
5. No `border-radius` above 6px exists in the DOM except avatars, dots, switch thumb and social circle buttons (run a computed-style audit).
6. No gradients anywhere except the navy scrim over hero/CTA photographs (search CSS for `gradient`: only 4.7 values); no purple/pink/violet hex in the built CSS (grep for hue 250-330 shades other than indigo `#2F447D` family).
7. `backdrop-filter` is used only on the condensed header.
8. Contrast: all text/background pairs on the page are in 2.3 or have >= 4.5:1 (run axe `color-contrast` on every template: zero violations).

Layout
9. Container is 1280 outer / 1200 content at >= 1280; side margins 40 (>= 1024), 32 (640-1023), 16 (< 640); header, page content and footer left edges align exactly.
10. Section padding matches 4.3 (lg 96/72/56) at 1440/768/390; no section uses an off-scale value.
11. Light and navy sections alternate; the CTA banner and footer are separated by a visible seam (`#0B1220` footer vs `#111827` CTA plus 1px hairline).

Header/footer
12. Desktop header: utility bar 40px (`#111827`), main bar 80px white with logo 44px, nav 16px Afacad 500, search trigger, dark "Let's Talk" button 44px high; active nav item has 2px burgundy underline.
13. After scrolling 24px the utility bar collapses, bar becomes 64px, logo 36px, blur applied; with JS disabled the header is the expanded state and still sticky.
14. Products mega-menu opens on hover-intent 120ms, shows Categories / Brands / Featured; closes with Esc; fully keyboard operable.
15. Mobile header 64px; sheet nav shows search, 56px rows, sticky navy bottom block with CTA and phone links.
16. Footer: 4 columns (4/2/3/3 on the grid), navy `#0B1220`, arrows `#60A5FA`, legal row with "Developed by Dagim Meseret" (no gradient, no "xyberlabs"), copyright "© {year} Baraton Group Co. All rights reserved."

Components
17. Primary button: 44px high, `#2F447D`, hover `#3A5188`, 2px `#0D5380` focus ring with 2px offset; all buttons have 4px radius; `accent` burgundy appears at most once per page.
18. Inputs 44px high with `#878F9D` border, 16px text; error state shows red border, icon and message; focus shows ring.
19. Country badges are text-only with a burgundy tick, no flags/emoji.
20. Product card: 4:3 image on white with a 12px `#E5E7EB` offset plate, country badge top-left, share top-right, title Afacad 600 22/28, 3-line clamp description, link with arrow; no shadow at rest.
21. Spec table has a 2px `#111827` top rule, caps group headers, tabular numerals, stacked rows on mobile.
22. Missing images always render the ring-mark placeholder (test by blocking the media host): no broken image icon anywhere.
23. Dialogs/sheets/toasts follow 6.14-6.15; toasts never overlap the cookie banner.

Pages
24. Home: hero shows the persistent `h1` headline, product index rail (01-08) with progress line, facts strip of 5 items; carousel pauses on hover/focus and stops under reduced motion; only one `h1` on the page.
25. Home sections appear in the order of 7.1; empty-data sections are skipped; services use navy panels with index numerals; videos use 1 large + list layout.
26. About: sticky sub-nav highlights the section in view; CEO block is navy with a portrait on a plate; subsidiaries are full-width ledger rows with anchors `#baraton-trade-llc` and `#baraton-trade-plc`.
27. Products list: sticky toolbar, 3/2/1 column grid, plates not clipped, pagination uses anchors, filtered URLs preserved on page change.
28. Product detail: gallery + summary split 7/5 at 1440, single column at 768/390; burgundy "Request a quote"; tabs (accordion on mobile) all present in the DOM; mobile sticky action bar present.
29. Brands list shows the Official agents band first; brand detail hides empty sections (video, products).
30. Services list uses ledger rows; detail shows numbered "What is included" ledger and process track.
31. Contact: navy info panel + white form panel, three icon rows, socials, product chip prefill from `?product=`, success state, map facade then iframe on click; on mobile form first.
32. News detail: 720px reading column, sticky TOC at >= 1024 when >= 3 `h2`.
33. FAQ: accordion groups with 2px top rules and a sticky group index; 404/thank-you are the only centred layouts.
34. Search: result rows with highlighted match (`mark` `#E0E7FF`), type labels, empty suggestions.

Motion and accessibility
35. With `prefers-reduced-motion: reduce`: no marquee animation (static grid), no counter animation, no carousel autoplay, no reveal/fade, transitions < 10ms.
36. Every interactive element is reachable and visibly focused by keyboard; skip link works; focus moves to `h1` on navigation; no focus trap leaks.
37. All tap targets >= 44x44 on mobile (audit); no horizontal scroll at 320px.
38. axe-core: zero serious/critical violations on every public template at 390 and 1440; Lighthouse Accessibility >= 95.
39. Heading order has no skipped levels on any page; each page has exactly one `h1`.

Admin
40. Sidebar 248px `#111827`, active item bar `#60A5FA`; topbar 52px; table rows 40px; base text 14px; controls 36px high; no ring motifs in the admin except logo and spinner.
41. Status chips use icon/dot + text; SEO score uses gauge + icon + text; unsaved indicator visible when dirty; PublishBar sticky.
42. Admin dark mode toggles tokens only (no hard-coded colours): screenshot diff shows consistent contrast (axe zero violations in `.dark`).

Content/brand
43. Copy: no banned phrases (1.3 #6); no emoji; proposed microcopy flagged in a review list is approved or replaced before launch.
44. Logo: header uses SVG, clear space respected, white variant on navy; favicon shows ring + burgundy dot at 16px legibly.
45. Image treatment: scrim only on text-over-photo areas; hero scrim matches 4.7; no duotone on product photos.
46. Percent-area check (2.4): spot-check Home and Contact: navy area within +-8 percentage points of the stated ratio; burgundy area under 2%.

---
End of specification.
