import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import type { DesignLayer } from "@/lib/customize/types";
import { C } from "@/lib/theme";

// One draggable/pinchable/rotatable layer. Transforms live in shared values
// during a gesture so dragging never crosses the JS bridge per frame, and only
// the settled value is committed back to React state on release — that commit
// is also what makes undo/redo one step per gesture rather than per frame.
function DesignLayerViewInner({
  layer,
  scale,
  selected,
  editable,
  onSelect,
  onCommit,
}: {
  layer: DesignLayer;
  // Canonical-space -> screen-space factor for the stage this layer sits in.
  scale: number;
  selected: boolean;
  // The print-capture copy renders the same pixels but must not show selection
  // chrome or respond to touches.
  editable: boolean;
  onSelect: () => void;
  onCommit: (patch: Partial<DesignLayer>) => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const extraScale = useSharedValue(1);
  const extraRot = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      runOnJS(onSelect)();
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd(() => {
      // Convert the screen-space drag back into canonical units before
      // committing, otherwise the same design would land differently
      // depending on the device's screen width.
      runOnJS(onCommit)({ x: layer.x + tx.value / scale, y: layer.y + ty.value / scale });
      tx.value = 0;
      ty.value = 0;
    });

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      extraScale.value = e.scale;
    })
    .onEnd(() => {
      const next = Math.min(6, Math.max(0.2, layer.scale * extraScale.value));
      runOnJS(onCommit)({ scale: next });
      extraScale.value = 1;
    });

  const rotate = Gesture.Rotation()
    .onUpdate((e) => {
      extraRot.value = (e.rotation * 180) / Math.PI;
    })
    .onEnd(() => {
      runOnJS(onCommit)({ rotation: layer.rotation + extraRot.value });
      extraRot.value = 0;
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)();
  });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: extraScale.value },
      { rotate: `${extraRot.value}deg` },
    ],
  }));

  const body = (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: layer.x * scale,
          top: layer.y * scale,
          transform: [{ scale: layer.scale }, { rotate: `${layer.rotation}deg` }],
        },
        style,
      ]}
    >
      <View style={[selected && editable ? s.selected : null]}>
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
      </View>
    </Animated.View>
  );

  if (!editable) return body;

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch, rotate, tap)}>
      {body}
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  selected: {
    borderWidth: 1,
    borderColor: C.forest,
    borderStyle: "dashed",
  },
});

export const DesignLayerView = memo(DesignLayerViewInner);
