import { Text, TextProps } from "react-native";
import { C, T } from "@/lib/theme";

// The type scale (lib/theme.ts `T`) as components. Screens compose from this
// list only — a raw `fontSize` anywhere in a screen file is a bug, because it
// means that screen has quietly opted out of the system and will drift.
//
// Four voices, per the v5 notes in theme.ts:
//   Display*  — Bricolage 800, the shout
//   Editorial — Bricolage 500, long headlines that shouldn't shout
//   Serif/Quote — Instrument Serif, the brand's own voice and its asides
//   Eyebrow/Mono/Numeric — Space Mono, the margin notes
//   Title/Body/Meta/Micro — Archivo, the speaking voice

type Props = TextProps & { color?: string };

/** One per screen, maximum. Home hero, screen openers. */
export const Hero = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.hero, { color }, style]} {...p} />;
export const Display1 = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.d1, { color }, style]} {...p} />;
export const Display2 = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.d2, { color }, style]} {...p} />;
export const Display3 = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.d3, { color }, style]} {...p} />;

/** Bricolage 500 — for headlines long enough that 800 would bully the page. */
export const Editorial = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.editorial, { color }, style]} {...p} />;
/** Instrument Serif regular — collection names, manifesto lines. */
export const Serif = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.serif, { color }, style]} {...p} />;
/** Instrument Serif italic — pull quotes, testimonials, guide asides. */
export const Quote = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.quote, { color }, style]} {...p} />;

export const Title = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.title, { color }, style]} {...p} />;
export const Body = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.body, { color }, style]} {...p} />;
export const BodyLarge = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.bodyLarge, { color }, style]} {...p} />;
/** The paragraph directly under a section head. */
export const Lede = ({ style, color = C.textMid, ...p }: Props) => <Text style={[T.lede, { color }, style]} {...p} />;
export const Meta = ({ style, color = C.textMuted, ...p }: Props) => <Text style={[T.meta, { color }, style]} {...p} />;
export const Micro = ({ style, color = C.textMuted, ...p }: Props) => <Text style={[T.micro, { color }, style]} {...p} />;

/** Mono eyebrow — sits above section headlines. The editorial signature. */
export const Eyebrow = ({ style, color = C.meadow, ...p }: Props) => <Text style={[T.eyebrow, { color }, style]} {...p} />;
/** Mono margin note — indices, timestamps, order numbers, figure credits. */
export const Mono = ({ style, color = C.textMuted, ...p }: Props) => <Text style={[T.mono, { color }, style]} {...p} />;
/** Mono numerals that need to align in a column — prices, totals, specs. */
export const Numeric = ({ style, color = C.ink, ...p }: Props) => <Text style={[T.numeric, { color }, style]} {...p} />;

/**
 * Legacy uppercase Archivo label. Superseded by `Eyebrow` — kept so screens
 * that haven't been migrated keep rendering while the redesign lands.
 */
export const Label = ({ style, color = C.meadow, ...p }: Props) => <Text style={[T.label, { color }, style]} {...p} />;
/** @deprecated use `Quote` */
export const SerifQuote = Quote;
