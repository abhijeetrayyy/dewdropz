import { StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { C } from "@/lib/theme";
import { Icon } from "./Icon";
import { haptics } from "@/lib/haptics";

// Four tones, chosen by what the button sits ON rather than by what it does:
//
//   glass  — over photography. Real blur (expo-blur), not a white rectangle
//            at 90% opacity, which is what v4 used and which turned muddy
//            over busy images.
//   quiet  — on paper. A ruled circle, no fill, no shadow. The default for
//            in-flow headers now that screens aren't card-soup.
//   solid  — on paper, when the button needs to read as raised.
//   dark   — on a light band where the control should be the darkest thing.

type Tone = "glass" | "quiet" | "solid" | "dark";

type Props = {
  name: string;
  onPress?: () => void;
  color?: string;
  filled?: boolean;
  size?: number;
  tone?: Tone;
  style?: ViewStyle;
};

export function IconButton({ name, onPress, color, filled, size = 21, tone = "quiet", style }: Props) {
  const fg = color ?? (tone === "glass" ? C.white : tone === "dark" ? C.paper : C.ink);

  const inner = <Icon name={name} size={size} color={fg} filled={filled} />;

  const press = () => {
    if (!onPress) return;
    haptics.tap();
    onPress();
  };

  if (tone === "glass") {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={press} style={[s.btn, s.glassWrap, style]}>
        <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
        {inner}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={press}
      style={[s.btn, tone === "quiet" ? s.quiet : tone === "solid" ? s.solid : s.dark, style]}
    >
      {inner}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  glassWrap: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  quiet: { borderWidth: 1, borderColor: C.ruleMed },
  solid: {
    backgroundColor: C.surface,
    shadowColor: "#17231D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  dark: { backgroundColor: C.ink },
});
