import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image as RNImage, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProductQuery, useCustomizableProductsQuery, useLibraryDesignsQuery } from "@/lib/queries";
import { useCartStore } from "@/stores/cart";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { toast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CustomizeStage, useMockupAspect } from "@/components/customize/CustomizeStage";
import { Img as Image } from "@/components/ui/Img";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { StatusCap } from "@/components/ui/StatusCap";
import { StudioToolbar } from "@/components/customize/StudioToolbar";
import { saveDesign, uploadPickedImage } from "@/lib/customize/save";
import { effectiveDpi, qualityNote, qualityOf } from "@/lib/customize/printQuality";
import { studioErrorMessage } from "@/lib/customize/errors";
import { placeInZone } from "@/lib/customize/placement";
import { putCarry, takeCarry, refitDesign } from "@/lib/customize/carry";
import {
  DesignLayer, DesignState, EMPTY_DESIGN, SideKey, defaultInkFor, newId,
} from "@/lib/customize/types";
import type { CustomizationColorway } from "@/lib/data";
import { C, F, M, R, S } from "@/lib/theme";


type StudioTab_ = "none" | "blank" | "add" | "edit" | "layers" | "library";

export default function CustomizeScreen() {
  // `size` arrives from the product page's buy bar, which shows a size selector
  // above a "Design yours" CTA. Without honouring it the studio silently
  // restarts the shopper at the first variant.
  // `start=library` opens straight into the DEWDROPZ shelf, matching the web
  // studio's own door (`/customize?start=library`). Somebody arriving from a
  // printed garment is browsing artwork, not planning to upload their own.
  const { slug, size: sizeParam, start } = useLocalSearchParams<{
    slug: string; size?: string; start?: string;
  }>();
  // Measured per render — the studio is the screen most likely to be used in
  // Android split-screen (artwork in one pane, gallery in the other).
  const insets = useSafeAreaInsets();
  const { height: SCREEN_H } = useWindowDimensions();
  /** Panels never take more than this, so the garment keeps the majority. */
  const SHEET_MAX = Math.round(SCREEN_H * 0.34);
  const { data: product, isLoading, isError } = useProductQuery(slug);
  // The other blanks, so the garment can be changed without leaving the studio.
  const { data: blanks = [] } = useCustomizableProductsQuery();
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
  // The incoming size is a DEFAULT, not state — so it slots in as the fallback
  // rather than being copied into `variantId` by an effect. An explicit tap
  // sets `variantId` and wins from then on; until then the product page's
  // choice stands. (`variants` is rebuilt every render, so an effect keyed on
  // it would re-run constantly and need a ref to guard itself — deriving the
  // value sidesteps that entirely.)
  const paramVariant = sizeParam
    ? variants.find((v) => v.name.toLowerCase() === sizeParam.toLowerCase())
    : undefined;
  const variant = variants.find((v) => v.id === variantId) ?? paramVariant ?? variants[0];

  const [activeSide, setActiveSide] = useState<SideKey>("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Source pixel dimensions per image layer, kept beside the design rather than
  // inside it: the layer shape is the contract with the server renderer, and
  // this is only needed while somebody is still editing. Without it the studio
  // cannot say whether what they picked will print — see lib/customize/printQuality.
  const [srcDims, setSrcDims] = useState<Record<string, { width: number; height: number }>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Exactly one tool panel open at a time; "none" is a resting state that
  // hands the whole screen back to the garment.
  const [tab, setTab] = useState<StudioTab_>(start === "library" ? "library" : "add");
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });

  // Undo/redo over whole-design snapshots. Every mutation goes through
  // `commit`, so history is one entry per user action — not per frame of a drag.
  // HISTORY AND CURSOR ARE ONE PIECE OF STATE, NOT TWO.
  //
  // They used to be separate, and `commit` read `cursor` from its closure while
  // advancing it with a functional update. That is consistent only while every
  // commit is a user tap, because a tap guarantees a render in between. The
  // moment two commits land inside one render — which is what adding a library
  // design does, once to place the layer and again when its measured size
  // arrives — the stack was trimmed against a stale cursor and the cursor then
  // advanced past the end of it. `history[cursor]` came back undefined and the
  // studio crashed on `design[effectiveSide]`: "Cannot convert undefined value
  // to object".
  //
  // Holding both in one object makes every update atomic: the new cursor is
  // derived from the stack that was just built, in the same reducer, so the two
  // can no longer disagree.
  const [hist, setHist] = useState<{ stack: DesignState[]; cursor: number }>(() => ({
    stack: [EMPTY_DESIGN],
    cursor: 0,
  }));
  // Defensive: a design is what every render below indexes into, so falling
  // back to empty degrades a future bug into "nothing on the garment" rather
  // than a red screen.
  const design = hist.stack[hist.cursor] ?? EMPTY_DESIGN;

  // The library shelf. Fetched only once the panel is opened — a shopper
  // bringing their own artwork should not pay for a catalogue they never look at.
  const { data: libraryDesigns = [], isLoading: libraryLoading } =
    useLibraryDesignsQuery(product?.id, tab === "library");

  // Accepts an updater as well as a value, and that is not a convenience.
  //
  // Every mutation used to be built from `design` as captured by the render
  // that scheduled it. Fine for a tap, wrong for anything that awaits: pick an
  // image, tap Text while it uploads, and when the upload lands it commits a
  // design from BEFORE the text existed — the text silently disappears. An
  // updater reads the live design inside the reducer, so a slow upload can no
  // longer overwrite work done while it was in flight.
  const commit = useCallback(
    (next: DesignState | ((prev: DesignState) => DesignState)) => {
      setHist((h) => {
        const current = h.stack[h.cursor] ?? EMPTY_DESIGN;
        const value = typeof next === "function" ? next(current) : next;
        const stack = [...h.stack.slice(0, h.cursor + 1), value];
        return { stack, cursor: stack.length - 1 };
      });
    },
    [],
  );

  // Rehydrate a design carried in from another blank.
  //
  // Runs once, when the destination's colourway (and therefore its zones) is
  // known — re-fitting before that would scale against a zone that does not
  // exist yet. `takeCarry` clears the handoff, and the ref stops a re-render
  // from trying again with nothing there.
  const carryDoneRef = useRef(false);
  useEffect(() => {
    if (carryDoneRef.current || !color) return;
    const carried = takeCarry();
    if (!carried) { carryDoneRef.current = true; return; }
    carryDoneRef.current = true;

    const { design: refitted, scale } = refitDesign(carried.design, carried.fromZone, {
      front: color.front,
      back: color.back,
    });
    // The carry is an external one-shot handoff, not derived state: it is read
    // and cleared here, and the accompanying toast cannot fire during render.
    // Syncing an external source into state is exactly what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHist({ stack: [EMPTY_DESIGN, refitted], cursor: 1 });
    setSrcDims(carried.srcDims);

    // Spreading the same pixels over a bigger garment lowers the print
    // resolution. Say so here rather than let it be discovered on delivery.
    if (scale > 1.02) {
      toast.show(`Brought over from the ${carried.fromName} — check the print quality, this garment prints larger.`);
    } else {
      toast.success(`Brought over from the ${carried.fromName}.`);
    }
  }, [color]);

  const sides = useMemo<SideKey[]>(
    () => (["front", "back"] as SideKey[]).filter((sd) => color?.[sd]),
    [color]
  );
  const twoSided = sides.length > 1;
  const effectiveSide: SideKey = sides.includes(activeSide) ? activeSide : (sides[0] ?? "front");
  const layers = design[effectiveSide];
  const selected = layers.find((l) => l.id === selectedId) ?? null;

  // Print quality for whatever is selected, recomputed on every resize because
  // resizing is what fixes it.
  const zoneNow = color?.[effectiveSide];
  const selectedDpi =
    selected?.kind === "image" && zoneNow
      ? effectiveDpi(selected, zoneNow, srcDims[selected.id])
      : null;
  const selectedQuality = qualityOf(selectedDpi);
  const selectedNote = qualityNote(selectedDpi);

  // Anything on either side that would print badly. Checked across the WHOLE
  // design at save time, not just the side being looked at — a poor image on
  // the back is exactly the one somebody forgets about.
  const poorLayers = (["front", "back"] as SideKey[]).flatMap((side) => {
    const zone = color?.[side];
    if (!zone) return [];
    return design[side]
      .filter((l): l is Extract<DesignLayer, { kind: "image" }> => l.kind === "image")
      .filter((l) => qualityOf(effectiveDpi(l, zone, srcDims[l.id])) === "poor");
  });

  const aspect = useMockupAspect(color?.[effectiveSide]?.mockupImage);

  // Canvas zoom lives in a shared value (the stage animates against it on the
  // UI thread) mirrored into React state purely so the badge can render a
  // number. Reset whenever the garment underneath changes, or you'd land on a
  // new side still panned to the last one's corner.
  const zoom = useSharedValue(1);
  const [zoomLabel, setZoomLabel] = useState(1);
  // Bumped whenever a new layer lands, so the stage pans to show it rather than
  // leaving it somewhere outside a zoomed-in viewport.
  const [centerOn, setCenterOn] = useState<{ x: number; y: number; nonce: number }>();
  const nonce = useRef(0);
  const focus = useCallback((x: number, y: number) => {
    nonce.current += 1;
    setCenterOn({ x, y, nonce: nonce.current });
  }, []);
  // Called from the handlers that swap the garment, not from an effect keyed on
  // them — an effect here would setState during render-commit and cascade an
  // extra render on every side/colour tap.
  const resetZoom = useCallback(() => {
    zoom.value = withTiming(1, { duration: M.base });
    setZoomLabel(1);
  }, [zoom]);


  // Memoised because the library and garment handlers below depend on it; an
  // unstable identity there would rebuild those callbacks on every render.
  const patchSide = useCallback(
    (side: SideKey, mutate: (list: DesignLayer[]) => DesignLayer[]) => {
      commit((current) => ({ ...current, [side]: mutate(current[side]) }));
    },
    [commit],
  );

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
    focus(layer.x, layer.y);
  }

  /**
   * Drop a library design onto the garment.
   *
   * Deliberately the SAME path an uploaded photo takes once a URL exists — the
   * layer that lands is an ordinary image layer, so it is draggable, scalable,
   * deletable and printed identically. The only difference between the two
   * doors is where the URL came from.
   */
  /**
   * Drop a library design onto the garment.
   *
   * Deliberately the SAME path an uploaded photo takes once a URL exists — the
   * layer that lands is an ordinary image layer, so it is draggable, scalable,
   * deletable and printed identically. The only difference between the two
   * doors is where the URL came from.
   *
   * The artwork is MEASURED BEFORE it is added, and the whole thing lands in a
   * single commit. The first version added a placeholder layer and then patched
   * its size from the `getSize` callback — two commits for one user action,
   * which is precisely what broke the undo stack and red-screened the studio.
   * One action, one history entry, is also just the right behaviour: undo after
   * adding a design should remove the design, not resize it.
   */
  const addLibraryDesign = useCallback(
    async (design: { id: string; name: string; image_url: string }) => {
      const zone = color?.[effectiveSide];
      if (!zone) return;

      // Library artwork is authored at print resolution, so its source pixels
      // are what decide DPI. If the measurement fails the design is still
      // usable — it is placed to the zone's own ratio and simply reports no
      // quality reading, which is honest rather than a guess.
      const measured = await new Promise<{ width: number; height: number } | null>((resolve) => {
        RNImage.getSize(
          design.image_url,
          (width, height) => resolve({ width, height }),
          () => resolve(null),
        );
      });

      const source = measured ?? { width: zone.widthPx, height: zone.heightPx };
      const box = placeInZone(zone, source);
      const layerId = newId();

      if (measured) {
        setSrcDims((prev) => ({ ...prev, [layerId]: measured }));
      }

      const layer: DesignLayer = {
        kind: "image",
        id: layerId,
        uri: design.image_url,
        width: box.width,
        height: box.height,
        x: box.x,
        y: box.y,
        scale: 1,
        rotation: 0,
      };
      patchSide(effectiveSide, (l) => [...l, layer]);
      setSelectedId(layerId);
      haptics.select();
      setTab("edit");
    },
    [color, effectiveSide, patchSide],
  );

  /**
   * Change garment without losing the work.
   *
   * The design is handed over as-is and re-fitted on ARRIVAL, because only the
   * destination knows its own zone — deciding the scale here would mean
   * fetching the other product just to do the arithmetic.
   */
  const switchBlank = useCallback(
    (nextSlug: string) => {
      const basis = color?.front ?? color?.back;
      const hasWork = design.front.length > 0 || design.back.length > 0;
      if (hasWork && basis && product) {
        putCarry({
          fromSlug: product.slug,
          fromName: product.name,
          fromZone: {
            widthPx: basis.widthPx, heightPx: basis.heightPx,
            widthIn: basis.widthIn, heightIn: basis.heightIn,
          },
          design,
          srcDims,
        });
      }
      haptics.select();
      router.replace({ pathname: "/customize/[slug]", params: { slug: nextSlug } });
    },
    [color, design, srcDims, product],
  );

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

      // Placement is the shared rule — see lib/customize/placement.ts for why
      // the old "longest edge to 70% of the shortest zone side, centred" was
      // wrong for both wide and tall artwork.
      const srcW = asset.width ?? zone.widthPx;
      const srcH = asset.height ?? zone.heightPx;
      const box = placeInZone(zone, { width: srcW, height: srcH });
      const w = box.width;
      const h = box.height;

      const layer: DesignLayer = {
        kind: "image",
        id: newId(),
        uri,
        width: w,
        height: h,
        x: box.x,
        y: box.y,
        scale: 1,
        rotation: 0,
      };
      setSrcDims((prev) => ({ ...prev, [layer.id]: { width: srcW, height: srcH } }));
      patchSide(effectiveSide, (l) => [...l, layer]);
      setSelectedId(layer.id);
      focus(layer.x + w / 2, layer.y + h / 2);
      haptics.select();
    } catch (err) {
      haptics.error();
      toast.error(studioErrorMessage(err, "Could not add that image. Try another one."));
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
    const copies = layers.map((l) => ({ ...l, id: newId() }));
    // Same artwork on the other side — carry the source dimensions across so
    // the copy can still be judged for print quality.
    setSrcDims((prev) => {
      const next = { ...prev };
      layers.forEach((l, i) => {
        const d = prev[l.id];
        if (d) next[copies[i].id] = d;
      });
      return next;
    });
    commit((current) => ({ ...current, [other]: copies }));
    toast.success(`Copied to ${other}`);
  }

  /** Anything on either side that would be lost by leaving. */
  const hasWork = design.front.length > 0 || design.back.length > 0;

  // LEAVING WITH WORK ON THE GARMENT.
  //
  // The back arrow discarded a design silently. There is no draft anywhere —
  // the studio holds it in memory and only `saveDesign` persists it — so a
  // mistaken tap on a shirt somebody spent ten minutes on lost all of it, with
  // no undo once the screen unmounted.
  function leaveStudio() {
    if (!hasWork) {
      goBack("/(tabs)/design");
      return;
    }
    haptics.warning();
    Alert.alert(
      "Leave without adding it?",
      "This design is not saved anywhere yet. Adding it to your pack keeps it — leaving now discards it.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => goBack("/(tabs)/design") },
      ],
    );
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

    // A LAST CHANCE, NOT A BLOCK.
    //
    // Somebody may genuinely want a soft, grainy print — that is a taste, and
    // the shop is not the arbiter of it. What is not acceptable is finding out
    // after the parcel arrives. So a design carrying artwork below the
    // printable floor asks once, names the problem, and lets them proceed.
    if (poorLayers.length > 0) {
      const proceed = await new Promise<boolean>((resolve) => {
        haptics.warning();
        Alert.alert(
          poorLayers.length === 1 ? "This image will print blurry" : "Some images will print blurry",
          `${poorLayers.length === 1 ? "One image is" : `${poorLayers.length} images are`} too low-resolution for the size ${poorLayers.length === 1 ? "it is" : "they are"} printed at. Making ${poorLayers.length === 1 ? "it" : "them"} smaller, or picking a larger file, will sharpen the print.\n\nWe will print exactly what you approve.`,
          [
            { text: "Let me fix it", style: "cancel", onPress: () => resolve(false) },
            { text: "Print it anyway", style: "destructive", onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
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
      toast.error(studioErrorMessage(err, "Could not save your design. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={s.root}>
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton height={16} width="40%" />
          <Skeleton height={Math.round(SCREEN_H * 0.32)} radius={R.card} />
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
  //
  // `aspect` is measured from the mockup rather than assumed — the constant it
  // replaced described the garments as landscape when they are portrait, which
  // both cropped the photo and put the print area in the wrong place.
  const stageWidth = Math.max(
    120,
    Math.min(stageBox.w - 24, (stageBox.h - 24) / aspect, 520)
  );

  return (
    <View style={s.root}>
      <StatusCap />

      {/* ── Panel ─────────────────────────────────────────────────────────
          The studio was the last screen still wearing React Navigation's own
          bar, titled "Customize" in a different typeface at a different height
          from every other header in the app. It now carries the same ink panel,
          with the Front/Back switch folded into it — that switch is a MODE, and
          a mode belongs in the chrome rather than floating above the garment as
          if it were another tool. ─────────────────────────────────────────── */}
      <View style={[s.panel, { paddingTop: insets.top + 8 }]}>
        <View style={s.panelRow}>
          <IconButton
            name="arrow_back"
            tone="glass"
            accessibilityLabel="Back"
            onPress={leaveStudio}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.panelKicker}>THE STUDIO</Text>
            <Text style={s.panelTitle} numberOfLines={1}>
              {product.name}
            </Text>
          </View>
          {twoSided ? (
            <View style={s.sideTabs}>
              {sides.map((sd) => (
                <TouchableOpacity
                  key={sd}
                  accessibilityRole="button"
                  accessibilityState={{ selected: effectiveSide === sd }}
                  accessibilityLabel={`${sd === "front" ? "Front" : "Back"} of the garment`}
                  onPress={() => { haptics.select(); setActiveSide(sd); setSelectedId(null); resetZoom(); }}
                  style={[s.sideTab, effectiveSide === sd && s.sideTabOn]}
                >
                  <Text style={[s.sideTabT, effectiveSide === sd && s.sideTabTOn]}>
                    {sd === "front" ? "Front" : "Back"}
                  </Text>
                  {design[sd].length > 0 ? (
                    <View style={[s.sideDot, effectiveSide === sd && s.sideDotOn]} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </View>

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
              aspect={aspect}
              zoom={zoom}
              onZoomChange={setZoomLabel}
              centerOn={centerOn}
              selectedId={selectedId}
              onSelect={selectLayer}
              onCommit={(id, patch) =>
                patchSide(effectiveSide, (l) =>
                  l.map((x) => (x.id === id ? ({ ...x, ...patch } as DesignLayer) : x))
                )
              }
            />

            {/* Only appears once you're actually zoomed, so it never sits over
                the garment as permanent furniture. */}
            {zoomLabel > 1.05 ? (
              <TouchableOpacity
                style={s.zoomPill}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Zoomed to ${Math.round(zoomLabel * 100)} percent. Tap to fit.`}
                onPress={() => { haptics.select(); resetZoom(); }}
              >
                <Icon name="fit_screen" size={13} color={C.paper} />
                <Text style={s.zoomPillT}>{Math.round(zoomLabel * 100)}%</Text>
              </TouchableOpacity>
            ) : null}
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
                      onPress={() => { haptics.select(); setColorIndex(i); setSelectedId(null); resetZoom(); }}
                      accessibilityLabel={c.available ? c.name : `${c.name}, coming soon`}
                      style={s.swatchHit}
                    >
                      <View
                        style={[
                          s.swatch,
                          { backgroundColor: c.hex },
                          colorIndex === i && s.swatchOn,
                          !c.available && s.swatchOff,
                        ]}
                      />
                      {/* An unavailable swatch was previously signalled by
                          opacity alone, which reads as "slightly paler dot",
                          not as "you cannot have this" — so the three
                          coming-soon colours looked tappable, did nothing when
                          tapped, and gave no reason why. Opacity is also the
                          one channel a shopper can't distinguish on a swatch
                          whose whole job is to be a colour. The slash is the
                          second, non-colour channel. */}
                      {!c.available ? <View style={s.swatchSlash} /> : null}
                    </TouchableOpacity>
                  ))}
                  {/* The suffix used to hang off `color`, the SELECTED colour —
                      which can never be an unavailable one, so it could never
                      render. It belongs on the row, describing the swatches
                      that are struck through. */}
                  <Text style={s.colorName}>
                    {color?.name}
                    {colors.some((c) => !c.available) ? " · some colours coming soon" : ""}
                  </Text>
                </View>

                {blanks.length > 1 && (
                  <>
                    <Text style={[s.lbl, { marginTop: 16 }]}>Print it on something else</Text>
                    <View style={s.blankRow}>
                      {blanks
                        .filter((b) => b.slug !== product?.slug)
                        .map((b) => (
                          <TouchableOpacity
                            key={b.id}
                            style={s.blankCell}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={`Switch to ${b.name}`}
                            onPress={() => switchBlank(b.slug)}
                          >
                            <View style={s.blankThumb}>
                              <Image
                                source={{ uri: b.images?.[0] ?? "" }}
                                alt=""
                                style={{ width: "100%", height: "100%" }}
                                contentFit="cover"
                              />
                            </View>
                            <Text style={s.blankName} numberOfLines={2}>{b.name}</Text>
                            <Text style={s.blankPrice}>{formatPrice(b.price)}</Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </>
                )}

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
            ) : tab === "library" ? (
              <View style={s.pickers}>
                <Text style={s.lbl}>DEWDROPZ library</Text>
                {libraryLoading ? (
                  <View style={{ paddingVertical: 20, alignItems: "center" }}>
                    <ActivityIndicator color={C.forest} />
                  </View>
                ) : libraryDesigns.length === 0 ? (
                  // An empty shelf is a real state, not an error: the upload
                  // door still works, which is all the phone had before this.
                  <Text style={s.libEmpty}>
                    No designs for this garment yet. You can still upload your own.
                  </Text>
                ) : (
                  <View style={s.libGrid}>
                    {libraryDesigns.map((d) => (
                      <TouchableOpacity
                        key={d.id}
                        style={s.libCell}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${d.name} to the design`}
                        onPress={() => addLibraryDesign(d)}
                      >
                        {/* On the garment's own colour, because most library
                            artwork is light ink meant for a dark blank — on a
                            white tile it would be an invisible thumbnail. */}
                        <View style={[s.libThumb, { backgroundColor: color?.hex ?? C.ink }]}>
                          <Image
                            source={{ uri: d.image_url }}
                            alt={d.name}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="contain"
                          />
                        </View>
                        <Text style={s.libName} numberOfLines={1}>{d.name}</Text>
                        <Text style={s.libColl} numberOfLines={1}>{d.collection}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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
                canUndo={hist.cursor > 0}
                canRedo={hist.cursor < hist.stack.length - 1}
                onAddText={() => { addText(); setTab("edit"); }}
                onAddImage={async () => { await addImage(); setTab("edit"); }}
                onOpenLibrary={() => { haptics.select(); setTab("library"); }}
                onUndo={() => { haptics.select(); setHist((h) => ({ ...h, cursor: Math.max(0, h.cursor - 1) })); setSelectedId(null); }}
                onRedo={() => { haptics.select(); setHist((h) => ({ ...h, cursor: Math.min(h.stack.length - 1, h.cursor + 1) })); setSelectedId(null); }}
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
                  // The copy is the same artwork, so it inherits the same source
                  // dimensions — without this a duplicated image silently loses
                  // its quality reading and reports nothing.
                  const dims = srcDims[selected.id];
                  if (dims) setSrcDims((prev) => ({ ...prev, [clone.id]: dims }));
                  patchSide(effectiveSide, (l) => [...l, clone]);
                  setSelectedId(clone.id);
                }}
                onReorder={reorder}
                onCopyToOtherSide={copyToOtherSide}
                qualityNote={selectedNote}
                qualityTone={selectedQuality}
              />
            )}
          </ScrollView>
        </View>
      )}

      {/* Tab bar — one tool at a time; tapping the open tab hands the height
          back to the garment. */}
      <View style={s.tabs}>
        <StudioTab label="Blank" icon="checkroom" tab="blank" current={tab === "library" ? "add" : tab} onSelect={setTab} />
        <StudioTab label="Add" icon="add" tab="add" current={tab === "library" ? "add" : tab} onSelect={setTab} />
        <StudioTab label="Edit" icon="tune" tab="edit" current={tab === "library" ? "add" : tab} onSelect={setTab} dimmed={!selected} />
        <StudioTab label={layers.length ? `Layers ${layers.length}` : "Layers"} icon="layers" tab="layers" current={tab === "library" ? "add" : tab} onSelect={setTab} />
      </View>

      <View style={s.footer}>
        {/* Colour and size are chosen behind the "Blank" tab, which the studio
            doesn't open on — so what you were about to buy was invisible right
            up to the moment you bought it. Stated here instead. */}
        <View style={{ flex: 1 }}>
          <Text style={s.fLbl} numberOfLines={1}>
            {[color?.name, variant?.name && `Size ${variant.name}`].filter(Boolean).join(" · ") ||
              product.name}
          </Text>
          <Text style={s.fPrice}>{formatPrice(product.price + (variant?.price_adjustment ?? 0))}</Text>
        </View>
        <TouchableOpacity
          style={[s.cta, (!hasAnything || saving) && s.ctaOff]}
          onPress={handleSave}
          disabled={!hasAnything || saving}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <>
              <Text style={s.ctaT}>Add to Cart</Text>
              <Icon name="arrow_forward" size={18} color={C.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StudioTab({
  label, icon, tab, current, onSelect, dimmed,
}: {
  label: string;
  /** Material Symbols glyph name — same family as the rest of the app. */
  icon: string;
  tab: StudioTab_;
  current: StudioTab_;
  onSelect: (updater: (t: StudioTab_) => StudioTab_) => void;
  dimmed?: boolean;
}) {
  const on = current === tab;
  const fg = on ? C.forest : dimmed ? C.textMuted : C.textMid;
  return (
    <TouchableOpacity
      onPress={() => { haptics.select(); onSelect((t) => (t === tab ? "none" : tab)); }}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      style={[s.tab, on && s.tabOn]}
      activeOpacity={0.8}
    >
      <Icon name={icon} size={20} color={fg} filled={on} />
      <Text style={[s.tabT, { color: fg }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  scroll: { flex: 1, backgroundColor: C.paper },
  pickers: { paddingHorizontal: 20, paddingVertical: 14 },
  lbl: { fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: C.textMid, marginBottom: 8 },
  swatchRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  // The dot stays 30 — a colour swatch reads as a sample, not a button, and
  // scaling it to 44 would make the row look like a set of toggles. The 44×44
  // hit box around it is what the finger actually gets. The row's own `gap`
  // then applies between hit boxes rather than between dots, so the dots sit
  // further apart than before; that reads as deliberate air in a picker and is
  // the cheaper side of the trade against a 30pt target.
  swatchHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.ruleMed },
  swatchOn: { borderWidth: 2.5, borderColor: C.forest },
  swatchOff: { opacity: 0.35 },
  // Struck through the dot at 45°. 34 is the 30pt dot's diagonal (≈42) trimmed
  // to sit inside the circle rather than poke out of it.
  swatchSlash: {
    position: "absolute",
    width: 34,
    height: 1.5,
    backgroundColor: C.textMid,
    transform: [{ rotate: "-45deg" }],
  },
  colorName: { fontFamily: F.body, fontSize: 12, color: C.textMid, marginLeft: 4 },
  size: {
    // 9pt of padding around 13pt text came to ~36 tall — under the 44 minimum,
    // on the control that decides what garment actually ships. minHeight rather
    // than more padding, so the chip still grows with the system text size.
    minWidth: 46, minHeight: 44, justifyContent: "center",
    alignItems: "center", paddingVertical: 9, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.ruleMed, borderRadius: R.pill, backgroundColor: C.paper,
  },
  sizeOn: { backgroundColor: C.forest, borderColor: C.forest },
  sizeOff: { opacity: 0.4 },
  sizeT: { fontFamily: F.body, fontSize: 13, color: C.ink },
  sizeTOn: { color: C.paper, fontFamily: F.bodyBold },
  panel: {
    backgroundColor: C.ink,
    borderBottomLeftRadius: R.sheet,
    borderBottomRightRadius: R.sheet,
    paddingBottom: S.md,
  },
  panelRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingHorizontal: S.gutter },
  panelKicker: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.8, color: C.sage },
  panelTitle: { fontFamily: F.display, fontSize: 22, lineHeight: 26, color: C.paper, marginTop: 3 },

  // A segmented pill on the ink, not two outlined cards on paper.
  sideTabs: {
    flexDirection: "row",
    gap: 3,
    backgroundColor: "rgba(251,247,239,0.1)",
    borderRadius: R.pill,
    padding: 3,
  },
  sideTab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: R.pill,
  },
  sideTabOn: { backgroundColor: C.paper },
  sideTabT: { fontFamily: F.bodySemiBold, fontSize: 11, letterSpacing: 0.4, color: "rgba(251,247,239,0.65)" },
  sideTabTOn: { color: C.ink },
  stageArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  zoomPill: {
    position: "absolute", bottom: 10, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.ink + "D9", paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill,
  },
  zoomPillT: { fontFamily: F.monoBold, fontSize: 11, letterSpacing: 0.6, color: C.paper },
  sheet: { borderTopWidth: 1, borderTopColor: C.ruleMed, backgroundColor: C.paper },
  tabs: {
    flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: C.ruleMed, backgroundColor: C.paper,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: 54, borderRadius: R.panel },
  tabOn: { backgroundColor: C.sage12 },
  tabT: { fontFamily: F.bodyBold, fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase" },
  sideDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: C.sage },
  sideDotOn: { backgroundColor: C.forest },
  hintT: { fontFamily: F.body, fontSize: 12, color: C.textMuted, paddingVertical: 6 },
  layerRow: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: R.panel, marginTop: 4 },
  layerRowOn: { backgroundColor: C.sage12 },
  layerT: { fontFamily: F.body, fontSize: 13, color: C.ink },
  deselect: { paddingTop: 8, paddingBottom: 2 },
  deselectT: { fontFamily: F.body, fontSize: 11, color: C.textMuted },
  footer: {
    // In-flow, not absolute. It was pinned to the bottom back when the whole
    // screen was one ScrollView; in the flex column it would sit on top of the
    // tool tabs and swallow them.
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.ruleMed,
  },
  fLbl: { fontFamily: F.body, fontSize: 12, color: C.textMid },
  // Inter, not Fraunces — web's price treatment is always font-body
  // (DesignYourOwnConfigurator.tsx: `font-body text-lg tabular-nums`), never
  // the display serif, even next to a product name that IS in Fraunces.
  fPrice: { fontFamily: F.bodyBold, fontSize: 20, color: C.ink },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.forest, borderRadius: R.pill, paddingVertical: 15, paddingHorizontal: 26, minWidth: 168,
  },
  ctaOff: { opacity: 0.45 },
  ctaT: { fontFamily: F.bodyBold, fontSize: 14, color: C.white, letterSpacing: -0.1 },

  // ── The design library shelf ───────────────────────────────────────────
  // Three across: wide enough to judge a mark at a glance, narrow enough that
  // a shelf of seven does not need scrolling inside a panel that is already
  // capped at a third of the screen.
  libGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  libCell: { width: "31%" },
  libThumb: {
    width: "100%", aspectRatio: 1, borderRadius: R.card, overflow: "hidden",
    alignItems: "center", justifyContent: "center", padding: 8,
  },
  libName: { fontFamily: F.bodyBold, fontSize: 11, color: C.ink, marginTop: 5 },
  libColl: { fontFamily: F.mono, fontSize: 9, letterSpacing: 0.6, color: C.textMid, marginTop: 1 },
  libEmpty: { fontFamily: F.body, fontSize: 13, color: C.textMid, lineHeight: 19 },

  // ── The garment switcher ───────────────────────────────────────────────
  blankRow: { flexDirection: "row", gap: 10 },
  blankCell: { width: 96 },
  blankThumb: {
    width: "100%", aspectRatio: 4 / 5, borderRadius: R.card, overflow: "hidden",
    backgroundColor: C.sand, borderWidth: 1, borderColor: C.rule,
  },
  blankName: { fontFamily: F.bodyBold, fontSize: 11, color: C.ink, marginTop: 5, lineHeight: 14 },
  blankPrice: { fontFamily: F.mono, fontSize: 10, color: C.textMid, marginTop: 1 },
});
