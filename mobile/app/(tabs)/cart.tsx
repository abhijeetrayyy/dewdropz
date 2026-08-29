import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Img as Image } from "@/components/ui/Img";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
// The Reanimated implementation. The legacy `Swipeable` exported from the
// package root is marked `@deprecated use Reanimated version of Swipeable
// instead` — it drives the row off the old Animated API, on the JS thread.
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeOutLeft, LinearTransition } from "react-native-reanimated";
import { useCartStore, type CartItem } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { formatPrice } from "@/lib/utils";
import { ProductCard } from "@/components/ProductCard";
import { StatusCap } from "@/components/ui/StatusCap";
import { useTabBarSpace } from "@/components/TabBar";
import { Icon } from "@/components/ui/Icon";
import { Rule } from "@/components/editorial/Rule";
import { Topography } from "@/components/editorial/Topography";
import { SectionHead } from "@/components/editorial/SectionHead";
import { Body, Display1, Display2, Eyebrow, Mono, Numeric, Title } from "@/components/ui/Type";
import { useProductsBySlugsQuery, useProductsQuery, useQuoteQuery } from "@/lib/queries";
import { getCartRecommendations } from "@/lib/data";
import { FREE_SHIPPING_THRESHOLD_PAISE } from "@/lib/constants";
import { haptics } from "@/lib/haptics";
import { toast } from "@/components/ui/Toast";
import { C, F, M, R, S, SHADOW_BAR } from "@/lib/theme";

export default function CartScreen() {
  const { items, removeItem, updateQuantity, itemCount, subtotal } = useCartStore();
  if (items.length === 0) return <EmptyPack />;
  return <Pack items={items} cnt={itemCount()} tot={subtotal()} removeItem={removeItem} updateQuantity={updateQuantity} />;
}

// The pack. Two things v4 got wrong that matter commercially:
//
//   • It stated the shipping cost but never showed how close you were to
//     clearing the free-shipping threshold. That's the single highest-leverage
//     nudge a cart has, and it was a one-line string.
//   • The summary bar showed subtotal and delivery but not the saving, so
//     "Free" appeared with no sense of what it was worth.
//
// The progress rule at the top of the summary fixes both: it's a literal
// measure of distance to free shipping, and it turns into a meadow confirm
// line the moment it's cleared.
function Pack({ items, cnt, tot, removeItem, updateQuantity }: any) {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W } = useWindowDimensions();
  const tabSpace = useTabBarSpace();
  const { data: allProducts = [] } = useProductsQuery();
  const cartSlugs = items.map((i: any) => i.slug);
  const recs = getCartRecommendations(allProducts as any, cartSlugs, 6);

  // Delivery and GST come from the server, not from a constant here — see the
  // note in app/checkout/index.tsx. This screen has no address yet, so the
  // quote is priced without a destination and the figures it shows are the
  // shop's defaults; checkout re-quotes once a pincode exists.
  const quote = useQuoteQuery(
    (items as CartItem[]).map((i) => ({
      slug: i.slug,
      size: i.size,
      quantity: i.quantity,
      productId: i.productId,
      variantId: i.variantId ?? null,
      customDesignId: i.customDesignId,
    })),
  );
  const q = quote.data;
  const ship = q?.effectiveShipping ?? null;
  const grand = q?.totalAmount ?? null;
  const money = (v: number | null | undefined) => (v == null ? "—" : formatPrice(v));

  // WHAT THE SERVER COULD NOT PRICE.
  //
  // The cart is a local zustand store that persists across launches, so a line
  // can sit in it for a week while the product is deactivated or sells out.
  // Nothing re-checked it: the screen showed a stale price, and the first
  // anyone heard was the order arriving short, because the checkout endpoint
  // silently skipped those lines. The quote resolves every line against the
  // database anyway, so it can say which ones no longer exist — here, before
  // somebody presses Checkout rather than after.
  const unavailable = q?.unavailable ?? [];
  const unavailableNames = (items as CartItem[])
    .filter((i) => unavailable.includes(i.slug))
    .map((i) => i.name);

  // The free-shipping meter still uses the threshold constant: it is a
  // marketing progress bar against a published number, not a charge, and the
  // server agrees with it (store_settings.free_shipping_threshold = ₹2,000).
  const remaining = FREE_SHIPPING_THRESHOLD_PAISE - tot;
  const qualifies = ship === 0 || remaining <= 0;
  const pct = Math.max(0, Math.min(100, (tot / FREE_SHIPPING_THRESHOLD_PAISE) * 100));

  return (
    <View style={s.root}>
      <StatusCap />
      {/* Same ink panel as every other screen's header, carrying the two
          figures that matter here. The pack used to open on a cream bar and a
          hairline — indistinguishable from Saved, Orders or Settings. */}
      <View style={[s.panel, { paddingTop: insets.top + 12 }]}>
        <Topography
          width={SCREEN_W}
          height={260}
          color={C.sage}
          opacity={0.12}
          lines={8}
          seed={5.1}
          originX={0.8}
          originY={0.3}
        />
        <View style={{ paddingHorizontal: S.gutter }}>
          <Text style={s.panelEyebrow}>READY TO GO</Text>
          <Text style={s.panelTitle}>Your pack</Text>
          <View style={s.panelStats}>
            <View style={s.panelStat}>
              <Text style={s.panelStatV}>{cnt}</Text>
              <Text style={s.panelStatL}>{cnt === 1 ? "PIECE" : "PIECES"}</Text>
            </View>
            <View style={s.panelStatRule} />
            <View style={s.panelStat}>
              <Text style={s.panelStatV}>{formatPrice(tot)}</Text>
              <Text style={s.panelStatL}>SUBTOTAL</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 260 + tabSpace }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: S.gutter }}>
          {items.map((it: any, i: number) => (
            <Animated.View
              key={`${it.productId}-${it.size}-${it.customDesignId ?? "plain"}`}
              exiting={FadeOutLeft.duration(M.base)}
              layout={LinearTransition.duration(M.base)}
            >
              {i > 0 ? <Rule weight="soft" /> : null}
              <Swipeable
                renderRightActions={() => (
                  <TouchableOpacity
                    style={s.swipeDelete}
                    onPress={() => {
                      haptics.warning();
                      removeItem(it.productId, it.size, it.customDesignId);
                      toast.show("Removed from pack");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${it.name} from your pack`}
                  >
                    <Icon name="delete" size={20} color={C.white} />
                  </TouchableOpacity>
                )}
              >
                <View style={s.item}>
                  <TouchableOpacity onPress={() => router.push(`/product/${it.slug}`)} style={s.thumb} activeOpacity={0.9}>
                    {it.image ? <Image source={{ uri: it.image }} style={s.thumbImg} contentFit="cover" alt="" /> : null}
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <TouchableOpacity onPress={() => router.push(`/product/${it.slug}`)} activeOpacity={0.7}>
                      <Title numberOfLines={2}>{it.name}</Title>
                    </TouchableOpacity>
                    <Mono color={C.textMuted} style={{ marginTop: 5 }}>
                      {[it.size ? `SIZE ${it.size}` : null, it.colorName?.toUpperCase(), it.customDesignId ? "CUSTOM" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Mono>

                    <View style={s.itemFoot}>
                      <View style={s.qty}>
                        <TouchableOpacity
                          onPress={() => {
                            // Stepping down from 1 removes the line. The store
                            // has always done that, but the button gave the
                            // same quiet selection tick as any other decrement,
                            // so an item vanished with no acknowledgement —
                            // swipe-to-delete, the deliberate gesture, was the
                            // only removal that said anything.
                            const last = it.quantity <= 1;
                            if (last) {
                              haptics.warning();
                              toast.show("Removed from pack");
                            } else {
                              haptics.select();
                            }
                            updateQuantity(it.productId, it.quantity - 1, it.size, it.customDesignId);
                          }}
                          hitSlop={10}
                          accessibilityLabel={it.quantity <= 1 ? "Remove from pack" : "Decrease quantity"}
                        >
                          <Icon name={it.quantity <= 1 ? "delete" : "remove"} size={17} color={C.textMid} />
                        </TouchableOpacity>
                        <Text style={s.qtyV}>{it.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            haptics.select();
                            updateQuantity(it.productId, it.quantity + 1, it.size, it.customDesignId);
                          }}
                          hitSlop={10}
                          accessibilityLabel="Increase quantity"
                        >
                          <Icon name="add" size={17} color={C.ink} />
                        </TouchableOpacity>
                      </View>
                      <Numeric>{formatPrice(it.price * it.quantity)}</Numeric>
                    </View>
                  </View>
                </View>
              </Swipeable>
            </Animated.View>
          ))}
          <Rule weight="soft" />
        </View>

        {recs.length > 0 ? (
          <View style={{ marginTop: S.section }}>
            <SectionHead
              eyebrow="Goes with it"
              title="Complete the kit."
              size="d3"
              style={{ paddingHorizontal: S.gutter }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: S.md, paddingHorizontal: S.gutter, paddingTop: S.lg }}
            >
              {recs.map((r) => (
                <ProductCard
                  key={r.id}
                  width={144}
                  productId={r.id}
                  slug={r.slug}
                  name={r.name}
                  price={r.price}
                  imageUri={r.images?.[0] ?? ""}
                  meta={r.collection?.name}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Summary ───────────────────────────────────────────────────────
          Offset by the floating tab bar's footprint rather than pinned to 0.
          The bar no longer sits in layout flow (it floats over the page), so
          `bottom: 0` would put the checkout button underneath it. `tabSpace`
          is the one number that describes that footprint — see
          components/TabBar.tsx. ──────────────────────────────────────────── */}
      <View style={[s.summary, { bottom: tabSpace }]}>
        <View style={s.shipRow}>
          <Mono color={qualifies ? C.forest : C.textMuted}>
            {qualifies ? "FREE SHIPPING UNLOCKED" : `${formatPrice(remaining)} TO FREE SHIPPING`}
          </Mono>
          {qualifies ? <Icon name="check_circle" size={14} color={C.forest} filled /> : null}
        </View>
        <View style={s.track}>
          <View style={[s.trackFill, { width: `${pct}%`, backgroundColor: qualifies ? C.forest : C.ink }]} />
        </View>

        <View style={s.totals}>
          {unavailableNames.length > 0 ? (
            <View style={s.gone}>
              <Icon name="error" size={16} color={C.danger} />
              <Body color={C.danger} style={{ flex: 1 }}>
                {unavailableNames.length === 1
                  ? `${unavailableNames[0]} is no longer available and is not in this total. Remove it to check out.`
                  : `${unavailableNames.length} pieces are no longer available and are not in this total. Remove them to check out.`}
              </Body>
            </View>
          ) : null}
          <View style={s.totalRow}>
            <Body color={C.textMid}>Subtotal</Body>
            <Numeric>{formatPrice(tot)}</Numeric>
          </View>
          <View style={s.totalRow}>
            <Body color={C.textMid}>Delivery</Body>
            <Numeric color={qualifies ? C.forest : C.ink}>
              {ship == null ? "—" : ship === 0 ? "FREE" : formatPrice(ship)}
            </Numeric>
          </View>
          {q && q.taxEnabled && q.taxAmount > 0 ? (
            <View style={s.totalRow}>
              <Body color={C.textMid}>{q.taxIsIgst ? "IGST" : "GST"}</Body>
              <Numeric>{money(q.taxAmount)}</Numeric>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[s.checkout, (unavailableNames.length > 0 || grand == null) && s.checkoutOff]}
          activeOpacity={0.92}
          disabled={unavailableNames.length > 0 || grand == null}
          onPress={() => {
            haptics.tap();
            router.push("/checkout");
          }}
        >
          <Text style={s.checkoutT}>Checkout</Text>
          <View style={s.checkoutRule} />
          <Text style={s.checkoutV}>{money(grand)}</Text>
          <Icon name="arrow_forward" size={19} color={C.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EmptyPack() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { slugs } = useWishlistStore();
  const { data: saved = [] } = useProductsBySlugsQuery(slugs.slice(0, 4));

  return (
    <View style={s.root}>
      {/* Paper screen: the glyphs must be dark. expo-status-bar is
          last-mount-wins, so without this the light glyphs set by the dark
          home hero persist and the clock disappears into the page. */}
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: S.section + tabSpace }} showsVerticalScrollIndicator={false}>
        <View style={[s.header, { paddingTop: insets.top + 14 }]}>
          <Eyebrow>Empty</Eyebrow>
          <Display1 style={{ marginTop: 8 }}>Your pack</Display1>
          <Rule weight="ink" style={{ marginTop: S.lg }} />
        </View>

        <View style={{ paddingHorizontal: S.gutter }}>
          {/* An empty pack used to be one grey icon and two buttons on cream —
              the emptiest screen in the app, on the tab people open when they
              are closest to buying. It now offers the three things you can
              actually do, each in its own colour, including renting, which this
              screen never mentioned at all. */}
          <View style={s.emptyHero}>
            <Icon name="backpack" size={26} color={C.forestDeep} />
            <Display2 style={{ marginTop: S.sm }}>Light, but empty.</Display2>
            <Body color={C.textMid} style={{ marginTop: 6, lineHeight: 22 }}>
              Nothing packed yet. Three ways to change that.
            </Body>
          </View>

          <View style={{ gap: S.sm, marginTop: S.lg }}>
            {([
              ["storefront", "The gear room", "Small-batch layers, packs and headwear.", C.cream, C.ink, "/(tabs)/shop"],
              ["draw", "The studio", "Put your own artwork on a heavyweight blank.", C.forest12, C.forestDeep, "/(tabs)/design"],
              ["camping", "Rent gear", "Tents, bags and poles by the day.", C.clay12, C.clayDeep, "/rent"],
            ] as const).map(([icon, title, body, bg, fg, href]) => (
              <TouchableOpacity
                key={title}
                activeOpacity={0.85}
                onPress={() => router.push(href)}
                accessibilityRole="button"
                accessibilityLabel={title}
                style={[s.routeTile, { backgroundColor: bg }]}
              >
                <View style={[s.routeIcon, { backgroundColor: fg }]}>
                  <Icon name={icon} size={17} color={C.paper} />
                </View>
                <View style={{ flex: 1 }}>
                  <Title>{title}</Title>
                  <Body color={C.textMid} style={{ marginTop: 1, fontSize: 13 }}>{body}</Body>
                </View>
                <Icon name="arrow_forward" size={18} color={fg} />
              </TouchableOpacity>
            ))}
          </View>

          {saved.length > 0 ? (
            <View style={{ marginTop: S.block }}>
              <SectionHead
                eyebrow={`Saved · ${slugs.length}`}
                title="You were looking at these."
                size="d3"
              />
              <View style={s.savedGrid}>
                {(saved as any[]).map((p) => (
                  <View key={p.id} style={{ width: "48%" }}>
                    <ProductCard
                      productId={p.id}
                      slug={p.slug}
                      name={p.name}
                      price={p.price}
                      imageUri={p.images?.[0] ?? ""}
                      meta={p.collection?.name}
                      variants={p.variants}
                      showQuickAdd
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  emptyHero: {
    backgroundColor: C.paperDeep,
    borderRadius: R.panel,
    padding: S.lg,
    marginTop: S.lg,
  },
  routeTile: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    borderRadius: R.panel, padding: S.md,
  },
  routeIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  gone: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: C.danger12,
    borderRadius: R.panel,
    padding: 12,
    marginBottom: S.md,
  },
  checkoutOff: { opacity: 0.45 },
  root: { flex: 1, backgroundColor: C.paper },
  header: { paddingHorizontal: S.gutter, paddingBottom: S.md },
  headerRow: { flexDirection: "row", alignItems: "flex-end", gap: S.md },
  panel: {
    backgroundColor: C.ink,
    overflow: "hidden",
    borderBottomLeftRadius: R.sheet,
    borderBottomRightRadius: R.sheet,
    paddingBottom: S.lg,
  },
  panelEyebrow: { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.9, color: C.sage },
  panelTitle: { fontFamily: F.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.2, color: C.paper, marginTop: 8 },
  panelStats: { flexDirection: "row", marginTop: S.lg },
  panelStat: { flex: 1 },
  panelStatRule: { width: 1, backgroundColor: "rgba(251,247,239,0.14)", marginHorizontal: S.md },
  panelStatV: { fontFamily: F.display, fontSize: 26, lineHeight: 30, color: C.paper },
  panelStatL: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.2, color: "rgba(251,247,239,0.5)", marginTop: 4 },

  item: { flexDirection: "row", gap: S.md, alignItems: "flex-start", paddingVertical: S.lg, backgroundColor: C.paper },
  swipeDelete: { backgroundColor: C.danger, width: 68, alignItems: "center", justifyContent: "center", borderRadius: R.card, marginVertical: S.md },
  thumb: { width: 72, height: 90, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  thumbImg: { width: "100%", height: "100%" },
  itemFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: S.md },
  qty: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: C.ruleMed, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 13 },
  qtyV: { fontFamily: F.monoBold, fontSize: 13, color: C.ink, minWidth: 12, textAlign: "center" },

  summary: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: C.paper,
    borderTopWidth: 1,
    borderTopColor: C.ruleSoft,
    paddingHorizontal: S.gutter,
    paddingTop: S.md,
    paddingBottom: S.md,
    ...SHADOW_BAR,
  },
  shipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  track: { height: 2, backgroundColor: C.sand, marginTop: 8, borderRadius: R.tag, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: R.tag },
  totals: { marginTop: S.md, gap: 5 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  checkout: {
    marginTop: S.md,
    height: 54,
    borderRadius: R.pill,
    backgroundColor: C.forest,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  checkoutT: { fontFamily: F.bodyBold, fontSize: 16, color: C.white, letterSpacing: -0.1 },
  checkoutRule: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.3)" },
  checkoutV: { fontFamily: F.monoBold, fontSize: 14, color: C.white },

  savedGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: S.xl, marginTop: S.xl },
});
