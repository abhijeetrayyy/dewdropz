import { View, ViewStyle } from "react-native";
import { C } from "@/lib/theme";

// The workhorse of the v5 layout. Four weights, matching lib/theme.ts:
//   hair   — inside dense lists, where a soft rule would stripe the screen
//   soft   — the default separator between rows and blocks
//   med    — emphasis, e.g. above a total line
//   strong — under a section head, the heaviest line on the page
//   ink    — solid 1.5px ink, used sparingly as a deliberate full stop
//
// A rule is cheaper than a card (no shadow layer, no extra view for the fill)
// and reads as more considered, which is the whole v4 → v5 trade.
type Props = {
  weight?: "hair" | "soft" | "med" | "strong" | "ink";
  /** Inset the rule from one or both ends — a hanging rule reads as designed. */
  inset?: number;
  style?: ViewStyle;
};

const COLORS = {
  hair: C.ruleHair,
  soft: C.ruleSoft,
  med: C.ruleMed,
  strong: C.ruleStrong,
  ink: C.ruleInk,
} as const;

export function Rule({ weight = "soft", inset = 0, style }: Props) {
  return (
    <View
      style={[
        {
          height: weight === "ink" ? 1.5 : 1,
          backgroundColor: COLORS[weight],
          marginLeft: inset,
        },
        style,
      ]}
    />
  );
}
