import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Rule } from "./Rule";
import { IconButton } from "@/components/ui/IconButton";
import { Meta } from "@/components/ui/Type";
import { C, F, M, S } from "@/lib/theme";

// The controls that sit over a full-bleed hero (product, collection, article).
//
// v4 pinned these absolutely and left them there: scroll past the photograph
// and you had two dark translucent circles floating over body copy, covering
// the text underneath and reading as rendering artefacts. Every one of the
// three hero screens had its own copy of the bug.
//
// This owns the whole behaviour: glass buttons over the image, cross-fading
// into a solid paper bar with quiet buttons (and an optional compact title)
// once the hero has scrolled away. Callers pass a `scrolled` boolean derived
// from their own scroll handler — a plain threshold flip, so this re-renders
// twice per screen rather than every frame.

type Props = {
  scrolled: boolean;
  /** Shown in the compact bar once scrolled. */
  title?: string;
  onBack: () => void;
  /** Right-hand controls. Rendered twice — once per tone — by `renderRight`. */
  renderRight?: (tone: "glass" | "quiet") => ReactNode;
};

export function OverlayHeader({ scrolled, title, onBack, renderRight }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      {scrolled ? (
        <Animated.View
          entering={FadeIn.duration(M.fast)}
          exiting={FadeOut.duration(M.fast)}
          style={[StyleSheet.absoluteFill, s.solid]}
          pointerEvents="none"
        />
      ) : null}

      <View style={s.row} pointerEvents="box-none">
        <IconButton name="arrow_back" tone={scrolled ? "quiet" : "glass"} onPress={onBack} />

        {scrolled && title ? (
          <Animated.View entering={FadeIn.duration(M.base)} style={s.title} pointerEvents="none">
            <Meta color={C.ink} numberOfLines={1} style={s.titleText}>
              {title}
            </Meta>
          </Animated.View>
        ) : null}

        <View style={s.right} pointerEvents="box-none">
          {renderRight?.(scrolled ? "quiet" : "glass")}
        </View>
      </View>

      {scrolled ? (
        <Animated.View entering={FadeIn.duration(M.fast)} exiting={FadeOut.duration(M.fast)}>
          <Rule weight="soft" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 },
  solid: { backgroundColor: C.paper },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.gutter, paddingBottom: 8 },
  // Centred independently of the controls so the title doesn't shift when the
  // right-hand side gains or loses a button.
  title: { position: "absolute", left: 0, right: 0, top: 0, bottom: 8, alignItems: "center", justifyContent: "center" },
  titleText: { fontFamily: F.displayRegular, fontSize: 16, maxWidth: "60%" },
  right: { flexDirection: "row", gap: 8 },
});
