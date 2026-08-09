import { StyleSheet, View, ViewStyle } from "react-native";
import { Quote, Mono, Micro } from "@/components/ui/Type";
import { C, S } from "@/lib/theme";

// The brand's voice, set apart from its own copy. Instrument Serif italic
// against a heavy ink rule on the left — the oldest trick in magazine layout
// and still the fastest way to make a screen feel written rather than filled.
//
// Used for: founder note (About), testimonials (Home), guide asides (Product),
// and the manifesto line on Sustainability.

type Props = {
  quote: string;
  attribution?: string;
  role?: string;
  tone?: "default" | "onDark";
  style?: ViewStyle;
};

export function PullQuote({ quote, attribution, role, tone = "default", style }: Props) {
  const onDark = tone === "onDark";
  return (
    <View style={[s.wrap, { borderLeftColor: onDark ? C.marigold : C.ink }, style]}>
      <Quote color={onDark ? C.paper : C.ink}>{quote}</Quote>
      {attribution ? (
        <View style={s.attr}>
          <View style={[s.dash, onDark && { backgroundColor: "rgba(255,255,255,0.4)" }]} />
          <Mono color={onDark ? "rgba(255,255,255,0.7)" : C.textMid}>{attribution.toUpperCase()}</Mono>
        </View>
      ) : null}
      {role ? (
        <Micro color={onDark ? "rgba(255,255,255,0.5)" : C.textFaint} style={{ marginTop: 4, marginLeft: 26 }}>
          {role}
        </Micro>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderLeftWidth: 2, paddingLeft: S.md },
  attr: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: S.md },
  dash: { width: 18, height: 1, backgroundColor: C.ruleStrong },
});
