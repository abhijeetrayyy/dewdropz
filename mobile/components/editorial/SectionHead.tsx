import { ReactNode } from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Rule } from "./Rule";
import { Icon } from "@/components/ui/Icon";
import { Display2, Display3, Eyebrow, Lede, Mono, Meta } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { C, S } from "@/lib/theme";

// Every section on every screen opens with this. That's the point — a magazine
// reads as one publication because the furniture repeats, not because each
// spread is individually clever.
//
//   ┌ 01 · THE WORKBENCH ····························· See all → ┐  eyebrow row
//   ├───────────────────────────────────────────────────────────┤  strong rule
//   │ Put your own                                               │  headline
//   │ mark on it.                                                │
//   │ Heavyweight blanks in an oversized unisex fit.             │  lede
//   └───────────────────────────────────────────────────────────┘
//
// The mono index on the left is doing real work: it tells the reader where
// they are in a long scroll, which is exactly the affordance an app feed
// normally throws away.

type Props = {
  /** Zero-padded section index — "01", "02". Omit for one-off heads. */
  index?: string;
  eyebrow: string;
  title: string;
  lede?: string;
  /** Right-aligned action in the eyebrow row, e.g. "See all". */
  actionLabel?: string;
  onAction?: () => void;
  /** `d3` for sub-sections inside an already-titled screen. */
  size?: "d2" | "d3";
  tone?: "default" | "onDark";
  style?: ViewStyle;
  children?: ReactNode;
};

export function SectionHead({
  index,
  eyebrow,
  title,
  lede,
  actionLabel,
  onAction,
  size = "d2",
  tone = "default",
  style,
  children,
}: Props) {
  const onDark = tone === "onDark";
  const Headline = size === "d2" ? Display2 : Display3;

  return (
    <View style={style}>
      <View style={s.eyebrowRow}>
        {index ? (
          <>
            <Mono color={onDark ? "rgba(255,255,255,0.5)" : C.textFaint}>{index}</Mono>
            <View style={[s.tick, onDark && { backgroundColor: "rgba(255,255,255,0.28)" }]} />
          </>
        ) : null}
        <Eyebrow color={onDark ? C.clay : C.forest} style={{ flex: 1 }} numberOfLines={1}>
          {eyebrow}
        </Eyebrow>
        {actionLabel && onAction ? (
          <TouchableOpacity
            style={s.action}
            hitSlop={10}
            activeOpacity={0.6}
            onPress={() => {
              haptics.select();
              onAction();
            }}
          >
            <Meta color={onDark ? C.paper : C.ink}>{actionLabel}</Meta>
            <Icon name="arrow_forward" size={15} color={onDark ? C.paper : C.ink} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Rule weight={onDark ? "soft" : "strong"} style={{ marginTop: 9, opacity: onDark ? 0.4 : 1 }} />

      <Headline color={onDark ? C.paper : C.ink} style={{ marginTop: S.md }}>
        {title}
      </Headline>

      {lede ? (
        <Lede color={onDark ? "rgba(255,255,255,0.72)" : C.textMid} style={{ marginTop: 10 }}>
          {lede}
        </Lede>
      ) : null}

      {children}
    </View>
  );
}

const s = StyleSheet.create({
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  // The short tick between index and eyebrow — a typesetter's separator, and
  // the cheapest possible signal that this row was composed rather than
  // concatenated.
  tick: { width: 14, height: 1, backgroundColor: C.ruleMed },
  action: { flexDirection: "row", alignItems: "center", gap: 4 },
});
