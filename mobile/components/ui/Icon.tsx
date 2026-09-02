import { Text, TextStyle } from "react-native";
import { C, F } from "@/lib/theme";

// Material Symbols Rounded is a ligature icon font: the *word* "home" shapes
// into the home glyph via the font's GSUB table. RN can't animate a variable
// font's FILL axis (no `fontVariationSettings` support), so the mock's
// FILL 0→1 "active state" morph is approximated here as a font swap between
// two pre-instanced static cuts — MaterialSymbolsRounded (FILL 0, the resting
// outline) and MaterialSymbolsRoundedFill (FILL 1) — both loaded in
// app/_layout.tsx. Names are taken verbatim from the design HTML.
type Props = {
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: TextStyle;
};

export function Icon({ name, size = 24, color = C.ink, filled = false, style }: Props) {
  return (
    <Text
      // ── AN ICON IS NOT TEXT ───────────────────────────────────────────────
      //
      // Material Symbols is a ligature font, so every icon in this app is a
      // <Text> node — and Text scales with the reader's Dynamic Type setting.
      // At `accessibility-extra-large` a 23px tab icon renders at roughly 40px
      // inside a pill whose height is a layout constant, so the icons were
      // clipped through the middle on all five tabs and the labels ellipsised
      // to "SH…" and "STU…". Every IconButton, chip and inline glyph elsewhere
      // had the same problem for the same reason.
      //
      // The `size` prop IS the intended dimension; it is passed by the caller
      // to fit a container the caller has already sized. Scaling it is not an
      // accessibility win — the text beside it still scales, which is the
      // channel that carries the meaning — it is a layout break that hides the
      // control. Apple's own tab bar stops scaling for the same reason, and
      // `TabBar.tsx` already clamps its labels on that argument; the icons were
      // simply never covered by it.
      allowFontScaling={false}
      style={[
        {
          fontFamily: filled ? F.iconFill : F.icon,
          fontSize: size,
          color,
          lineHeight: size * 1.15,
        },
        style,
      ]}
      selectable={false}
    >
      {name}
    </Text>
  );
}
