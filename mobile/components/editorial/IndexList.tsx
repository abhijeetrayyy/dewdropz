import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Rule } from "./Rule";
import { Icon } from "@/components/ui/Icon";
import { Body, Mono, Title } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { C, S } from "@/lib/theme";

// A numbered, ruled list. This is the pattern that replaces most of v4's
// shadowed white cards: values on About, commitments on Sustainability, steps
// on the Design tab, the timeline, FAQ rows.
//
//   01 ─── Tested at altitude, not in a lab
//          Every prototype goes up a real mountain before it goes
//          into a real cart.
//   ────────────────────────────────────────────────────────────
//   02 ─── Built to disappear
//
// The hanging mono numeral does the visual work a card's border used to do,
// for a fraction of the ink.

export type IndexItem = {
  title: string;
  body?: string;
  /** Optional right-side value, e.g. a year or a count. */
  value?: string;
  onPress?: () => void;
};

type Props = {
  items: IndexItem[];
  /** Start numbering at something other than 1, or pass `false` for bullets. */
  startAt?: number;
  numbered?: boolean;
  tone?: "default" | "onDark";
  style?: ViewStyle;
};

export function IndexList({ items, startAt = 1, numbered = true, tone = "default", style }: Props) {
  const onDark = tone === "onDark";

  return (
    <View style={style}>
      {items.map((item, i) => {
        const Row = item.onPress ? TouchableOpacity : View;
        return (
          <View key={`${item.title}-${i}`}>
            {i > 0 ? <Rule weight={onDark ? "soft" : "soft"} style={onDark ? { opacity: 0.3 } : undefined} /> : null}
            <Row
              {...(item.onPress
                ? {
                    activeOpacity: 0.6,
                    onPress: () => {
                      haptics.select();
                      item.onPress!();
                    },
                  }
                : {})}
              style={s.row}
            >
              {numbered ? (
                <Mono color={onDark ? C.marigold : C.meadow} style={s.num}>
                  {String(startAt + i).padStart(2, "0")}
                </Mono>
              ) : (
                <View style={[s.bullet, onDark && { backgroundColor: C.marigold }]} />
              )}
              <View style={{ flex: 1 }}>
                <Title color={onDark ? C.paper : C.ink}>{item.title}</Title>
                {item.body ? (
                  <Body color={onDark ? "rgba(255,255,255,0.66)" : C.textMid} style={{ marginTop: 6 }}>
                    {item.body}
                  </Body>
                ) : null}
              </View>
              {item.value ? <Mono color={onDark ? "rgba(255,255,255,0.6)" : C.textFaint}>{item.value}</Mono> : null}
              {item.onPress ? <Icon name="chevron_right" size={20} color={onDark ? "rgba(255,255,255,0.5)" : C.faintIcon} /> : null}
            </Row>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: S.md, paddingVertical: S.lg },
  // Fixed width so every title in the list starts on the same optical margin,
  // regardless of whether the numeral is "01" or "12".
  num: { width: 20, marginTop: 4 },
  bullet: { width: 5, height: 5, borderRadius: 999, backgroundColor: C.meadow, marginTop: 9, marginLeft: 7, marginRight: 8 },
});
