import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { C, F } from "@/lib/theme";
import { haptics } from "@/lib/haptics";

type Props = { title: string; children: React.ReactNode; defaultOpen?: boolean; bordered?: boolean };

export function Accordion({ title, children, defaultOpen = false, bordered = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Animated.View layout={LinearTransition} style={[s.item, bordered && s.bordered]}>
      <TouchableOpacity
        style={s.head}
        activeOpacity={0.7}
        onPress={() => {
          haptics.select();
          setOpen((o) => !o);
        }}
      >
        <Text style={s.label}>{title}</Text>
        <Text style={s.toggle}>{open ? "−" : "+"}</Text>
      </TouchableOpacity>
      {open && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  item: { paddingVertical: 18 },
  bordered: { borderBottomWidth: 1, borderBottomColor: C.rule },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: C.forest },
  toggle: { fontSize: 20, color: C.forest, fontFamily: F.display },
});
