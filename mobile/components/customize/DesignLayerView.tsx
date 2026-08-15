import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { GestureRef } from "react-native-gesture-handler/lib/typescript/handlers/gestures/gesture";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import type { CustomizationZone } from "@/lib/data";
import type { DesignLayer } from "@/lib/customize/types";
import { C } from "@/lib/theme";

/** Canonical units of a layer that must stay inside the print area. */
const KEEP_INSIDE = 16;
/** On-screen diameter of a drag handle, held constant at every zoom. */
const HANDLE = 22;

const MIN_SCALE = 0.2;
const MAX_SCALE = 6;

// One design layer: drag with one finger, resize and rotate from its corner
// handles.
//
// Two-finger pinch and rotate used to live here. They now belong to the canvas,
// which is zoomable — a pinch had to mean one thing or the other, and "zoom the
// garment" is the gesture people reach for first. Direct-manipulation handles
// replace them, which is also the only way to resize precisely once you have
// zoomed in far enough that both fingers no longer fit on the artwork.
//
// Transforms live in shared values during a gesture so dragging never crosses
// the JS bridge per frame, and only the settled value is committed back to
// React state on release — that commit is also what makes undo/redo one step
// per gesture rather than per frame.
function DesignLayerViewInner({
  layer,
  scale,
  zoom,
  zone,
  canvasGestures,
  selected,
  editable,
  onSelect,
  onCommit,
}: {
  layer: DesignLayer;
  // Canonical-space -> screen-space factor for the stage this layer sits in.
  scale: number;
  /** Canvas zoom, so screen-space gestures convert back correctly. */
  zoom: SharedValue<number>;
  /** Print area, used to keep layers reachable. */
  zone: CustomizationZone;
  /**
   * The stage's own pinch/pan. Declared simultaneous with everything here so a
   * multi-touch gesture that lands on artwork still zooms the canvas instead of
   * being swallowed by the layer.
   */
  canvasGestures?: Exclude<GestureRef, number>[];
  selected: boolean;
  // A non-editable copy renders the same pixels but shows no selection chrome
  // and does not respond to touches.
  editable: boolean;
  onSelect: () => void;
  onCommit: (patch: Partial<DesignLayer>) => void;
}) {
  // Every gesture below opts into running alongside the canvas pinch/pan.
  // Without it the innermost handler wins the arena and multi-touch on artwork
  // is swallowed.
  const withCanvas = <T extends { simultaneousWithExternalGesture: (...g: never[]) => T }>(g: T) =>
    canvasGestures?.length ? g.simultaneousWithExternalGesture(...(canvasGestures as never[])) : g;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const liveScale = useSharedValue(layer.scale);
  const liveRot = useSharedValue(layer.rotation);

  // Rendered size in screen px at zoom 1 and layer scale 1. Text has no
  // authored width, so it can only be measured.
  const [box, setBox] = useState({ w: 0, h: 0 });

  // A layer dragged fully past the print edge is clipped by the zone's
  // `overflow: hidden` and becomes unreachable — invisible, unselectable, and
  // recoverable only by undo. Committing a clamped position keeps a corner of
  // it on the garment so it can always be picked back up.
  function commitDrag(dxCanonical: number, dyCanonical: number) {
    const w = box.w / scale;
    const h = box.h / scale;
    const x = Math.min(
      Math.max(layer.x + dxCanonical, KEEP_INSIDE - w),
      zone.widthPx - KEEP_INSIDE,
    );
    const y = Math.min(
      Math.max(layer.y + dyCanonical, KEEP_INSIDE - h),
      zone.heightPx - KEEP_INSIDE,
    );
    onCommit({ x, y });
  }

  // One finger. Two-finger drags fall through to the canvas pan.
  const pan = withCanvas(Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      runOnJS(onSelect)();
    })
    .onUpdate((e) => {
      // Divided by the canvas zoom: the layer lives inside the zoomed view, so
      // an un-divided translation would move it `zoom`× faster than the finger.
      tx.value = e.translationX / zoom.value;
      ty.value = e.translationY / zoom.value;
    })
    .onEnd(() => {
      // ...and by `scale` again to land back in canonical units, so the same
      // design resolves identically on any screen width.
      runOnJS(commitDrag)(tx.value / scale, ty.value / scale);
      tx.value = 0;
      ty.value = 0;
    }));

  const tap = withCanvas(Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)();
  }));

  // ── Resize ────────────────────────────────────────────────────────────────
  // Drag is projected onto the box's diagonal *in screen space*, so the handle
  // tracks the finger even when the layer is rotated.
  const startScale = useSharedValue(1);
  const resize = withCanvas(Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      startScale.value = layer.scale;
    })
    .onUpdate((e) => {
      const z = zoom.value;
      const w = box.w * startScale.value * z;
      const h = box.h * startScale.value * z;
      const diag = Math.sqrt(w * w + h * h);
      if (diag <= 0) return;
      const a = (layer.rotation * Math.PI) / 180 + Math.atan2(h, w);
      const proj = e.translationX * Math.cos(a) + e.translationY * Math.sin(a);
      liveScale.value = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, startScale.value * (1 + proj / diag)),
      );
    })
    .onEnd(() => {
      runOnJS(onCommit)({ scale: liveScale.value });
    }));

  // ── Rotate ────────────────────────────────────────────────────────────────
  // The angle swept by the handle around the layer's centre.
  const startRot = useSharedValue(0);
  const rotate = withCanvas(Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      startRot.value = layer.rotation;
    })
    .onUpdate((e) => {
      const z = zoom.value;
      const r = (startRot.value * Math.PI) / 180;
      // Top-right corner relative to centre, before the drag.
      const lx = (box.w / 2) * layer.scale * z;
      const ly = (-box.h / 2) * layer.scale * z;
      const v0x = lx * Math.cos(r) - ly * Math.sin(r);
      const v0y = lx * Math.sin(r) + ly * Math.cos(r);
      const v1x = v0x + e.translationX;
      const v1y = v0y + e.translationY;
      const delta = (Math.atan2(v1y, v1x) - Math.atan2(v0y, v0x)) * (180 / Math.PI);
      liveRot.value = startRot.value + delta;
    })
    .onEnd(() => {
      runOnJS(onCommit)({ rotation: liveRot.value });
    }));

  // ONE transform list, carrying both the committed values and the live gesture
  // deltas. These used to be two separate `transform` arrays on the same style
  // array — and RN merges styles per property, so the animated one replaced the
  // committed one outright. `layer.scale` and `layer.rotation` were therefore
  // never rendered: a pinch or twist looked right under the finger, then sprang
  // back the instant it was released, while the server-side renderer applied
  // the values faithfully. The preview and the printed garment disagreed.
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: liveScale.value },
      { rotate: `${liveRot.value}deg` },
    ],
  }));

  // Selection chrome is counter-scaled against both the layer's own scale and
  // the canvas zoom, so handles stay a thumb-sized target and the outline stays
  // a hairline however far in you are.
  const counter = useAnimatedStyle(() => ({
    transform: [{ scale: 1 / (liveScale.value * zoom.value) }],
  }));
  const outline = useAnimatedStyle(() => ({
    borderWidth: 1 / (liveScale.value * zoom.value),
  }));

  const content = (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
      }}
    >
      {layer.kind === "text" ? (
        <Text
          style={{
            fontFamily: layer.fontFamily,
            fontSize: layer.fontSize * scale,
            color: layer.color,
            fontWeight: layer.bold ? "700" : "400",
            fontStyle: layer.italic ? "italic" : "normal",
          }}
        >
          {layer.text}
        </Text>
      ) : (
        <Image
          source={{ uri: layer.uri }}
          style={{ width: layer.width * scale, height: layer.height * scale }}
          contentFit="contain"
          alt=""
        />
      )}

      {selected && editable ? (
        <>
          <Animated.View pointerEvents="none" style={[s.outline, outline]} />
          <GestureDetector gesture={rotate}>
            <Animated.View style={[s.handleSlot, s.topRight, counter]}>
              <View style={[s.handle, s.handleRotate]} />
            </Animated.View>
          </GestureDetector>
          <GestureDetector gesture={resize}>
            <Animated.View style={[s.handleSlot, s.bottomRight, counter]}>
              <View style={s.handle} />
            </Animated.View>
          </GestureDetector>
        </>
      ) : null}
    </View>
  );

  const body = (
    <Animated.View
      style={[{ position: "absolute", left: layer.x * scale, top: layer.y * scale }, style]}
    >
      {content}
    </Animated.View>
  );

  if (!editable) return body;

  return <GestureDetector gesture={Gesture.Simultaneous(pan, tap)}>{body}</GestureDetector>;
}

const s = StyleSheet.create({
  outline: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderColor: C.forest,
    borderStyle: "dashed",
  },
  // The slot is a generous touch target; the visible dot inside it is small.
  handleSlot: {
    position: "absolute",
    width: HANDLE + 16,
    height: HANDLE + 16,
    alignItems: "center",
    justifyContent: "center",
  },
  topRight: { top: -(HANDLE + 16) / 2, right: -(HANDLE + 16) / 2 },
  bottomRight: { bottom: -(HANDLE + 16) / 2, right: -(HANDLE + 16) / 2 },
  handle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.forest,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  handleRotate: { backgroundColor: C.clay },
});

export const DesignLayerView = memo(DesignLayerViewInner);
