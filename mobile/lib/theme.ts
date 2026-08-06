// Matches the web storefront's own palette exactly (see web DESIGN-SPEC) —
// forest green as the one accent (CTAs, active states, prices, links), sage
// as its lighter secondary, off-white as the default surface everywhere.
// `ink` is reserved for deliberate dark moments (hero overlays, toasts,
// image placeholders) rather than being the default screen background —
// that flip away from an all-dark UI was direct design feedback ("too dark,
// no liveness"); the accent color itself should still read as the site's
// own green, not an invented brand color.
export const C = {
  paper: "#F6F3EA", // primary off-white background — default for every screen
  surface: "#FFFFFF", // white card surface, sits a layer above `paper`
  forest: "#27481F", forestMid: "#3C6A33", // primary accent — CTAs, active states, price, links
  sage: "#7BA46F", // secondary accent — eyebrows, icons, subtler highlights
  altitude: "#142536", // reserved dark navy — rare deliberate dark panel
  clay: "#B8826B", // error/danger
  ink: "#0C100D", // reserved near-black — hero overlays, image placeholders, dark accent panels only
  text: "#15150F", // primary text (on light surfaces)
  mid: "#52504A", // secondary text
  light: "#94917F", // tertiary/muted text
  rule: "#DDD7C6", // borders, dividers
  heroGreen: "#182b22", warmPaper: "#F4EBD7",
} as const;

export const F = {
  display: "Fraunces_300Light",
  displayRegular: "Fraunces_400Regular",
  displayItalic: "Fraunces_400Regular_Italic",
  displayBold: "Fraunces_600SemiBold",
  body: "Inter_400Regular",
  bodyBold: "Inter_600SemiBold",
  // DESIGN-SPEC.md calls for a monospace face on every eyebrow/section-label
  // element (e.g. "SIZE", "MATERIALS") — screens were rendering these in
  // displayBold (a serif) instead, since no mono font was ever loaded.
  mono: "SpaceMono_400Regular",
  monoBold: "SpaceMono_700Bold",
} as const;

// Bumped up from the site's own scale — user feedback called out cramped
// spacing as part of what made the app feel joyless; more breathing room
// between sections and around touch targets reads as calmer/more inviting.
export const S = { xs: 6, sm: 10, md: 18, lg: 28, xl: 36, section: 72 } as const;
export const R = { sm: 6, md: 12, full: 999 } as const;
