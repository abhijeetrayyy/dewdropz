import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, F } from "@/lib/theme";

const LOGO_MARK = require("@/assets/images/logo-mark.png");

// Screen 01 "Splash" — expo-splash-screen only shows a static native image,
// so this JS overlay renders the design's actual gradient/wordmark/dots for
// the brief window between fonts finishing and the app being interactive
// (see app/_layout.tsx — held under 1.2s, same promise the mock makes).
//
// Every colour here was hardcoded and had drifted off the palette entirely:
// an #FFD8A4→#FFE7C6 amber gradient left over from the v5 "ember" accent, a
// #16795B teal for the dots that exists nowhere else in the brand, and the v5
// ink (#17231D) for the wordmark. This is the FIRST thing anyone sees, so it
// was the one screen guaranteed to set the wrong expectation. It now warms
// from paperDeep into paper and marks progress in forest.
export function AppSplash() {
  return (
    <View style={s.root}>
      <LinearGradient
        colors={[C.paperDeep, C.cream, C.paper]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.glow} />
      <View style={s.center}>
        <Image source={LOGO_MARK} style={{ width: 64, height: 64 }} resizeMode="contain" />
        <Text style={s.word}>DEWDROPZ</Text>
        <Text style={s.tag}>Feel Alive</Text>
      </View>
      <View style={s.dots}>
        <View style={[s.dot, s.dotActive]} />
        <View style={s.dot} />
        <View style={s.dot} />
      </View>
      <Text style={s.loc}>Dehradun, Uttarakhand · Est. 2019</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 999 },
  glow: { position: "absolute", top: 70, right: -50, width: 210, height: 210, borderRadius: 999, backgroundColor: C.sage12, opacity: 0.6 },
  center: { alignItems: "center", gap: 22 },
  word: { fontFamily: F.display, fontSize: 26, letterSpacing: 5, color: C.ink },
  // Fraunces light italic — matches web's own site title, "DEWDROPZ — Feel
  // Alive", and the italic treatment every pull-quote/tagline gets there.
  tag: { fontFamily: F.displayItalic, fontSize: 22, color: C.textMid, marginTop: -4 },
  dots: { position: "absolute", bottom: 120, flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: C.forest12 },
  dotActive: { backgroundColor: C.forest },
  loc: { position: "absolute", bottom: 74, fontFamily: F.bodyMedium, fontSize: 13, color: C.textFaint },
});
