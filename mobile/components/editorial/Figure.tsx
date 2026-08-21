import { StyleSheet, View, ViewStyle } from "react-native";
import { Img as Image } from "@/components/ui/Img";
import { Mono } from "@/components/ui/Type";
import { C, R, S } from "@/lib/theme";

// An image with a credit line under it. Trivial component, outsized effect:
// a captioned figure reads as documentary, an uncaptioned one reads as stock.
// The caption sits in Space Mono to match the section eyebrows, so photography
// and typography are visibly part of the same system.

type Props = {
  uri?: string | null;
  /** height in px, or use `aspect` for a ratio-driven box */
  height?: number;
  aspect?: number;
  caption?: string;
  /** Right-aligned credit, e.g. "ROOPKUND · 4,200M" */
  credit?: string;
  full?: boolean; // full-bleed (no radius) vs. inset block
  style?: ViewStyle;
};

export function Figure({ uri, height, aspect = 4 / 5, caption, credit, full, style }: Props) {
  return (
    <View style={style}>
      <View style={[s.frame, full ? { borderRadius: 0 } : null, height ? { height } : { aspectRatio: aspect }]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} alt="" />
        ) : null}
      </View>
      {caption || credit ? (
        <View style={[s.captionRow, !full && { paddingHorizontal: 0 }]}>
          {caption ? (
            <Mono color={C.textMid} style={{ flex: 1 }} numberOfLines={2}>
              {caption}
            </Mono>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {credit ? <Mono color={C.textFaint}>{credit}</Mono> : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  frame: { width: "100%", borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  captionRow: { flexDirection: "row", alignItems: "flex-start", gap: S.sm, marginTop: 10 },
});
