import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/lib/theme";

// The system status bar — clock, signal, battery — is drawn by the OS in one of
// two fixed colours, and the app only gets to say which. Every screen that now
// opens on a dark panel was still asking for DARK glyphs, inherited from when
// these screens were cream. The result is the bug you'd expect: the time and
// battery rendered near-black on near-black and effectively disappeared.
//
// Asking for light glyphs alone isn't enough, because the ink panel scrolls
// away — light glyphs would then be invisible against the paper underneath.
// So this pins an ink band exactly the height of the top inset. At rest it is
// indistinguishable from the panel behind it (same colour, and the panel only
// rounds its bottom corners); once you scroll, it remains as a slim tinted
// status strip, which is what keeps the clock legible for the rest of the
// screen's life.
//
// Rendered as a SIBLING of the scroll view, never inside it — anything inside
// would be clipped and scroll away with the content it is meant to outlive.
export function StatusCap() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <StatusBar style="light" />
      <View pointerEvents="none" style={[s.cap, { height: insets.top }]} />
    </>
  );
}

const s = StyleSheet.create({
  cap: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: C.ink, zIndex: 20 },
});
