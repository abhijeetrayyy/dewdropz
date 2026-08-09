import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { CustomizationZone } from "@/lib/data";
import type { DesignLayer } from "@/lib/customize/types";
import { DesignLayerView } from "./DesignLayerView";
import { resolveAssetUrl } from "@/lib/customize/assetUrl";
import { C, F, R } from "@/lib/theme";

// Zones are authored against a mockup rendered at this reference width, so
// every x/y/size in a zone is in these units regardless of device screen size.
export const CANONICAL_WIDTH = 800;

// The supplied mockups are all 2528x1696. Exporting the preview at the
// canonical width keeps mobile previews the same 800x537 as the web studio's,
// so cart thumbnails from either platform sit together without one looking off.
export const MOCKUP_ASPECT = 1696 / 2528;

// The print file is rendered at a multiple of the zone's canonical size so
// text stays crisp rather than being pinned to on-screen pixel density.
export const PRINT_SCALE = 3;

// The garment photo with the print-safe area overlaid exactly where admin drew
// it. `overflow: hidden` on the zone *is* the print boundary — dragging a layer
// past the edge clips it, which matches what the printer would actually do.
export function CustomizeStage({
  zone,
  side,
  layers,
  stageWidth,
  selectedId,
  focused,
  onFocus,
  onSelect,
  onCommit,
}: {
  zone: CustomizationZone;
  side: "front" | "back";
  layers: DesignLayer[];
  stageWidth: number;
  selectedId: string | null;
  focused: boolean;
  onFocus: () => void;
  onSelect: (id: string | null) => void;
  onCommit: (id: string, patch: Partial<DesignLayer>) => void;
}) {
  const scale = stageWidth / CANONICAL_WIDTH;

  return (
    <View
      onTouchStart={onFocus}
      style={[
        s.stage,
        { width: stageWidth, height: stageWidth * MOCKUP_ASPECT },
        focused ? s.focused : null,
      ]}
    >
      <Image source={{ uri: resolveAssetUrl(zone.mockupImage) }} style={StyleSheet.absoluteFill} contentFit="cover" alt="" />

      <View style={s.badge}>
        <Text style={s.badgeT}>{side === "front" ? "Front" : "Back"}</Text>
      </View>

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
        {layers.map((l) => (
          <DesignLayerView
            key={l.id}
            layer={l}
            scale={scale}
            selected={selectedId === l.id}
            editable
            onSelect={() => onSelect(l.id)}
            onCommit={(patch) => onCommit(l.id, patch)}
          />
        ))}
      </View>
    </View>
  );
}

// Off-screen surfaces that exist purely to be rasterized. They deliberately
// render no badge, no dashed boundary and no selection chrome, so none of the
// studio's editing affordances leak into a print file or a cart thumbnail.
//
// `variant: "print"` is the artwork alone on transparency — what the printer
// receives. `variant: "preview"` is the same artwork composited over the
// garment photo — what the shopper sees in their cart.
export const ExportSurface = forwardRef<View, {
  zone: CustomizationZone;
  layers: DesignLayer[];
  variant: "print" | "preview";
}>(function ExportSurface({ zone, layers, variant }, ref) {
  if (variant === "print") {
    return (
      <View
        ref={ref}
        collapsable={false}
        style={{
          width: zone.widthPx * PRINT_SCALE,
          height: zone.heightPx * PRINT_SCALE,
          backgroundColor: "transparent",
          overflow: "hidden",
        }}
      >
        {layers.map((l) => (
          <DesignLayerView
            key={l.id}
            layer={l}
            scale={PRINT_SCALE}
            selected={false}
            editable={false}
            onSelect={() => {}}
            onCommit={() => {}}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ width: CANONICAL_WIDTH, height: CANONICAL_WIDTH * MOCKUP_ASPECT, overflow: "hidden" }}
    >
      <Image source={{ uri: resolveAssetUrl(zone.mockupImage) }} style={StyleSheet.absoluteFill} contentFit="cover" alt="" />
      <View
        style={{
          position: "absolute",
          left: zone.x,
          top: zone.y,
          width: zone.widthPx,
          height: zone.heightPx,
          overflow: "hidden",
        }}
      >
        {layers.map((l) => (
          <DesignLayerView
            key={l.id}
            layer={l}
            scale={1}
            selected={false}
            editable={false}
            onSelect={() => {}}
            onCommit={() => {}}
          />
        ))}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  stage: { borderRadius: R.md, overflow: "hidden", backgroundColor: C.rule },
  focused: { borderWidth: 2, borderColor: C.forest },
  badge: {
    position: "absolute", left: 10, top: 10,
    backgroundColor: C.ink + "B3", paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.sm,
  },
  badgeT: {
    fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5,
    textTransform: "uppercase", color: C.paper,
  },
  zone: {
    position: "absolute", overflow: "hidden",
    borderWidth: 1, borderColor: C.forest + "80", borderStyle: "dashed",
  },
});
