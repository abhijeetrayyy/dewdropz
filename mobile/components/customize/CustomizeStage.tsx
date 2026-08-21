import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
// Both: `Image.loadAsync` is a static on expo-image and has no component
// equivalent, while the rendered mockup wants the wrapper's failure state —
// a garment that does not load is the whole screen on this one.
import { Image as ExpoImage } from "expo-image";
import { Img as Image } from "@/components/ui/Img";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Rect } from "react-native-svg";
import type { CustomizationZone } from "@/lib/data";
import type { DesignLayer } from "@/lib/customize/types";
import { DesignLayerView } from "./DesignLayerView";
import { resolveAssetUrl } from "@/lib/customize/assetUrl";
import { C, F, M, R } from "@/lib/theme";

// Zones are authored against a mockup rendered at this reference width, so
// every x/y/size in a zone is in these units regardless of device screen size.
export const CANONICAL_WIDTH = 800;

// The garment's height as a multiple of its width, MEASURED from the mockup —
// never assumed.
//
// This used to be a constant, `1696 / 2528` (landscape 3:2), described as "the
// supplied mockups are all 2528x1696". The mockups actually shipped are
// 1080x1350 — PORTRAIT 4:5 — and the consequences were exactly what you'd
// expect from telling a portrait photo it is landscape:
//
//   • the stage box was far too short, so `contentFit: cover` scaled the
//     garment up and cropped its top and bottom away;
//   • zone coordinates are authored against a canvas 800x1000 canonical units
//     tall, but were being laid out inside one 537 tall, so the print area
//     landed high and, on the hoodie back (y=330, h=292 → 622), fell almost
//     entirely outside the box and was clipped by `overflow: hidden`;
//   • the exported preview was composited at 800x537 while the server-side
//     renderer (lib/customize/renderDesign.ts) uses the real ratio, so mobile
//     cart thumbnails never matched what was actually printed.
//
// The web studio never had this bug because it never guessed: CanvasStage.tsx
// derives `canonicalHeight` from `img.naturalHeight / img.naturalWidth`, and
// both compositePreview.ts and renderDesign.ts do the same. This is the mobile
// equivalent of that, so all three surfaces agree.
export const DEFAULT_MOCKUP_ASPECT = 1350 / 1080;

export const MAX_ZOOM = 6;

/**
 * Resolves a mockup's true height/width ratio, falling back to the 4:5 every
 * current asset uses until the real image reports its size.
 */
export function useMockupAspect(mockupImage: string | undefined | null) {
  const [aspect, setAspect] = useState(DEFAULT_MOCKUP_ASPECT);
  const uri = resolveAssetUrl(mockupImage);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    ExpoImage.loadAsync(uri)
      .then((ref) => {
        if (cancelled || !ref?.width || !ref?.height) return;
        setAspect(ref.height / ref.width);
      })
      .catch(() => {
        // Keep the default — a wrong-but-sane box beats an unrendered stage.
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return aspect;
}

// The garment photo with the print-safe area overlaid exactly where admin drew
// it, on a canvas you can zoom into.
//
// The zone and every design layer are CHILDREN of the same transformed view as
// the photograph, so zooming moves all three by construction — the print
// boundary cannot drift off the garment no matter how far in you go, because
// nothing recomputes its position on zoom. Only one transform exists.
//
// Gesture allocation, chosen so nothing is ambiguous:
//   two fingers  → the canvas   (pinch to zoom, drag to pan)
//   one finger   → a layer      (drag to move; corner handles resize/rotate)
//   double tap   → toggle between fit and 2.5x, anchored where you tapped
export function CustomizeStage({
  zone,
  side,
  layers,
  stageWidth,
  aspect,
  selectedId,
  zoom,
  onZoomChange,
  centerOn,
  onSelect,
  onCommit,
}: {
  zone: CustomizationZone;
  side: "front" | "back";
  layers: DesignLayer[];
  stageWidth: number;
  /** Measured height/width of this mockup — see `useMockupAspect`. */
  aspect: number;
  selectedId: string | null;
  /** Canvas zoom factor, owned here and mirrored out for the toolbar. */
  zoom: SharedValue<number>;
  onZoomChange: (z: number) => void;
  /**
   * Zone-relative point to bring into view, re-applied whenever `nonce`
   * changes. Adding a layer while zoomed in would otherwise drop it somewhere
   * outside the viewport with no clue that anything had happened.
   */
  centerOn?: { x: number; y: number; nonce: number };
  onSelect: (id: string | null) => void;
  onCommit: (id: string, patch: Partial<DesignLayer>) => void;
}) {
  const scale = stageWidth / CANONICAL_WIDTH;
  const stageHeight = stageWidth * aspect;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startZoom = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Pan bounds: at any zoom the scaled content must still cover the frame, so
  // the garment can never be dragged away leaving blank paper behind it.
  function clampX(v: number, z: number) {
    "worklet";
    const min = stageWidth - stageWidth * z;
    return Math.min(0, Math.max(min, v));
  }
  function clampY(v: number, z: number) {
    "worklet";
    const min = stageHeight - stageHeight * z;
    return Math.min(0, Math.max(min, v));
  }

  // Anchored zoom: the point under the fingers stays under the fingers.
  // With `transformOrigin: top left`, screen = t + z · content, so holding
  // `content` fixed across a zoom change gives t' = f − (z'/z)(f − t).
  function zoomTo(z: number, focalX: number, focalY: number) {
    "worklet";
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    const ratio = next / zoom.value;
    tx.value = clampX(focalX - ratio * (focalX - tx.value), next);
    ty.value = clampY(focalY - ratio * (focalY - ty.value), next);
    zoom.value = next;
  }

  // Opening a tool panel resizes the stage, which moves the pan bounds under
  // whatever translation was already applied — without this the garment can end
  // up parked off its own frame with paper showing behind it.
  useEffect(() => {
    tx.value = clampX(tx.value, zoom.value);
    ty.value = clampY(ty.value, zoom.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageWidth, stageHeight]);

  // Bring a zone-relative point to the middle of the frame at the current zoom.
  useEffect(() => {
    if (!centerOn) return;
    const z = zoom.value;
    const px = (zone.x + centerOn.x) * scale;
    const py = (zone.y + centerOn.y) * scale;
    tx.value = withTiming(clampX(stageWidth / 2 - px * z, z), { duration: M.base });
    ty.value = withTiming(clampY(stageHeight / 2 - py * z, z), { duration: M.base });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerOn?.nonce]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startZoom.value = zoom.value;
    })
    .onUpdate((e) => {
      zoomTo(startZoom.value * e.scale, e.focalX, e.focalY);
    })
    .onEnd(() => {
      runOnJS(onZoomChange)(zoom.value);
    });

  // Two fingers only. A one-finger drag belongs to whatever layer is under it;
  // letting the canvas claim it too would make every layer drag a coin toss.
  const pan = Gesture.Pan()
    .minPointers(2)
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = clampX(startX.value + e.translationX, zoom.value);
      ty.value = clampY(startY.value + e.translationY, zoom.value);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      const target = zoom.value > 1.05 ? 1 : 2.5;
      if (target === 1) {
        zoom.value = withTiming(1, { duration: M.base });
        tx.value = withTiming(0, { duration: M.base });
        ty.value = withTiming(0, { duration: M.base });
      } else {
        zoomTo(target, e.x, e.y);
      }
      runOnJS(onZoomChange)(target);
    });

  // Single tap on the garment, away from any layer, drops the selection.
  const tapAway = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onSelect)(null);
    });

  // The two multi-touch canvas gestures, handed to every layer so a pinch that
  // begins on artwork still reaches the canvas.
  const canvasPointerGestures = [pinch, pan];

  const canvasGesture = Gesture.Simultaneous(
    pinch,
    pan,
    Gesture.Exclusive(doubleTap, tapAway),
  );

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: zoom.value }],
  }));

  return (
    <GestureDetector gesture={canvasGesture}>
      <View style={[s.frame, { width: stageWidth, height: stageHeight }]}>
        <Animated.View
          style={[
            { width: stageWidth, height: stageHeight, transformOrigin: "top left" },
            canvasStyle,
          ]}
        >
          <Image
            source={{ uri: resolveAssetUrl(zone.mockupImage) }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={180}
            alt=""
          />

          <View
            style={[
              s.zone,
              {
                left: zone.x * scale,
                top: zone.y * scale,
                width: zone.widthPx * scale,
                height: zone.heightPx * scale,
              },
            ]}
          >
            {/* Two coincident outlines, light under dark, so the boundary reads
                on a black hoodie and a white tee alike. Both are counter-scaled
                against the canvas zoom so the rule stays hairline-thin however
                far in you go, instead of swelling into a fat band. */}
            <ZoneEdge zoom={zoom} />

            {layers.map((l) => (
              <DesignLayerView
                key={l.id}
                layer={l}
                scale={scale}
                zoom={zoom}
                zone={zone}
                // Without this the layer's own gestures win the arena outright
                // and a two-finger pinch STARTED ON THE ARTWORK does nothing —
                // you could only zoom by finding bare fabric first, which is
                // exactly the moment you most want to zoom.
                canvasGestures={canvasPointerGestures}
                selected={selectedId === l.id}
                editable
                onSelect={() => onSelect(l.id)}
                onCommit={(patch) => onCommit(l.id, patch)}
              />
            ))}
          </View>

          {layers.length === 0 ? (
            <View
              pointerEvents="none"
              style={[
                s.hint,
                {
                  left: zone.x * scale,
                  top: (zone.y + zone.heightPx / 2) * scale - 11,
                  width: zone.widthPx * scale,
                },
              ]}
            >
              {/* 9pt mono at 2pt tracking is ~78pt wide, so on a short garment
                  or a taller tool panel the zone narrows past it and the label
                  spills over the print boundary it exists to describe. It is a
                  hint, not information — the dashed rule already draws the
                  zone — so it shrinks to fit rather than wrapping or clipping. */}
              <Text style={s.hintT} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                PRINT AREA
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Outside the zoom transform, so it stays put and stays legible. */}
        <View pointerEvents="none" style={s.badge}>
          <Text style={s.badgeT}>{side === "front" ? "Front" : "Back"}</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** The print boundary, drawn at a constant on-screen weight at any zoom. */
function ZoneEdge({ zoom }: { zoom: SharedValue<number> }) {
  const halo = useAnimatedStyle(() => ({ borderWidth: 2 / zoom.value }));
  const tick = useAnimatedStyle(() => ({
    width: 13 / zoom.value,
    height: 13 / zoom.value,
    borderWidth: 2 / zoom.value,
  }));

  // The dashes, and the dash gaps, hold their on-screen size at any zoom for
  // the same reason the stroke does: this is a measuring mark, not artwork.
  const edge = useAnimatedProps(() => {
    const w = 1 / zoom.value;
    const d = 5 / zoom.value;
    return { strokeWidth: w, strokeDasharray: [d, d] };
  });

  return (
    <>
      <Animated.View pointerEvents="none" style={[s.zoneHalo, halo]} />
      {/* Drawn as an SVG stroke rather than a View's `borderStyle: "dashed"`,
          which is an iOS-only effect in practice. Android draws dashes through
          a Path effect that needs a whole-pixel border, and this border is
          `1 / zoom` — fractional by design, so the dashes fall below a pixel
          and Android silently renders the whole rectangle SOLID.
          That is not cosmetic here: dashes are what say "guide", and a solid
          rectangle sitting on a garment reads as a frame that will be printed
          — the exact thing a shopper must not believe about a print boundary.
          An SVG stroke dashes identically on both platforms and is happy with
          fractional widths. */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
        <AnimatedRect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="none"
          stroke="rgba(16,21,18,0.75)"
          animatedProps={edge}
        />
      </Svg>
      {CORNERS.map((corner, i) => (
        <Animated.View key={i} pointerEvents="none" style={[s.corner, corner, tick]} />
      ))}
    </>
  );
}

// Corner ticks sit on the dashed edge, the way a crop mark does.
const CORNERS = [
  { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
] as const;

// NOTE: an `ExportSurface` component lived here — off-screen views meant to be
// rasterized into a print file and a cart thumbnail on-device. Nothing ever
// rendered it: saving posts structured layer data to /api/mobile/designs and
// the SERVER rasterizes (lib/customize/save.ts), deliberately, so an iPhone and
// an Android phone produce byte-identical print files. It was ~60 lines of dead
// code carrying its own copy of the mockup-aspect bug fixed above.

const s = StyleSheet.create({
  frame: { borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  badge: {
    position: "absolute", left: 10, top: 10,
    backgroundColor: C.ink + "B3", paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.tag,
  },
  badgeT: {
    fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5,
    textTransform: "uppercase", color: C.paper,
  },
  // `overflow: hidden` here IS the print boundary — a layer dragged past the
  // edge clips exactly as the press would trim it.
  zone: { position: "absolute", overflow: "hidden" },
  zoneHalo: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderColor: "rgba(255,255,255,0.55)",
  },
  corner: { position: "absolute", borderColor: C.forest },
  // `alignItems: "center"` would size the label to its own content, leaving
  // `adjustsFontSizeToFit` no width to shrink into — the child has to be
  // stretched to the zone's width and centre its own text for the fit to bite.
  hint: { position: "absolute", alignItems: "stretch" },
  hintT: {
    fontFamily: F.monoBold, fontSize: 9, letterSpacing: 2,
    color: "rgba(255,255,255,0.85)", textAlign: "center",
  },
});
