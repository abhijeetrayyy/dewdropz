import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Img as Image } from "@/components/ui/Img";
import { Link, router } from "expo-router";
import { C, F, R, S } from "@/lib/theme";
import { formatPrice, pickVariant } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/ui/Icon";

// The single most-repeated object in the app, so it carries the most weight in
// whether the catalogue reads as designed.
//
// What changed from v4:
//   • Caption block instead of a name/price row. Collection sits above the
//     name as a mono eyebrow, price sits below in mono numerals. Three lines
//     of clear hierarchy instead of one crowded baseline fighting for width.
//   • 4:5 image (was 0.8 ≈ 4:5 but with a rounded 6px radius on a shadowed
//     card). Now sharp-cornered and flat on the paper — the photograph is the
//     object, not a card containing a photograph.
//   • Tags are mono, sharp, and there is only ever ONE of them. v4 could stack
//     "NEW" and "-20%" and a heart in the same 8px corner.

const NEW_WINDOW_DAYS = 21;

type Variant = { id: string; name: string; inventory_quantity?: number | null };
type Tag = { label: string; tone?: "neutral" | "scarcity" };
type Props = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  imageUri: string;
  meta?: string;
  tag?: Tag;
  compareAtPrice?: number | null;
  createdAt?: string;
  showHeart?: boolean;
  showQuickAdd?: boolean;
  /**
   * The product's sizes. Required for `showQuickAdd` to add anything: a line
   * with no size can't be resolved to a variant at checkout, so quick-add on a
   * sized product opens the product screen to choose one instead.
   */
  variants?: Variant[] | null;
  width?: number;
  /** Taller 2:3 crop for hero/feature placements. */
  feature?: boolean;
};

const TAG_TONES = {
  neutral: { bg: C.ink, fg: C.paper },
  scarcity: { bg: C.clay, fg: C.ink },
  discount: { bg: C.rust, fg: C.paper },
  new: { bg: C.ink, fg: C.paper },
} as const;

export function ProductCard({
  productId,
  slug,
  name,
  price,
  imageUri,
  meta,
  tag,
  compareAtPrice,
  createdAt,
  showHeart,
  showQuickAdd,
  variants,
  width,
  feature,
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const { has, toggle } = useWishlistStore();
  const saved = has(slug);

  // Quick-add used to call addItem() with no size at all, so every tap on a
  // sized product (every layer, every tee) put an unfulfillable line in the
  // cart — checkout then posted `size: undefined, variantId: null` and the
  // server had nothing to resolve a variant from. A product with more than one
  // size now routes to the product screen to pick one; a single-size or
  // sizeless product still adds in one tap, which is the case quick-add is for.
  function quickAdd() {
    if ((variants?.length ?? 0) > 1) {
      haptics.tap();
      router.push(`/product/${slug}?pick=size`);
      return;
    }
    const only = pickVariant(variants);
    haptics.tap();
    addItem({
      productId,
      slug,
      name,
      price,
      image: imageUri,
      size: only?.name,
      variantId: only?.id ?? null,
    });
    toast.success("Added to pack");
  }

  const isNew = !!createdAt && Date.now() - new Date(createdAt).getTime() < NEW_WINDOW_DAYS * 86400000;
  const discountPct = compareAtPrice && compareAtPrice > price ? Math.round((1 - price / compareAtPrice) * 100) : undefined;

  // Strict precedence — a card shows at most one tag, ever. Discount beats an
  // explicit scarcity tag beats "NEW", because that's the order a shopper
  // actually cares about.
  const badge = discountPct
    ? { label: `−${discountPct}%`, ...TAG_TONES.discount }
    : tag
      ? { label: tag.label, ...TAG_TONES[tag.tone ?? "neutral"] }
      : isNew
        ? { label: "NEW", ...TAG_TONES.new }
        : null;

  return (
    <Link href={`/product/${slug}`} asChild>
      <TouchableOpacity style={StyleSheet.flatten([width ? { width } : { flex: 1 }])} activeOpacity={0.9}>
        <View style={[s.frame, { aspectRatio: feature ? 2 / 3 : 4 / 5 }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={s.img} contentFit="cover" transition={220} alt="" />
          ) : (
            <View style={s.ph}>
              <Text style={s.phT}>DEWDROPZ</Text>
            </View>
          )}

          {badge ? (
            <View style={[s.tag, { backgroundColor: badge.bg }]}>
              <Text style={[s.tagT, { color: badge.fg }]}>{badge.label}</Text>
            </View>
          ) : null}

          {showHeart ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                haptics.tap();
                toggle(slug);
              }}
              style={s.heart}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ selected: saved }}
              accessibilityLabel={saved ? `Remove ${name} from saved` : `Save ${name}`}
            >
              <Icon name="favorite" size={16} color={saved ? C.clay : C.ink} filled={saved} />
            </TouchableOpacity>
          ) : null}

          {showQuickAdd ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                e.preventDefault();
                quickAdd();
              }}
              style={s.quickAdd}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                (variants?.length ?? 0) > 1 ? `Choose a size for ${name}` : `Add ${name} to pack`
              }
            >
              <Icon name="add" size={18} color={C.paper} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={s.caption}>
          {meta ? (
            <Text style={s.eyebrow} numberOfLines={1}>
              {meta.toUpperCase()}
            </Text>
          ) : null}
          <Text style={s.name} numberOfLines={2}>
            {name}
          </Text>
          <View style={s.priceRow}>
            <Text style={s.price}>{formatPrice(price)}</Text>
            {discountPct && compareAtPrice ? <Text style={s.strike}>{formatPrice(compareAtPrice)}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const s = StyleSheet.create({
  frame: { width: "100%", borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  img: { width: "100%", height: "100%" },
  ph: { flex: 1, alignItems: "center", justifyContent: "center" },
  phT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 3, color: C.textFaint },
  tag: { position: "absolute", top: 8, left: 8, borderRadius: R.tag, paddingHorizontal: 7, paddingVertical: 3.5 },
  tagT: { fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1 },
  heart: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAdd: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: { marginTop: 11, gap: 3 },
  eyebrow: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.2, color: C.textMuted },
  // Fraunces regular — matches web's ProductCard.tsx exactly
  // (`<h3 className="font-display ...">`), which sets every product name in
  // this same non-light cut, never Inter.
  name: { fontFamily: F.displayRegular, fontSize: 16, lineHeight: 20, color: C.ink, letterSpacing: 0 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: S.xs, marginTop: 2 },
  price: { fontFamily: F.monoBold, fontSize: 12, letterSpacing: 0.2, color: C.ink },
  strike: { fontFamily: F.mono, fontSize: 11, color: C.textFaint, textDecorationLine: "line-through" },
});
