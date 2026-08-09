import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ArrowRight } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useProductQuery } from "@/lib/queries";
import { useCartStore } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { toast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CustomizeStage } from "@/components/customize/CustomizeStage";
import { StudioToolbar } from "@/components/customize/StudioToolbar";
import { saveDesign, uploadPickedImage } from "@/lib/customize/save";
import {
  DesignLayer, DesignState, EMPTY_DESIGN, SideKey, defaultInkFor, newId,
} from "@/lib/customize/types";
import type { CustomizationColorway } from "@/lib/data";
import { C, F, R } from "@/lib/theme";

const { width: W } = Dimensions.get("window");

export default function CustomizeScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: product, isLoading, isError } = useProductQuery(slug);
  const { addItem } = useCartStore();

  const colors = useMemo<CustomizationColorway[]>(
    () => product?.customization_config?.colors ?? [],
    [product]
  );
  // Land on something the shopper can actually order rather than a
  // coming-soon colour they'd have to notice and move off.
  const firstAvailable = colors.findIndex((c) => c.available);
  const [colorIndex, setColorIndex] = useState(firstAvailable >= 0 ? firstAvailable : 0);
  const color = colors[colorIndex];

  const variants = product?.variants ?? [];
  const [variantId, setVariantId] = useState<string>("");
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];

  const [activeSide, setActiveSide] = useState<SideKey>("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Undo/redo over whole-design snapshots. Every mutation goes through
  // `commit`, so history is one entry per user action — not per frame of a drag.
  const [history, setHistory] = useState<DesignState[]>([EMPTY_DESIGN]);
  const [cursor, setCursor] = useState(0);
  const design = history[cursor];

  const commit = useCallback((next: DesignState) => {
    setHistory((h) => [...h.slice(0, cursor + 1), next]);
    setCursor((c) => c + 1);
  }, [cursor]);

  const sides = useMemo<SideKey[]>(
    () => (["front", "back"] as SideKey[]).filter((sd) => color?.[sd]),
    [color]
  );
  const twoSided = sides.length > 1;
  const effectiveSide: SideKey = sides.includes(activeSide) ? activeSide : (sides[0] ?? "front");
  const layers = design[effectiveSide];
  const selected = layers.find((l) => l.id === selectedId) ?? null;


  function patchSide(side: SideKey, mutate: (list: DesignLayer[]) => DesignLayer[]) {
    commit({ ...design, [side]: mutate(design[side]) });
  }

  function addText() {
    haptics.tap();
    const zone = color?.[effectiveSide];
    if (!zone) return;
    // Size the placeholder to the zone rather than using a fixed value —
    // print areas vary a lot between blanks (the tee's is 114 canonical px
    // wide, the hoodie's 185), and a fixed 42pt started out already clipped
    // by the zone's right edge on the narrower ones.
    const fontSize = Math.round(Math.min(64, Math.max(14, zone.widthPx / 6)));
    const layer: DesignLayer = {
      kind: "text",
      id: newId(),
      text: "Your text",
      fontFamily: "Inter_400Regular",
      fontSize,
      color: defaultInkFor(color?.hex),
      bold: false,
      italic: false,
      x: zone.widthPx * 0.08,
      y: zone.heightPx * 0.42,
      scale: 1,
      rotation: 0,
    };
    patchSide(effectiveSide, (l) => [...l, layer]);
    setSelectedId(layer.id);
  }

  async function addImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Photo access is needed to add an image.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (res.canceled || !res.assets?.[0]) return;

    const asset = res.assets[0];
    const zone = color?.[effectiveSide];
    if (!zone) return;

    setUploading(true);
    try {
      // Upload immediately rather than at save time: the layer has to hold a
      // fetchable URL for the server-side renderer, and doing it here means the
      // shopper finds out about a failed upload while they're still choosing,
      // not after they've finished designing.
      const uri = await uploadPickedImage(asset.uri);

      // Fit the longest edge to ~70% of the zone so a large photo lands
      // usable instead of overflowing the print area on arrival.
      const srcW = asset.width ?? zone.widthPx;
      const srcH = asset.height ?? zone.heightPx;
      const target = Math.min(zone.widthPx, zone.heightPx) * 0.7;
      const fit = target / Math.max(srcW, srcH);
      const w = srcW * fit;
      const h = srcH * fit;

      const layer: DesignLayer = {
        kind: "image",
        id: newId(),
        uri,
        width: w,
        height: h,
        x: (zone.widthPx - w) / 2,
        y: (zone.heightPx - h) / 2,
        scale: 1,
        rotation: 0,
      };
      patchSide(effectiveSide, (l) => [...l, layer]);
      setSelectedId(layer.id);
      haptics.select();
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : "Could not add that image.");
    } finally {
      setUploading(false);
    }
  }

  function patchSelected(patch: Partial<DesignLayer>) {
    if (!selectedId) return;
    patchSide(effectiveSide, (l) =>
      l.map((x) => (x.id === selectedId ? ({ ...x, ...patch } as DesignLayer) : x))
    );
  }

  function reorder(dir: "up" | "down") {
    if (!selectedId) return;
    haptics.select();
    patchSide(effectiveSide, (l) => {
      const i = l.findIndex((x) => x.id === selectedId);
      const j = dir === "up" ? i + 1 : i - 1;
      if (i < 0 || j < 0 || j >= l.length) return l;
      const copy = [...l];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function copyToOtherSide() {
    const other: SideKey = effectiveSide === "front" ? "back" : "front";
    if (!color?.[other]) {
      toast.error(`This colour has no ${other} print area.`);
      return;
    }
    if (layers.length === 0) {
      toast.error(`Nothing on the ${effectiveSide} to copy yet.`);
      return;
    }
    haptics.tap();
    commit({ ...design, [other]: layers.map((l) => ({ ...l, id: newId() })) });
    toast.success(`Copied to ${other}`);
  }

  async function handleSave() {
    if (!product || !color) return;
    if (variants.length > 0 && !variant) {
      toast.error("Pick a size first.");
      return;
    }
    if (!color.available) {
      toast.error(`${color.name} isn't available yet — pick another colour.`);
      return;
    }

    setSaving(true);
    try {
      const result = await saveDesign({
        productId: product.id,
        variantId: variant?.id ?? null,
        colorName: color.name,
        colorHex: color.hex,
        front: color.front ? design.front : [],
        back: color.back ? design.back : [],
      });

      addItem({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price + (variant?.price_adjustment ?? 0),
        image: result.previewUrl ?? product.images?.[0] ?? "",
        size: variant?.name,
        variantId: variant?.id ?? null,
        customDesignId: result.designId,
        colorName: color.name,
      });

      haptics.success();
      toast.success("Added your design to the cart");
      router.replace("/cart");
    } catch (err) {
      haptics.error();
      toast.error(err instanceof Error ? err.message : "Could not save your design.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={s.root}>
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton height={16} width="40%" />
          <Skeleton height={W - 40} radius={R.md} />
        </View>
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={s.root}>
        <EmptyState title="Product not found" body="This item may have been removed." />
      </View>
    );
  }

  if (!product.is_customizable || colors.length === 0 || sides.length === 0) {
    return (
      <View style={s.root}>
        <EmptyState
          title="Not customizable yet"
          body="This product doesn't have print areas set up, so there's nothing to design on."
        />
      </View>
    );
  }

  const stageWidth = twoSided ? Math.min(W - 40, 420) : Math.min(W - 40, 460);
  const hasAnything = design.front.length > 0 || design.back.length > 0;

  return (
    <View style={s.root}>
      <ScrollView
        // Opaque on purpose: it's what hides the capture layer sitting behind
        // it. A transparent scroll view would let those surfaces show through.
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.pickers}>
          <Text style={s.lbl}>Colour</Text>
          <View style={s.swatchRow}>
            {colors.map((c, i) => (
              <TouchableOpacity
                key={c.name}
                disabled={!c.available}
                onPress={() => { haptics.select(); setColorIndex(i); setSelectedId(null); }}
                accessibilityLabel={c.available ? c.name : `${c.name}, coming soon`}
                style={[
                  s.swatch,
                  { backgroundColor: c.hex },
                  colorIndex === i && s.swatchOn,
                  !c.available && s.swatchOff,
                ]}
              />
            ))}
            <Text style={s.colorName}>
              {color?.name}
              {color && !color.available ? " · coming soon" : ""}
            </Text>
          </View>

          {variants.length > 0 && (
            <>
              <Text style={[s.lbl, { marginTop: 14 }]}>Size</Text>
              <View style={s.swatchRow}>
                {variants.map((v) => {
                  const oos = (v.inventory_quantity ?? 1) <= 0;
                  const on = (variant?.id ?? "") === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      disabled={oos}
                      onPress={() => { haptics.select(); setVariantId(v.id); }}
                      style={[s.size, on && s.sizeOn, oos && s.sizeOff]}
                    >
                      <Text style={[s.sizeT, on && s.sizeTOn]}>{v.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {twoSided && (
          <View style={s.sideTabs}>
            {sides.map((sd) => (
              <TouchableOpacity
                key={sd}
                onPress={() => { haptics.select(); setActiveSide(sd); setSelectedId(null); }}
                style={[s.sideTab, effectiveSide === sd && s.sideTabOn]}
              >
                <Text style={[s.sideTabT, effectiveSide === sd && s.sideTabTOn]}>
                  {sd === "front" ? "Front" : "Back"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Animated.View entering={FadeInDown.springify().damping(18)} style={s.stageWrap}>
          {color?.[effectiveSide] ? (
            <CustomizeStage
              zone={color[effectiveSide]!}
              side={effectiveSide}
              layers={layers}
              stageWidth={stageWidth}
              selectedId={selectedId}
              focused={false}
              onFocus={() => {}}
              onSelect={setSelectedId}
              onCommit={(id, patch) =>
                patchSide(effectiveSide, (l) =>
                  l.map((x) => (x.id === id ? ({ ...x, ...patch } as DesignLayer) : x))
                )
              }
            />
          ) : null}
          <TouchableOpacity style={s.deselect} onPress={() => setSelectedId(null)} activeOpacity={1}>
            <Text style={s.deselectT}>
              {selected ? "Tap here to deselect" : `${layers.length} layer${layers.length === 1 ? "" : "s"}`}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <StudioToolbar
          selected={selected}
          twoSided={twoSided}
          activeSide={effectiveSide}
          uploading={uploading}
          canUndo={cursor > 0}
          canRedo={cursor < history.length - 1}
          onAddText={addText}
          onAddImage={addImage}
          onUndo={() => { haptics.select(); setCursor((c) => Math.max(0, c - 1)); setSelectedId(null); }}
          onRedo={() => { haptics.select(); setCursor((c) => Math.min(history.length - 1, c + 1)); setSelectedId(null); }}
          onPatch={patchSelected}
          onDelete={() => {
            haptics.warning();
            patchSide(effectiveSide, (l) => l.filter((x) => x.id !== selectedId));
            setSelectedId(null);
          }}
          onDuplicate={() => {
            if (!selected) return;
            haptics.tap();
            const clone = { ...selected, id: newId(), x: selected.x + 12, y: selected.y + 12 };
            patchSide(effectiveSide, (l) => [...l, clone]);
            setSelectedId(clone.id);
          }}
          onReorder={reorder}
          onCopyToOtherSide={copyToOtherSide}
        />
      </ScrollView>

      <View style={s.footer}>
        <View>
          <Text style={s.fLbl}>{product.name}</Text>
          <Text style={s.fPrice}>{formatPrice(product.price + (variant?.price_adjustment ?? 0))}</Text>
        </View>
        <TouchableOpacity
          style={[s.cta, (!hasAnything || saving) && s.ctaOff]}
          onPress={handleSave}
          disabled={!hasAnything || saving}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={s.ctaT}>Add to Cart</Text>
              <ArrowRight size={16} strokeWidth={2} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  scroll: { flex: 1, backgroundColor: C.paper },
  pickers: { paddingHorizontal: 20, paddingTop: 12 },
  lbl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.mid, marginBottom: 8 },
  swatchRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.rule },
  swatchOn: { borderWidth: 2.5, borderColor: C.forest },
  swatchOff: { opacity: 0.35 },
  colorName: { fontFamily: F.body, fontSize: 12, color: C.mid, marginLeft: 4 },
  size: {
    minWidth: 46, alignItems: "center", paddingVertical: 9, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.rule, borderRadius: R.sm, backgroundColor: C.surface,
  },
  sizeOn: { backgroundColor: C.forest, borderColor: C.forest },
  sizeOff: { opacity: 0.4 },
  sizeT: { fontFamily: F.body, fontSize: 13, color: C.text },
  sizeTOn: { color: "#FFFFFF", fontWeight: "700" },
  sideTabs: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginTop: 16 },
  sideTab: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: R.md,
    borderWidth: 1, borderColor: C.rule, backgroundColor: C.surface,
  },
  sideTabOn: { backgroundColor: C.forest, borderColor: C.forest },
  sideTabT: { fontFamily: F.bodyBold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: C.mid },
  sideTabTOn: { color: "#FFFFFF" },
  stageWrap: { alignItems: "center", paddingTop: 16 },
  deselect: { paddingTop: 8, paddingBottom: 2 },
  deselectT: { fontFamily: F.body, fontSize: 11, color: C.light },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.rule,
  },
  fLbl: { fontFamily: F.body, fontSize: 12, color: C.mid },
  fPrice: { fontFamily: F.display, fontSize: 20, color: C.text },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.forest, borderRadius: R.md, paddingVertical: 15, paddingHorizontal: 26, minWidth: 168,
  },
  ctaOff: { opacity: 0.45 },
  ctaT: { fontFamily: F.bodyBold, fontSize: 14, color: "#FFFFFF", letterSpacing: 0.3, fontWeight: "700" },
});
