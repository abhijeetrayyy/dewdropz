import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
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
  /** Required by screen readers — an icon-only control has no text to announce. */
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function IconButton({
  name,
  onPress,
  color,
  filled,
  size = 21,
  tone = "quiet",
  accessibilityLabel,
  style,
}: Props) {
  const fg = color ?? (tone === "glass" ? C.white : tone === "dark" ? C.paper : C.ink);

  const inner = <Icon name={name} size={size} color={fg} filled={filled} />;

  const press = () => {
    if (!onPress) return;
    haptics.tap();
    onPress();
  };

  // A handler-less IconButton is inert, so it's marked disabled rather than
  // left looking pressable — several shipped that way (share, help) and
  // absorbed taps silently.
  const a11y = {
    accessibilityRole: "button" as const,
    accessibilityLabel,
    accessibilityState: { disabled: !onPress },
    disabled: !onPress,
    // The disc is 40pt because 44 looks heavy floating over a photograph, and
    // that was the right call visually — but 40 is under the 44pt minimum, and
    // this is the back button on 19 screens, i.e. the control someone taps most
    // and can least afford to miss. hitSlop extends the target to 48×48 without
    // touching the drawn size. Nothing else sits within 4pt of these buttons
    // (they are corner-pinned, or spaced by S.sm at minimum), so the larger
    // region can't steal a neighbour's tap.
    hitSlop: 4,
  };

  if (tone === "glass") {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={press} style={[s.btn, s.glassWrap, style]} {...a11y}>
        {/* The scrim, not the blur, is what guarantees this control is legible.
            iOS gets real glass from BlurView on top of it. Android gets the
            scrim alone: expo-blur's Android path ('dimezisBlurViewSdk31Plus')
            requires a `blurTarget` ref pointing at a BlurTargetView that wraps
            the content to be blurred — a BlurView cannot simply sample whatever
            is behind it the way iOS's can. Setting `blurMethod` without that
            target silently falls back to no blur AND logs a warning on every
            render, so it is deliberately not set here.
            Verified on a Pixel (API 37): these read as tinted discs over
            photography rather than disappearing, which is the correct
            degradation. Real Android glass needs the BlurTargetView
            architecture, which is worth adopting where it pays for itself —
            a floating tab bar or a sticky header — not on a 40pt button. */}
        <View style={[StyleSheet.absoluteFill, s.glassScrim]} />
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
      {...a11y}
    >
      {inner}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  glassWrap: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  glassScrim: { backgroundColor: "rgba(12,18,15,0.28)" },
  quiet: { borderWidth: 1, borderColor: C.ruleMed },
  solid: {
    backgroundColor: C.surface,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  dark: { backgroundColor: C.ink },
});
