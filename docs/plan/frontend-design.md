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
- Form layout: single column on mobile, two columns for name/email on >= 768; vertical gap between fields 20px; submit button `primary` `md` full-width on mobile, auto on desktop, right of the consent text on desktop? No: below consent, left-aligned.
- Inline validation on blur, summary alert above the form on submit with error count and links to fields.

### 6.4 Badges and chips (shadcn `badge`)
Shape radius 2px, height 24 (small 20), padding-x 8, font Roboto 12px/16 weight 500, uppercase tracking 0.06em, no border unless noted.
| Variant | bg / text | Use |
|---|---|---|
| `country` (flag-free) | bg #FFFFFF with 1px #D1D5DB border, text #374151, leading 6px `MapPin`? No: text only. Format: country name uppercase, preceded by a 3px x 12px `#843C40` vertical tick (the burgundy punctuation); e.g. `| JAPAN` | product/brand cards (top-left over the image on a white label) |
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
Centered? left-aligned with the result summary right ("Showing 1-12 of 38" `small`). Items 44x44, radius 4px, `small` 15px, current: bg `#2F447D` text white, others text `#374151` hover bg `#EEF1F8`; prev/next with chevrons and labels "Previous"/"Next" (labels hidden < 640). Disabled ends 0.5 opacity. Max 7 visible with ellipsis.

### 6.14 Toasts (sonner)
Position bottom-right desktop, top-center mobile. Width 360, radius 4px, bg `#FFFFFF`, 1px border `#E5E7EB`, `shadow-lg`, left 4px accent bar by type (success `#15803D`, error `#B91C1C`, warning `#B45309`, info `#0D5380`), leading 20px icon in that colour, title 15px 600 `#111827`, description 14px `#4B5563`, action button `link` variant. Close button 32px. Never auto-dismiss errors under 8s.

### 6.15 Dialogs and sheets (shadcn `dialog`, `alert-dialog`, `sheet`, `drawer`)
Overlay `rgba(11,18,32,0.6)`. Dialog: bg `#FFFFFF`, radius 6, `shadow-lg`, max-width 520 (confirm) / 720 (forms) / 960 (media picker), padding 24, title `h4`, description `small` `#4B5563`, footer buttons right-aligned (secondary left of primary), destructive dialogs use `destructive`. Close `X` 36px top-right. Mobile: dialogs become bottom drawers (`drawer`) with 16px top radius exception? No: radius 6 only; drawer top corners 6px.
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
