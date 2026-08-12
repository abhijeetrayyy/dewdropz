// ─────────────────────────────────────────────────────────────────────────────
// DewDropz mobile — "Editorial" design system (v6)
// ─────────────────────────────────────────────────────────────────────────────
//
// v4 kept the right ingredients (warm paper, one loud accent, a display
// weight) but cooked them like an app template: every screen was a stack of
// white shadowed cards on cream, one 46px display size doing every headline
// job from "Your pack" to the home hero.
//
// v5 rebuilt the *grammar* around four rules borrowed from print, and gave
// mobile its own four-typeface voice (Bricolage Grotesque, Archivo, Instrument
// Serif, Space Mono) — deliberately distinct from the website's fonts, on the
// theory that mobile was its own publication.
//
// v6 changes exactly rule 1 and nothing else: the two apps are now read as one
// brand rather than two products that happen to share a name, so mobile sets
// type in the SAME two faces the website loads (app/layout.tsx: next/font
// Fraunces + Inter) instead of its own four. Rules 2–4 — the layout grammar —
// are untouched; they were never about which typeface, only how much air
// around it.
//
//   1. THREE VOICES, SHARED WITH WEB. Fraunces sets the display roles, Archivo
//      the speaking voice, Space Mono the technical marginalia — the same
//      three faces the website now loads. See the `F` block below for why each
//      was chosen and what job it does.
//
//   2. RULES, NOT CARDS. A hairline rule and 40px of air separate sections
//      better than a shadowed white box, and cost nothing to render. `SHADOW`
//      survives for the few things that genuinely float (sheets, the CTA bar);
//      everything that was a Card is now a ruled block on paper.
//
//   3. RANGE. The scale runs 10 → 60. v4's 46 was simultaneously too small to
//      carry a hero and too large for a screen title, so every screen looked
//      like the same screen. `hero`/`d1`/`d2`/`d3` now have real distance
//      between them, with tracking that tightens as size grows (optical
//      compensation — big type needs less letterspace, not the same amount).
//
//   4. RHYTHM. Section spacing is its own scale (`S.section`, `S.band`), an
//      octave above the component gaps. Editorial layouts breathe at a
//      different frequency than the widgets inside them.
//
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  // ---- Surfaces ----
  paper: "#FBF7EF", // default screen background
  paperDeep: "#F5EFE1", // alternating section band — the "warm afternoon" tone
  sand: "#EFE7D9", // image placeholders, progress tracks
  cream: "#F1EADD", // quiet fills — pill backgrounds, table header rows
  creamDeep: "#F7F3EA", // quiet button fill ("Track", "Buy again")
  surface: "#FFFFFF", // white — now rare, reserved for genuinely floating things

  // ---- Accents ────────────────────────────────────────────────────────────
  // These are the WEB APP'S OWN BRAND VARIABLES (app/globals.css), not a
  // mobile-only invention. The two products deliberately keep different
  // layout philosophies — web is a scrolling day on the mountain, mobile is a
  // printed issue — but they are one company, so they share one set of inks.
  //
  // v5 shipped with `ember` (#FF4B2E) as the CTA. It converted, but a neon
  // orange is the one color on the palette that could never appear on a
  // mountain, and it made the app look like a different brand from the site.
  // Forest replaces it exactly: `bg-forest` is already what every buy button
  // on the web uses (components/sections/CartView.tsx, WishlistView.tsx).
  //
  // The semantic split that keeps a dark-green CTA legible:
  //     forest = commerce   (buy, pay, add — the money actions)
  //     ink    = navigation (track, browse, read — everything else)
  // That only works if the two are unmistakably different, which is why `ink`
  // moved to a near-neutral black below.
  forest: "#27481F", // THE action color — every primary CTA
  forestMid: "#3C6A33", // pressed state, secondary green
  forestDeep: "#1B3315", // text/icon on forest-tinted surfaces
  forest12: "#E4EBE0", // forest-tinted surface (active pills, callouts)

  sage: "#7BA46F", // confirms — in stock, free shipping, success, on-dark eyebrows
  sageDeep: "#4A7040", // sage text that needs to hold on paper
  sage12: "#E9F0E6",

  // The warm side of the palette. Earth tones, not signal colors: clay is a
  // sun-bleached terracotta and rust is burnt earth. Both belong on a
  // ridgeline; neither shouts loudly enough to compete with forest.
  clay: "#B8826B", // badges, scarcity, stars, journal tags — never a button
  clayDeep: "#8A5A3F", // text/icon on clay-tinted surfaces
  clay12: "#F3E8E0",
  rust: "#8C4A2F", // discount tags ONLY — the one "sale" mark

  altitude: "#142536", // deep blue-black — high-altitude bands, night sections
  altitudeSoft: "#1E3347",

  // ---- Ink ────────────────────────────────────────────────────────────────
  // Moved from #17231D (a desaturated green) toward the web's #0C100D. With
  // forest now doing the CTA job, ink had to stop being green — otherwise
  // "Add to pack" (forest) and "Track order" (ink) read as the same button.
  ink: "#101512", // primary text, dark panels
  inkSoft: "#1C2320", // dark panel gradient partner
  textMid: "#5C6A62", // secondary text
  textMuted: "#7A8880", // tertiary text, inactive labels
  textFaint: "#9AA69F", // quaternary, disabled, struck-through
  faintIcon: "#C6CCC7", // chevrons, disengaged glyphs
  disabled: "#A9B2AC",
  disabledBg: "#E3DED2",

  // ---- Lines ----
  // Four weights: `hair` for dense lists, `soft` for section separators,
  // `med` for emphasis, `strong` for the heavy rule under a section head.
  // Derived from the new ink (16,21,18) so rules stay neutral rather than
  // tinting every separator faintly green.
  ruleHair: "rgba(16,21,18,0.06)",
  ruleSoft: "rgba(16,21,18,0.09)",
  ruleMed: "rgba(16,21,18,0.14)",
  ruleStrong: "rgba(16,21,18,0.22)",
  ruleInk: "#101512",

  // ---- Utility ----
  overlay: "rgba(16,21,18,0.42)",
  scrim: "rgba(12,18,15,0.55)", // over-photo text protection
  danger: "#C25A45",
  danger12: "#F7E8E4",
  white: "#FFFFFF",

  // ---- Legacy (pre-v3) — Customize Studio only ----
  // app/customize/* and components/customize/* predate the redesign. `forest`
  // and `sage` used to live down here as studio-only aliases; they're first-
  // class accents now (above), so only the studio's own greys remain.
  light: "#94917F", text: "#15150F", mid: "#52504A", rule: "#DDD7C6",
  heroGreen: "#182b22", warmPaper: "#F4EBD7",
} as const;

// v6 — ONE type system across web and mobile: Fraunces / Archivo / Space Mono.
// Identical faces in both apps (web declares them in app/layout.tsx via
// next/font as --font-display / --font-body / --font-mono).
//
// Three roles, because this brand genuinely speaks in three registers:
//   display  Fraunces    the voice — headlines, collection names, pull quotes
//   body     Archivo     the speaking voice — copy, buttons, labels, UI
//   mono     Space Mono  the instrument readout — coordinates, altitudes,
//                        clock times, spec values, order numbers, indices
//
// The weight rule is read straight off web's own class usage (grepped across
// every component): EVERY section/page headline — hero through card — is
// `font-display font-light` (Fraunces 300). Only smaller in-card or in-row
// headings (a product name in a grid, a collection name in a list) drop back
// to Fraunces' default 400, never bold.
//
// v5 ran four different faces here (Bricolage Grotesque, Archivo, Instrument
// Serif, Space Mono) — deliberately its own identity, distinct from the site.
// That is no longer the brief: the two are read as one brand. Two of v5's
// four (Archivo, Space Mono) survive because they were the right calls; they
// are now shared with web rather than mobile-only.
export const F = {
  // ── display — Fraunces ────────────────────────────────────────────────────
  // Warm old-style serif with a real optical-size axis. Carries the brand's
  // voice. `Light` is web's own headline weight (`font-display font-light`
  // on every section h2 sitewide); `Regular` is what web drops to for
  // card-scale headings and named entities (product names, collection names).
  display: "Fraunces_300Light",
  displayRegular: "Fraunces_400Regular",
  displayItalic: "Fraunces_300Light_Italic", // pull quotes, asides, taglines
  serifItalic: "Fraunces_400Regular_Italic",

  // ── body — Archivo ────────────────────────────────────────────────────────
  // A grotesque descended from late-19th-century American gothics: the
  // lineage of signage and industrial printing. Sturdier at small sizes than
  // a neutral UI sans and, for a company that prints garments to order, it
  // reads as equipment rather than software.
  body: "Archivo_400Regular",
  bodyMedium: "Archivo_500Medium",
  bodySemiBold: "Archivo_600SemiBold",
  bodyBold: "Archivo_700Bold",
  bodyItalic: "Archivo_400Regular_Italic", // real italic, unlike the Inter cut

  // ── mono — Space Mono ─────────────────────────────────────────────────────
  // The technical register: coordinates, altitudes, the day-arc clock times,
  // spec values, order numbers, section indices. This is a real role in this
  // brand, not decoration — web asks for `font-mono` in 41 places — and mono
  // is what makes columns of figures actually line up.
  mono: "SpaceMono_400Regular",
  monoBold: "SpaceMono_700Bold",

  // Material Symbols Rounded — see components/ui/Icon.tsx
  icon: "MaterialSymbolsRounded",
  iconFill: "MaterialSymbolsRoundedFill",
} as const;

// ─── Type scale ──────────────────────────────────────────────────────────────
// Tracking and leading now follow web's own numbers rather than a rule tuned
// for a bold grotesque sans. Grepped across every `font-display` heading on
// the site: tight negative tracking appears in exactly one place — the
// all-caps hero (`tracking-[-0.04em]`) — everywhere else (section h2s, card
// h3s) carries NO tracking utility at all, i.e. 0. Fraunces is also a light,
// generous serif; the old -1.4…-0.8 tracking and sub-1.0 leading that suited
// 800-weight Bricolage Grotesque reads as cramped on it. Leading below is
// pulled from web's own `leading-[1.03]`–`leading-[1.1]` classes on these
// exact headline roles.
export const T = {
  /** Home hero / screen openers only. One per screen, maximum. */
  hero: { fontFamily: F.display, fontSize: 56, lineHeight: 56, letterSpacing: -2.2 },
  /** Screen titles and major section headlines. */
  d1: { fontFamily: F.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.2 },
  /** Section headlines inside a screen. */
  d2: { fontFamily: F.display, fontSize: 29, lineHeight: 32, letterSpacing: -0.1 },
  /** Sub-section / card headlines — web's default (non-light) Fraunces weight. */
  d3: { fontFamily: F.displayRegular, fontSize: 22, lineHeight: 26, letterSpacing: 0 },

  /** Long editorial headlines that shouldn't shout — journal, about, values.
   *  Web's journal titles (list and article) are font-light like every other
   *  section headline, not a lighter separate cut — matched here. */
  editorial: { fontFamily: F.display, fontSize: 27, lineHeight: 33, letterSpacing: 0 },
  /** Serif display — the brand's own voice. Collection names, manifesto lines.
   *  Web sets these at default Fraunces weight (CollectionsRow, ProductDetail
   *  narrative), same cut as d3. */
  serif: { fontFamily: F.displayRegular, fontSize: 38, lineHeight: 42, letterSpacing: 0 },
  /** Pull quotes, testimonials, guide asides — web is consistently
   *  `font-display font-light italic` for every one of these. */
  quote: { fontFamily: F.displayItalic, fontSize: 23, lineHeight: 31, letterSpacing: 0 },

  /** Row titles, product names, list headings. Kept on Inter rather than
   *  following web's product-name Fraunces exactly — on web that heading is
   *  never also a settings row ("UPI"), a delivery method, or an address
   *  name, all of which this one role also renders here. The specific
   *  product/collection "name" styles that DO have a clean web equivalent
   *  (ProductCard, DesignYourOwn, SeasonWindow) are set in Fraunces directly
   *  at their own call sites instead of through this shared, mixed-use role. */
  title: { fontFamily: F.bodyBold, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  /** Default copy. */
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 23 },
  /** Article body — longer measure needs more leading. */
  bodyLarge: { fontFamily: F.body, fontSize: 17, lineHeight: 28 },
  /** Lede paragraph under a section head. */
  lede: { fontFamily: F.body, fontSize: 16, lineHeight: 25 },
  /** Secondary info, captions under rows. */
  meta: { fontFamily: F.bodyMedium, fontSize: 13, lineHeight: 18 },
  /** Smallest readable UI text — tags, helper text. */
  micro: { fontFamily: F.bodyMedium, fontSize: 11, lineHeight: 15 },

  /** THE editorial signature: a mono eyebrow above every section head —
   *  matching web's own `font-mono text-[10px] uppercase tracking-[0.2em]`,
   *  which it uses for exactly this on the day-arc section heads. */
  eyebrow: { fontFamily: F.monoBold, fontSize: 10, lineHeight: 13, letterSpacing: 1.9, textTransform: "uppercase" as const },
  /** Margin note — indices, timestamps, order numbers, figure credits. */
  mono: { fontFamily: F.mono, fontSize: 10, lineHeight: 13, letterSpacing: 1.2 },
  /** Numerals that need to align in a column (prices, totals, specs) — the
   *  reason this role is mono at all: proportional figures don't line up. */
  numeric: { fontFamily: F.monoBold, fontSize: 13, lineHeight: 17, letterSpacing: 0.2 },

  /** Legacy uppercase label — kept so un-migrated callers don't break. */
  label: { fontFamily: F.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.5, textTransform: "uppercase" as const },
} as const;

// ─── Space ───────────────────────────────────────────────────────────────────
// Two frequencies. `xs…xxl` are component gaps. `block`/`section`/`band` are
// the editorial rhythm — the air *between* sections, which is what makes a
// scroll feel composed instead of packed.
export const S = {
  xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32,
  block: 40, // gap between blocks inside one section
  section: 56, // gap between sections
  band: 72, // padding inside a full-bleed colored band
  /** The page gutter. Every screen's horizontal padding is this, no exceptions. */
  gutter: 20,
} as const;

// ─── Radius ──────────────────────────────────────────────────────────────────
// Photography and editorial blocks are SHARP (2–6px). Tappable controls are
// FULLY ROUND. Nothing in between — that contrast is what separates a designed
// interface from a uniformly-soft template.
export const R = {
  tag: 2, // sharp tags over photography
  card: 4, // image blocks, editorial panels
  panel: 8, // grouped input/list panels
  chip: 999, // tappable pills
  pill: 999,
  sheet: 24,
  // Legacy aliases — Customize Studio
  sm: 6, md: 12, full: 999,
} as const;

// ─── Elevation ───────────────────────────────────────────────────────────────
// Editorial layouts sit flat on the paper. Shadow is now the exception, used
// only for things that genuinely float above the page.
export const SHADOW = {
  shadowColor: "#101512",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
} as const;

/**
 * The floating primary CTA. Tinted forest and pushed a little stronger than
 * the ember version: a dark green button on warm paper has less inherent
 * separation than a neon orange one did, so the lift has to do more of the
 * work of saying "this is the thing to press".
 */
export const SHADOW_CTA = {
  shadowColor: C.forest,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.32,
  shadowRadius: 22,
  elevation: 7,
} as const;

/** Bars pinned over scrolling content (bottom bars, sticky headers). */
export const SHADOW_BAR = {
  shadowColor: "#101512",
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.05,
  shadowRadius: 16,
  elevation: 8,
} as const;

// ─── Motion ──────────────────────────────────────────────────────────────────
// One easing curve and three durations, so every transition in the app feels
// like it came from the same hand.
export const M = {
  fast: 140,
  base: 240,
  slow: 420,
  /** Matches the web app's --ease-out: cubic-bezier(0.22, 1, 0.36, 1). */
  ease: [0.22, 1, 0.36, 1] as const,
  /** Reanimated spring config for entrances. */
  spring: { damping: 18, stiffness: 140, mass: 0.9 },
} as const;
