import { View, ViewProps } from "react-native";
import { C, R, S, SHADOW } from "@/lib/theme";

// v4's Card was a white shadowed box, and *everything* was one — settings
// rows, order summaries, notification items, the size chart. Stacked on cream
// they turned every screen into the same screen.
//
// v5 keeps the component (too many call sites to delete) but inverts the
// default: a Card is now a ruled block that sits ON the paper. `elevated`
// opts back into the old floating look for the two or three places that
// genuinely need to float above scrolling content.

type Props = ViewProps & {
  padded?: boolean;
  /** White fill + shadow. Use only when the block must float. */
  elevated?: boolean;
  /** Warm fill instead of a rule — for callouts that need to sit apart. */
  tone?: "ruled" | "fill" | "ink";
};

export function Card({ style, padded = true, elevated, tone = "ruled", ...p }: Props) {
  return (
    <View
      style={[
        { borderRadius: R.panel },
        tone === "ruled" && !elevated && { borderWidth: 1, borderColor: C.ruleSoft },
        tone === "fill" && { backgroundColor: C.cream },
        tone === "ink" && { backgroundColor: C.ink },
        elevated && { backgroundColor: C.surface, ...SHADOW },
        padded && { padding: S.md },
        style,
      ]}
      {...p}
    />
  );
}
