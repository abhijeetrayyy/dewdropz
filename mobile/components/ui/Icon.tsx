import { Text, TextStyle } from "react-native";
import { F } from "@/lib/theme";

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

export function Icon({ name, size = 24, color = "#17231D", filled = false, style }: Props) {
  return (
    <Text
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
