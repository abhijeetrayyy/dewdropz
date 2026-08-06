import { useState } from "react";
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { X } from "lucide-react-native";
import { C, F } from "@/lib/theme";
import { haptics } from "@/lib/haptics";

const { width: W } = Dimensions.get("window");
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
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(2.2);
        savedScale.value = 2.2;
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))}>
      <View style={{ width: W, height: W, alignItems: "center", justifyContent: "center" }}>
        <AnimatedImage source={{ uri }} style={[{ width: W, height: W }, style]} contentFit="contain" alt="" />
      </View>
    </GestureDetector>
  );
}

export function ProductGallery({ images, discountPct }: { images: string[]; discountPct?: number }) {
  const insets = useSafeAreaInsets();
  const list = images.length ? images : [""];
  const [page, setPage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const scrollX = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  return (
    <View>
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
            activeOpacity={0.95}
            onPress={() => {
              haptics.tap();
              setPage(i);
              setLightboxOpen(true);
            }}
            style={s.slide}
          >
            {img ? (
              <Image source={{ uri: img }} style={s.slideImg} contentFit="cover" transition={200} alt="" />
            ) : (
              <View style={s.slidePh}>
                <Text style={s.slidePhT}>DEWDROPZ</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </Animated.ScrollView>

      {discountPct ? (
        <View style={[s.discountBadge, { top: insets.top + 16 }]}>
          <Text style={s.discountT}>-{discountPct}%</Text>
        </View>
      ) : null}

      {list.length > 1 && (
        <View style={s.dots}>
          {list.map((_, i) => (
            <View key={i} style={[s.dot, i === page && s.dotActive]} />
          ))}
        </View>
      )}

      <Modal visible={lightboxOpen} animationType="fade" transparent onRequestClose={() => setLightboxOpen(false)}>
        <View style={s.lightbox}>
          <TouchableOpacity style={s.closeBtn} onPress={() => setLightboxOpen(false)} hitSlop={16}>
            <X size={22} strokeWidth={2} color={C.paper} />
          </TouchableOpacity>
          <Text style={s.counter}>
            {page + 1} / {list.length}
          </Text>
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

const s = StyleSheet.create({
  slide: { width: W, height: W },
  slideImg: { width: W, height: W },
  slidePh: { width: W, height: W, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  slidePhT: { fontFamily: F.mono, fontSize: 10, letterSpacing: 4, color: C.light + "66" },
  discountBadge: { position: "absolute", right: 16, backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  discountT: { fontFamily: F.bodyBold, fontSize: 11, color: C.paper },
  dots: { position: "absolute", bottom: 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.paper + "40" },
  dotActive: { backgroundColor: C.paper, width: 16 },
  lightbox: { flex: 1, backgroundColor: "#000E" },
  closeBtn: { position: "absolute", top: 56, right: 20, zIndex: 10 },
  counter: { position: "absolute", top: 60, left: 20, fontFamily: F.body, fontSize: 12, color: C.paper + "CC", zIndex: 10 },
});
