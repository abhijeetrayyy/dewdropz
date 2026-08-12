import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ArrowRight, Layers, Plus, Shirt, SlidersHorizontal } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useProductQuery } from "@/lib/queries";
import { useCartStore } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { toast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CustomizeStage, MOCKUP_ASPECT } from "@/components/customize/CustomizeStage";
import { StudioToolbar } from "@/components/customize/StudioToolbar";
import { saveDesign, uploadPickedImage } from "@/lib/customize/save";
import {
  DesignLayer, DesignState, EMPTY_DESIGN, SideKey, defaultInkFor, newId,
} from "@/lib/customize/types";
import type { CustomizationColorway } from "@/lib/data";
import { C, F, R } from "@/lib/theme";

const { height: SCREEN_H } = Dimensions.get("window");
/** Panels never take more than this, so the garment always keeps the majority. */
const SHEET_MAX = Math.round(SCREEN_H * 0.34);

type StudioTab_ = "none" | "blank" | "add" | "edit" | "layers";

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

  // Exactly one tool panel open at a time; "none" is a resting state that
  // hands the whole screen back to the garment.
  const [tab, setTab] = useState<StudioTab_>("add");
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });

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

  // Picking a layer up points the sheet at Edit and dropping it retires Edit —
  // same rule as the web studio, so the panel on screen always matches what is
  // actually selected.
  function selectLayer(id: string | null) {
    setSelectedId(id);
    setTab((t) => {
      if (id) return t === "none" || t === "add" ? "edit" : t;
      return t === "edit" ? "add" : t;
    });
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
          <Skeleton height={Math.round(SCREEN_H * 0.32)} radius={R.md} />
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

  const hasAnything = design.front.length > 0 || design.back.length > 0;

  // The stage is sized from the box actually left over, both axes, so opening
  // a tool panel scales the garment down instead of pushing it off-screen —
  // the same rule as the web studio. Width-only sizing inside a page-level
  // ScrollView (what this screen used to do) meant the tool you tapped and the
  // artwork it edited could never be on screen at the same time.
  const stageWidth = Math.max(
    120,
    Math.min(stageBox.w - 24, (stageBox.h - 40) / MOCKUP_ASPECT, 520)
  );

  return (
    <View style={s.root}>
      {/* Side switch stays pinned above the stage — it's a mode, not a tool. */}
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
              {design[sd].length > 0 && (
                <View style={[s.sideDot, effectiveSide === sd && s.sideDotOn]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Stage — flex:1, so it absorbs whatever the panels leave behind. */}
      <View
        style={s.stageArea}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setStageBox({ w: width, h: height });
        }}
      >
        {color?.[effectiveSide] && stageBox.w > 0 ? (
          <Animated.View entering={FadeIn.duration(260)} style={{ alignItems: "center" }}>
            <CustomizeStage
              zone={color[effectiveSide]!}
              side={effectiveSide}
              layers={layers}
              stageWidth={stageWidth}
              selectedId={selectedId}
              focused={false}
              onFocus={() => {}}
              onSelect={selectLayer}
              onCommit={(id, patch) =>
                patchSide(effectiveSide, (l) =>
                  l.map((x) => (x.id === id ? ({ ...x, ...patch } as DesignLayer) : x))
                )
              }
            />
          </Animated.View>
        ) : null}
      </View>

      {/* Panel — capped and scrolls internally, never taller than the garment. */}
      {tab !== "none" && (
        <View style={s.sheet}>
          <ScrollView
            style={{ maxHeight: SHEET_MAX }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {tab === "blank" ? (
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
                    <Text style={[s.lbl, { marginTop: 16 }]}>Size</Text>
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
            ) : tab === "layers" ? (
              <View style={s.pickers}>
                <Text style={s.lbl}>Layers on the {effectiveSide}</Text>
                {layers.length === 0 ? (
                  <Text style={s.hintT}>Nothing here yet — add text or an image.</Text>
                ) : (
                  [...layers].reverse().map((l) => (
                    <TouchableOpacity
                      key={l.id}
                      onPress={() => { haptics.select(); setSelectedId(l.id); setTab("edit"); }}
                      style={[s.layerRow, selectedId === l.id && s.layerRowOn]}
                    >
                      <Text style={s.layerT} numberOfLines={1}>
                        {l.kind === "text" ? (l.text || "(empty)") : "Image"}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : (
              <StudioToolbar
                mode={tab === "add" ? "add" : "edit"}
                selected={selected}
                twoSided={twoSided}
                activeSide={effectiveSide}
                uploading={uploading}
                canUndo={cursor > 0}
                canRedo={cursor < history.length - 1}
                onAddText={() => { addText(); setTab("edit"); }}
                onAddImage={async () => { await addImage(); setTab("edit"); }}
                onUndo={() => { haptics.select(); setCursor((c) => Math.max(0, c - 1)); setSelectedId(null); }}
                onRedo={() => { haptics.select(); setCursor((c) => Math.min(history.length - 1, c + 1)); setSelectedId(null); }}
                onPatch={patchSelected}
                onDelete={() => {
                  haptics.warning();
                  patchSide(effectiveSide, (l) => l.filter((x) => x.id !== selectedId));
                  setSelectedId(null);
                  setTab("add");
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
            )}
          </ScrollView>
        </View>
      )}

      {/* Tab bar — one tool at a time; tapping the open tab hands the height
          back to the garment. */}
      <View style={s.tabs}>
        <StudioTab label="Blank" icon={Shirt} tab="blank" current={tab} onSelect={setTab} />
        <StudioTab label="Add" icon={Plus} tab="add" current={tab} onSelect={setTab} />
        <StudioTab label="Edit" icon={SlidersHorizontal} tab="edit" current={tab} onSelect={setTab} dimmed={!selected} />
        <StudioTab label={layers.length ? `Layers ${layers.length}` : "Layers"} icon={Layers} tab="layers" current={tab} onSelect={setTab} />
      </View>

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

function StudioTab({
  label, icon: IconCmp, tab, current, onSelect, dimmed,
}: {
  label: string;
  icon: typeof Plus;
  tab: StudioTab_;
  current: StudioTab_;
  onSelect: (updater: (t: StudioTab_) => StudioTab_) => void;
  dimmed?: boolean;
}) {
  const on = current === tab;
  const fg = on ? C.forest : dimmed ? C.light : C.mid;
  return (
    <TouchableOpacity
      onPress={() => { haptics.select(); onSelect((t) => (t === tab ? "none" : tab)); }}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      style={[s.tab, on && s.tabOn]}
      activeOpacity={0.8}
    >
      <IconCmp size={18} strokeWidth={1.75} color={fg} />
      <Text style={[s.tabT, { color: fg }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  scroll: { flex: 1, backgroundColor: C.paper },
  pickers: { paddingHorizontal: 20, paddingVertical: 14 },
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
  sideTabs: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
  sideTab: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: R.md,
    borderWidth: 1, borderColor: C.rule, backgroundColor: C.surface,
  },
  sideTabOn: { backgroundColor: C.forest, borderColor: C.forest },
  sideTabT: { fontFamily: F.bodyBold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: C.mid },
  sideTabTOn: { color: "#FFFFFF" },
  stageArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  sheet: { borderTopWidth: 1, borderTopColor: C.rule, backgroundColor: C.paper },
  tabs: {
    flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: C.rule, backgroundColor: C.paper,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: 54, borderRadius: R.md },
  tabOn: { backgroundColor: C.sage12 },
  tabT: { fontFamily: F.bodyBold, fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase" },
  sideDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.forest, marginTop: 4 },
  sideDotOn: { backgroundColor: "#FFFFFF" },
  hintT: { fontFamily: F.body, fontSize: 12, color: C.light, paddingVertical: 6 },
  layerRow: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: R.sm, marginTop: 4 },
  layerRowOn: { backgroundColor: C.sage12 },
  layerT: { fontFamily: F.body, fontSize: 13, color: C.text },
  deselect: { paddingTop: 8, paddingBottom: 2 },
  deselectT: { fontFamily: F.body, fontSize: 11, color: C.light },
  footer: {
    // In-flow, not absolute. It was pinned to the bottom back when the whole
    // screen was one ScrollView; in the flex column it would sit on top of the
    // tool tabs and swallow them.
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.rule,
  },
  fLbl: { fontFamily: F.body, fontSize: 12, color: C.mid },
  // Inter, not Fraunces — web's price treatment is always font-body
  // (DesignYourOwnConfigurator.tsx: `font-body text-lg tabular-nums`), never
  // the display serif, even next to a product name that IS in Fraunces.
  fPrice: { fontFamily: F.bodyBold, fontSize: 20, color: C.text },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.forest, borderRadius: R.md, paddingVertical: 15, paddingHorizontal: 26, minWidth: 168,
  },
  ctaOff: { opacity: 0.45 },
  ctaT: { fontFamily: F.bodyBold, fontSize: 14, color: "#FFFFFF", letterSpacing: 0.3, fontWeight: "700" },
});
