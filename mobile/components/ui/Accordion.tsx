import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { C, F, M, S } from "@/lib/theme";
import { haptics } from "@/lib/haptics";

// Disclosure rows on Product (specs / care / shipping) and the contact FAQ.
//
// Two changes from v4: the title is now sentence-case Archivo rather than a
// meadow uppercase micro-label (it's a heading, not an eyebrow — using eyebrow
// styling for both flattened the hierarchy), and the +/− is a rotating glyph
// rather than a character swap, which was causing a 1px baseline jump on
// every toggle because "+" and "−" have different heights in Bricolage.

type Props = { title: string; children: React.ReactNode; defaultOpen?: boolean; bordered?: boolean };

export function Accordion({ title, children, defaultOpen = false, bordered = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const rot = useSharedValue(defaultOpen ? 1 : 0);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value * 45}deg` }],
  }));

  return (
    <Animated.View layout={LinearTransition.duration(M.base)} style={[s.item, bordered && s.bordered]}>
      <TouchableOpacity
        style={s.head}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptics.select();
          rot.value = withTiming(open ? 0 : 1, { duration: M.base });
          setOpen((o) => !o);
        }}
      >
        <Text style={s.label}>{title}</Text>
        {/* A plus rotating 45° into a cross — one glyph, no baseline shift. */}
        <Animated.View style={[s.plus, iconStyle]}>
          <View style={s.plusH} />
          <View style={s.plusV} />
        </Animated.View>
      </TouchableOpacity>
      {open ? (
        <Animated.View entering={FadeIn.duration(M.fast)} exiting={FadeOut.duration(120)} style={{ paddingBottom: 2 }}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  item: { paddingVertical: S.md },
  bordered: { borderBottomWidth: 1, borderBottomColor: C.ruleSoft },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: S.sm },
  label: { flex: 1, fontFamily: F.bodyBold, fontSize: 15, color: C.ink, letterSpacing: -0.1 },
  // Absolutely-positioned children with no insets are laid out by the
  // parent's alignment in Yoga, so both bars centre inside this 14×14 box.
  plus: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  plusH: { position: "absolute", width: 13, height: 1.5, backgroundColor: C.ink },
  plusV: { position: "absolute", width: 1.5, height: 13, backgroundColor: C.ink },
});
