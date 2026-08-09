// ─────────────────────────────────────────────────────────────────────────────
// DewDropz mobile — "Editorial" design system (v5)
// ─────────────────────────────────────────────────────────────────────────────
//
// v4 kept the right ingredients (warm paper, one loud accent, a display
// weight) but cooked them like an app template: every screen was a stack of
// white shadowed cards on cream, one 46px display size doing every headline
// job from "Your pack" to the home hero, and two of the four loaded typefaces
// (Instrument Serif, Space Mono) sitting unused in the bundle.
//
// v5 keeps the identity — paper, ink, ember, meadow, marigold, Bricolage —
// and rebuilds the *grammar* around four rules borrowed from print:
//
//   1. FOUR VOICES, NOT ONE. Bricolage 800 sets the shout (display). Archivo
//      sets the speaking voice (body/UI). Space Mono sets the margin notes —
//      eyebrows, indices, timestamps, SKUs — which is what makes a layout read
//      as edited rather than generated. Instrument Serif sets the asides: pull
//      quotes and the brand's own voice. All four were already in the bundle;
//      only one was really being used.
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

export const F = {
  // Display — Bricolage Grotesque. 800 shouts, 700 speaks firmly, 500 is the
  // quiet editorial cut used for long headlines that shouldn't yell.
  display: "BricolageGrotesque_800ExtraBold",
  displayBold: "BricolageGrotesque_700Bold",
  displayMid: "BricolageGrotesque_500Medium",

  // Body — Archivo.
  body: "Archivo_400Regular",
  bodyMedium: "Archivo_500Medium",
  bodySemiBold: "Archivo_600SemiBold",
  bodyBold: "Archivo_700Bold",
  bodyItalic: "Archivo_400Regular_Italic",

  // Editorial asides — Instrument Serif. Was loaded but never rendered in v4.
  serif: "InstrumentSerif_400Regular",
  serifItalic: "InstrumentSerif_400Regular_Italic",

  // Margin notes — Space Mono. Eyebrows, indices, timestamps, order numbers.
  mono: "SpaceMono_400Regular",
  monoBold: "SpaceMono_700Bold",

  // Material Symbols Rounded — see components/ui/Icon.tsx
  icon: "MaterialSymbolsRounded",
  iconFill: "MaterialSymbolsRoundedFill",

  // ---- Legacy aliases — Customize Studio only ----
  displayRegular: "BricolageGrotesque_800ExtraBold",
  displayItalic: "InstrumentSerif_400Regular_Italic",
} as const;

// ─── Type scale ──────────────────────────────────────────────────────────────
// Tracking tightens as size grows: at 60px the default letterspace reads as a
// gap, at 11px it reads as texture. That inverse relationship is the single
// biggest difference between type that looks set and type that looks typed.
export const T = {
  /** Home hero / screen openers only. One per screen, maximum. */
  hero: { fontFamily: F.display, fontSize: 56, lineHeight: 53, letterSpacing: -2.2 },
  /** Screen titles and major section headlines. */
  d1: { fontFamily: F.display, fontSize: 40, lineHeight: 40, letterSpacing: -1.4 },
  /** Section headlines inside a screen. */
  d2: { fontFamily: F.display, fontSize: 29, lineHeight: 31, letterSpacing: -0.8 },
  /** Sub-section / card headlines. */
  d3: { fontFamily: F.display, fontSize: 22, lineHeight: 25, letterSpacing: -0.4 },

  /** Long editorial headlines that shouldn't shout — journal, about, values. */
  editorial: { fontFamily: F.displayMid, fontSize: 27, lineHeight: 32, letterSpacing: -0.5 },
  /** Serif display — the brand's own voice. Collection names, manifesto lines. */
  serif: { fontFamily: F.serif, fontSize: 38, lineHeight: 40, letterSpacing: -0.5 },
  /** Pull quotes, testimonials, guide asides. */
  quote: { fontFamily: F.serifItalic, fontSize: 23, lineHeight: 31, letterSpacing: -0.2 },

  /** Row titles, product names, list headings. */
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

  /** THE editorial signature: mono eyebrow above every section head. */
  eyebrow: { fontFamily: F.monoBold, fontSize: 10, lineHeight: 13, letterSpacing: 1.9, textTransform: "uppercase" as const },
  /** Mono margin note — indices, timestamps, order numbers, figure credits. */
  mono: { fontFamily: F.mono, fontSize: 10, lineHeight: 13, letterSpacing: 1.2 },
  /** Numerals that need to align in a column (prices, totals, specs). */
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
