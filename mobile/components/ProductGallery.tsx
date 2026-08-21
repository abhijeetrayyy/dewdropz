import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View , useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Img as Image } from "@/components/ui/Img";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { C, F, R, S } from "@/lib/theme";
import { Icon } from "@/components/ui/Icon";
import { haptics } from "@/lib/haptics";

// NOTE: window size is measured per render via `useWindowDimensions`, never
// captured at module scope with `Dimensions.get()`. A module-scope read happens
// once at import and is then wrong forever — after a rotation, in Android
// split-screen, on a foldable being unfolded, or in an iPad Slide Over. This
// gallery is the worst place for that: page width drives paging maths, so a
// stale W makes swipes land between photos.
const AnimatedImage = Animated.createAnimatedComponent(Image);

function ZoomableImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) reset();
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) reset();
      else {
        scale.value = withTiming(2.2);
        savedScale.value = 2.2;
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const { width: W, height: SCREEN_H } = useWindowDimensions();

  return (
    <GestureDetector gesture={Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))}>
      {/* Full-SCREEN page, not a W×W square. The square version pinned every
          photo to the top of the lightbox: a horizontal ScrollView stretches
          to fill its parent's height, so a square child sits at the top of it
          and the parent's `justifyContent: center` never applied to the image
          at all. Sizing the page to the viewport also lets tall product shots
          (4:5, 3:4) use the whole screen instead of being letterboxed into a
          square that wasted a third of the height. */}
      <View style={{ width: W, height: SCREEN_H, alignItems: "center", justifyContent: "center" }}>
        <AnimatedImage
          source={{ uri }}
          style={[{ width: W, height: SCREEN_H }, style]}
          contentFit="contain"
          alt=""
        />
      </View>
    </GestureDetector>
  );
}

// v4 paginated with five white dots at the bottom centre — the default control
// from every app template, and unreadable over a light garment photo.
//
// v5 uses a printed-contact-sheet convention instead: a mono "01/04" counter
// and a segmented progress rule, both sitting in the bottom-left where the
// gradient scrim already guarantees contrast. The segments are driven off
// scrollX so they track the drag continuously rather than snapping on
// momentum end.

type Props = { images: string[]; discountPct?: number; isNew?: boolean };

export function ProductGallery({ images, discountPct, isNew }: Props) {
  const insets = useSafeAreaInsets();
  const { width: W, height: SCREEN_H } = useWindowDimensions();
  const GALLERY_H = Math.round(SCREEN_H * 0.6);
  const list = images.length ? images : [""];
  const [page, setPage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const scrollX = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const badge = discountPct ? { label: `−${discountPct}%`, bg: C.rust, fg: C.paper } : isNew ? { label: "NEW", bg: C.ink, fg: C.paper } : null;

  return (
    <View style={[s.wrap, { height: GALLERY_H }]}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}
      >
        {list.map((img, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.97}
            onPress={() => {
              if (!img) return;
              haptics.tap();
              setPage(i);
              setLightboxOpen(true);
            }}
            style={{ width: W, height: GALLERY_H }}
          >
            {img ? (
              // Slide 0 settles in from very slightly oversized rather than
              // cutting straight to its final frame, so arriving from a grid
              // card reads as the photograph coming to rest.
              //
              // This is deliberately NOT a shared-element transition. Reanimated
              // 4.5.1 ships `sharedTransitionTag` behind a STATIC feature flag
              // (`ENABLE_SHARED_ELEMENT_TRANSITIONS`) that is compiled into the
              // native binary as false — verified in the build's own compiler
              // flags. Enabling it means patching node_modules and rebuilding,
              // so tagging views here would add props that silently do nothing.
              <ArrivingSlide isLead={i === 0} width={W} height={GALLERY_H}>
                <Image source={{ uri: img }} style={{ width: W, height: GALLERY_H }} contentFit="cover" transition={220} alt="" />
              </ArrivingSlide>
            ) : (
              <View style={[s.slidePh, { width: W, height: GALLERY_H }]}>
                <Text style={s.slidePhT}>DEWDROPZ</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </Animated.ScrollView>

      {badge ? (
        <View style={[s.badge, { backgroundColor: badge.bg, top: insets.top + 62 }]}>
          <Text style={[s.badgeT, { color: badge.fg }]}>{badge.label}</Text>
        </View>
      ) : null}

      {/* The counter and its scrim only earn their place when there's more
          than one frame — "01 / 01" over a single photograph is furniture
          describing nothing, and the scrim needlessly darkens the garment. */}
      {list.length > 1 ? (
        <>
          <View style={s.scrim} pointerEvents="none" />
          <View style={s.meter} pointerEvents="none">
            <Text style={s.counter}>
              {String(page + 1).padStart(2, "0")}
              <Text style={s.counterTotal}> / {String(list.length).padStart(2, "0")}</Text>
            </Text>
            <View style={s.segments}>
              {list.map((_, i) => (
                <Segment key={i} index={i} scrollX={scrollX} />
              ))}
            </View>
          </View>
          <View style={[s.zoomHint, { top: insets.top + 62 }]} pointerEvents="none">
            <Icon name="zoom_in" size={15} color={C.paper} />
          </View>
        </>
      ) : null}

      <Modal visible={lightboxOpen} animationType="fade" transparent onRequestClose={() => setLightboxOpen(false)}>
        <View style={s.lightbox}>
          <Text style={[s.lbCounter, { top: insets.top + 18 }]}>
            {String(page + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}
          </Text>
          <TouchableOpacity
            style={[s.closeBtn, { top: insets.top + 10 }]}
            onPress={() => setLightboxOpen(false)}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Close the photo"
          >
            <Icon name="close" size={22} color={C.paper} />
          </TouchableOpacity>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: page * W, y: 0 }}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}
          >
            {list.map((img, i) => (
              <ZoomableImage key={i} uri={img} />
            ))}
          </Animated.ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/**
 * The lead slide settles in from ~6% oversized instead of cutting to its final
 * frame, so arriving from a grid card reads as the photograph coming to rest
 * rather than the screen swapping under you.
 *
 * A canned `ZoomIn` is wrong here — it starts at scale 0, which is an entrance,
 * not a settle. The point is that the image is already there and only finishes
 * moving.
 */
function ArrivingSlide({
  isLead,
  width,
  height,
  children,
}: {
  isLead: boolean;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(isLead ? 1.06 : 1);
  useEffect(() => {
    if (!isLead) return;
    scale.value = withTiming(1, { duration: 420, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [isLead, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={[{ width, height, overflow: "hidden" }, style]}>{children}</Animated.View>;
}

function Segment({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const { width: W } = useWindowDimensions();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(index - 1) * W, index * W, (index + 1) * W],
      [0.3, 1, 0.3],
      Extrapolation.CLAMP,
    ),
  }));
  return <Animated.View style={[s.segment, style]} />;
}

const s = StyleSheet.create({
  wrap: { overflow: "hidden", backgroundColor: C.sand },
  slidePh: { backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  slidePhT: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 4, color: "rgba(251,247,239,0.35)" },
  badge: { position: "absolute", left: S.gutter, borderRadius: R.tag, paddingHorizontal: 8, paddingVertical: 4 },
  badgeT: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1 },
  zoomHint: {
    position: "absolute",
    right: S.gutter,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(23,35,29,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 110, backgroundColor: "rgba(12,18,15,0.22)" },
  meter: { position: "absolute", left: S.gutter, bottom: S.lg, gap: 9 },
  counter: { fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1.4, color: C.paper },
  counterTotal: { fontFamily: F.mono, color: "rgba(251,247,239,0.65)" },
  segments: { flexDirection: "row", gap: 4 },
  segment: { width: 22, height: 2, backgroundColor: C.paper },
  lightbox: { flex: 1, backgroundColor: "#000E", justifyContent: "center" },
  closeBtn: { position: "absolute", right: 20, zIndex: 10 },
  lbCounter: { position: "absolute", left: 20, fontFamily: F.mono, fontSize: 11, letterSpacing: 1.4, color: "rgba(251,247,239,0.8)", zIndex: 10 },
});
