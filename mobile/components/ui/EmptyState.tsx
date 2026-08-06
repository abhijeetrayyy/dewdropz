import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, Href } from "expo-router";
import { C, F, R } from "@/lib/theme";

type Props = {
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onPress?: () => void;
};

// Every screen is on the warm cream surface now, so there's no more
// light/dark variant to choose between — text always reads dark-on-light.
export function EmptyState({ title, body, ctaLabel, ctaHref, onPress }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>{title}</Text>
      {body ? <Text style={s.body}>{body}</Text> : null}
      {ctaLabel ? (
        <TouchableOpacity
          style={s.btn}
          activeOpacity={0.9}
          onPress={onPress ?? (() => ctaHref && router.push(ctaHref as Href))}
        >
          <Text style={s.btnT}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: 32, paddingVertical: 64 },
  title: { fontFamily: F.display, fontSize: 22, textAlign: "center", color: C.text },
  body: { fontFamily: F.body, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 10, maxWidth: 280, color: C.mid },
  btn: { backgroundColor: C.forest, borderRadius: R.md, paddingHorizontal: 28, paddingVertical: 15, marginTop: 24 },
  btnT: { fontFamily: F.bodyBold, fontSize: 13, letterSpacing: 0.4, color: "#FFFFFF", fontWeight: "600" },
});
