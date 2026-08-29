import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductCard } from "@/components/ProductCard";
import { ProductReviews } from "@/components/ProductReviews";
import { SizeGuideSheet } from "@/components/product/SizeGuideSheet";
import { Accordion } from "@/components/ui/Accordion";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { OverlayHeader } from "@/components/editorial/OverlayHeader";
import { Img as Image } from "@/components/ui/Img";
import { Icon } from "@/components/ui/Icon";
import { Rule } from "@/components/editorial/Rule";
import { SectionHead } from "@/components/editorial/SectionHead";
import { PullQuote } from "@/components/editorial/PullQuote";
import { SpecTable } from "@/components/editorial/SpecTable";
import { Body, Display1, Eyebrow, Mono, Numeric, Title } from "@/components/ui/Type";
import { formatPrice } from "@/lib/utils";
import { FREE_SHIPPING_THRESHOLD_PAISE } from "@/lib/constants";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { useProductQuery, useProductRatingQuery, useProductsQuery, useRecentlyViewedQuery, useCustomRangeQuery, useRentalForProductQuery } from "@/lib/queries";
import { getRelatedProducts } from "@/lib/data";
import { pushRecentlyViewed } from "@/lib/recentlyViewed";
import { toast } from "@/components/ui/Toast";
import { haptics } from "@/lib/haptics";
import { shareLink } from "@/lib/support";
import { C, F, R, S, SHADOW_BAR } from "@/lib/theme";

const GENERIC_CARE = "Care varies by material — check the product label. When in doubt, cold wash and air dry.";
const SHIPPING_COPY =
  "Free shipping on orders over ₹2,000, flat ₹150 below that. Dispatched from Dehradun within two working days. 7-day returns on unused items with tags. COD available across India.";

// Product detail. The commerce screen, so it earns the most structure:
//
//   gallery (full bleed, glass controls)
//   ── identity: collection · rating · name · price
//   ── description
//   ── size, with the guide one tap away
//   ── the claim (a pull quote, not a beige "why you'll wear it" card)
//   ── specifications as a leader-dotted table
//   ── care / shipping disclosure
//   ── related · recently viewed · reviews
//   sticky buy bar
//
// v4 put the price in Bricolage at 26px next to a strikethrough and a tag,
// three type styles on one baseline. Here the price is mono — it's a number
// you compare, and mono numerals are what a spec sheet uses for exactly that.

export default function ProductScreen() {
  const insets = useSafeAreaInsets();
  // `pick=size` arrives from a quick-add tap on a sized product — the card
  // can't choose a size on the shopper's behalf, so it sends them here.
  const { slug, pick } = useLocalSearchParams<{ slug: string; pick?: string }>();
  const { data: p, isLoading, isPending, isError } = useProductQuery(slug);
  // Null for an ordinary product, which is most of them — the band below then
  // renders nothing rather than claiming studio provenance it does not have.
  const { data: customRange } = useCustomRangeQuery(p ?? undefined);
  const { data: allProducts = [] } = useProductsQuery();
  const { data: recentlyViewed = [] } = useRecentlyViewedQuery(slug);
  const { data: rating } = useProductRatingQuery(p?.id);
  const [size, setSize] = useState("");
  const { addItem } = useCartStore();
  const { has, toggle } = useWishlistStore();
  const sizeGuideRef = useRef<BottomSheetModal>(null);
  const scrollRef = useRef<ScrollView>(null);
  // `onLayout` reports a child's offset within its PARENT, so the size block's
  // position in the scroll content is the info column's own offset (i.e. the
  // gallery height) plus the block's offset inside it.
  const infoY = useRef(0);
  const jumpedToSize = useRef(false);
  // Two-state header: glass over the gallery, paper bar past it.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!p?.variants?.length || size) return;
    const firstInStock = p.variants.find(
      (v) => v.inventory_quantity === null || v.inventory_quantity === undefined || v.inventory_quantity > 0,
    );
    setSize((firstInStock ?? p.variants[0]).name);
  }, [p, size]);

  useEffect(() => {
    if (slug) pushRecentlyViewed(slug);
  }, [slug]);

  // ABOVE the early returns, with every other hook.
  //
  // Placed after them it ran on some renders and not others, and React said so
  // immediately: "Rendered more hooks than during the previous render" — the
  // loading branch returns before it, so the first paint registered one hook
  // fewer than the second. `enabled` inside the query already handles the
  // undefined id; what is not allowed is the CALL being conditional.
  const { data: rentable } = useRentalForProductQuery(p?.id);

  // `isPending` and not just `isLoading`: react-query v5 reports
  // isLoading === false for a query that is disabled or hasn't started,
  // which on a cold deep link (where `slug` lands a tick after first
  // render) dropped straight through to the "not found" branch and
  // showed a real product as missing.
  if (!slug || isLoading || isPending) {
    return (
      <View style={s.root}>
        <Skeleton height={430} radius={0} />
        <View style={{ padding: S.gutter, gap: 14 }}>
          <Skeleton height={10} width="35%" />
          <Skeleton height={34} width="75%" />
          <Skeleton height={16} width="40%" />
          <Skeleton height={14} width="90%" />
        </View>
      </View>
    );
  }

  if (isError || !p) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 20, paddingHorizontal: S.gutter }]}>
        <IconButton name="arrow_back" onPress={() => goBack("/(tabs)/shop")} />
        <EmptyState
          eyebrow="Not found"
          title="This piece isn't here."
          body="It may have been removed, or the link is out of date."
          ctaLabel="Back to the gear room"
          ctaHref="/(tabs)/shop"
          style={{ marginTop: S.xl }}
        />
      </View>
    );
  }

  const variant = p.variants?.find((v) => v.name === size);
  const fp = p.price + (variant?.price_adjustment ?? 0);
  const saved = has(p.slug);
  const related = getRelatedProducts(allProducts as any, p.slug, 6);
  const discountPct = p.compare_at_price ? Math.round((1 - fp / p.compare_at_price) * 100) : undefined;
  const isNew = !!p.created_at && Date.now() - new Date(p.created_at).getTime() < 21 * 86400000;

  const stockQty = variant ? variant.inventory_quantity : p.inventory_quantity;
  const trackedStock = stockQty !== null && stockQty !== undefined;
  const inStock = !trackedStock || stockQty! > 0;
  const lowStock = trackedStock && stockQty! > 0 && stockQty! <= 3;

  const specRows =
    p.attributes
      ?.map((a) => ({ key: a.attribute?.name ?? "", value: a.value?.value ?? a.text_value ?? "" }))
      .filter((r) => r.key && r.value) ?? [];

  function handleAdd() {
    if (!inStock) return;
    haptics.tap();
    addItem(
      {
        productId: p!.id,
        slug: p!.slug,
        name: p!.name,
        price: fp,
        image: p!.images?.[0] ?? "",
        size,
        // Carried through so checkout can link the line to an exact variant
        // instead of re-resolving it from the size string on the server.
        variantId: variant?.id ?? null,
      },
      1,
    );
    toast.success("Added to pack");
  }

  return (
    <View style={s.root}>
      <StatusBar style={scrolled ? "dark" : "light"} />
      <ScrollView
        ref={scrollRef}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const past = e.nativeEvent.contentOffset.y > 260;
          if (past !== scrolled) setScrolled(past);
        }}
      >
        <ProductGallery images={p.images ?? []} discountPct={discountPct} isNew={isNew} />

        <View style={s.info} onLayout={(e) => (infoY.current = e.nativeEvent.layout.y)}>
          {/* ── Identity ─────────────────────────────────────────────────── */}
          <View style={s.topRow}>
            {p.collection ? <Eyebrow style={{ flex: 1 }}>{p.collection.name}</Eyebrow> : <View style={{ flex: 1 }} />}
            {rating && rating.count > 0 ? (
              <View style={s.ratingRow}>
                <Icon name="star" size={15} color={C.clay} filled />
                <Mono color={C.textMid}>
                  {rating.average.toFixed(1)} · {rating.count}
                </Mono>
              </View>
            ) : null}
          </View>

          <Display1 style={{ marginTop: 10 }}>{p.name}</Display1>

          <View style={s.priceRow}>
            <Text style={s.price}>{formatPrice(fp)}</Text>
            {p.compare_at_price ? <Text style={s.strike}>{formatPrice(p.compare_at_price)}</Text> : null}
            <View style={{ flex: 1 }} />
            {inStock ? (
              <View style={s.stockRow}>
                <View style={[s.stockDot, lowStock && { backgroundColor: C.clay }]} />
                <Mono color={lowStock ? C.clayDeep : C.forest}>
                  {lowStock ? `ONLY ${stockQty} LEFT` : "IN STOCK"}
                </Mono>
              </View>
            ) : (
              <Mono color={C.danger}>OUT OF STOCK</Mono>
            )}
          </View>
          {/* "INCL. ALL TAXES" WAS NOT TRUE, and it was on the money path.
              `lib/checkoutPricing.ts` computes
              `subtotal + shipping + tax - discounts`, so GST is ADDED to this
              figure rather than contained in it — a ₹1,899 hoodie carries
              ₹227.88 of 12% GST on top. The label said the opposite of what
              the shop charges, on the first screen where somebody reads a
              price, and it is the same class of thing as the checkout total
              that used to omit GST entirely. */}
          <Mono color={C.textFaint} style={{ marginTop: 6 }}>
            PLUS GST · SHOWN IN YOUR CART
          </Mono>

          {/* The same gear, by the day.
              Six pieces of equipment can be either bought or rented (migration
              098), and until now the product page only ever offered one of the
              two — somebody who needs a tent for one weekend was shown ₹12,000
              and nothing else. Secondary to the buy CTA on purpose: this page
              is the buying page, and renting is the alternative it should
              mention rather than compete with. */}
          {rentable ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push(`/rent/${rentable.slug}`)}
              accessibilityRole="button"
              accessibilityLabel={`Rent this instead, from ${formatPrice(rentable.daily_rate)} a day`}
              style={s.rentInstead}
            >
              <View style={s.rentIcon}>
                <Icon name="camping" size={17} color={C.paper} />
              </View>
              <View style={{ flex: 1 }}>
                <Mono style={{ fontSize: 10 }}>NEED IT FOR ONE TRIP?</Mono>
                <Body style={{ marginTop: 2 }}>
                  Rent it from {formatPrice(rentable.daily_rate)} a day
                </Body>
              </View>
              <Icon name="arrow_forward" size={18} color={C.forestDeep} />
            </TouchableOpacity>
          ) : null}

          {/* ── From the studio ─────────────────────────────────────────────
              A finished, already-printed garment is an ordinary product row —
              its own photographs, its own SKU — so nothing here connected it to
              the studio it came out of. A shopper who liked the shirt but not
              the artwork had no way to find out the same blank takes anything
              they want, and left. Mirrors CustomRangeBanner.tsx on the web. */}
          {customRange ? (
            <View style={s.rangeBand}>
              <Mono color={C.sageDeep} style={{ marginBottom: 6 }}>
                FROM THE DESIGN STUDIO
              </Mono>
              <Text style={s.rangeTitle}>
                {customRange.blank
                  ? `Printed on the ${customRange.blank.name} — put your own artwork on the same garment.`
                  : "Want this with your own artwork on it?"}
              </Text>
              <Text style={s.rangeBody}>
                {customRange.blank
                  ? "Ours or yours, printed to order, front and back."
                  : "We don't stock this exact garment as a blank yet — but these ones we do print to order."}
              </Text>

              {customRange.blank ? (
                <View style={s.rangeBtns}>
                  <TouchableOpacity
                    style={s.rangePrimary}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    onPress={() => {
                      haptics.tap();
                      router.push({
                        pathname: "/customize/[slug]",
                        params: { slug: customRange.blank!.slug, start: "library" },
                      });
                    }}
                  >
                    <Text style={s.rangePrimaryT}>Browse designs</Text>
                    <Icon name="arrow_forward" size={14} color={C.paper} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.rangeSecondary}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    onPress={() => {
                      haptics.tap();
                      router.push({
                        pathname: "/customize/[slug]",
                        params: { slug: customRange.blank!.slug },
                      });
                    }}
                  >
                    <Text style={s.rangeSecondaryT}>Upload your own</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Not stocked. Offer the blanks that exist rather than a dead
                   link — a rail of them, right here, so the answer and the way
                   forward are the same tap. */
                <View style={{ marginTop: 12 }}>
                  {customRange.alternatives.length === 0 ? (
                    <Text style={s.rangeBody}>Nothing is set up in the studio yet.</Text>
                  ) : (
                    <View style={s.rangeAlts}>
                      {customRange.alternatives.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={s.rangeAlt}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`Design on the ${b.name}`}
                          onPress={() => {
                            haptics.tap();
                            router.push({
                              pathname: "/customize/[slug]",
                              params: { slug: b.slug, start: "library" },
                            });
                          }}
                        >
                          <View style={s.rangeAltThumb}>
                            <Image
                              source={{ uri: b.images?.[0] ?? "" }}
                              alt=""
                              style={{ width: "100%", height: "100%" }}
                              contentFit="cover"
                            />
                          </View>
                          <Text style={s.rangeAltName} numberOfLines={2}>{b.name}</Text>
                          <Text style={s.rangeAltPrice}>{formatPrice(b.price)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          ) : null}

          {/* ── Delivery & returns, stated up front ─────────────────────────
              Baymard's product-page research puts two of the most common
              conversion failures here: 67% of sites give no cost transparency
              before checkout, and 44% bury the return policy — 15% of shoppers
              abandon an order over one they can't find. Both were true of this
              page: shipping wasn't mentioned at all above the fold, and returns
              sat inside a collapsed accordion far below the buy bar.
              Three plain lines, resolved against the real thresholds in
              lib/constants.ts, so the numbers can never contradict the cart. */}
          <View style={s.assurance}>
            <View style={s.assuranceRow}>
              <Icon name="local_shipping" size={16} color={C.forestDeep} />
              <Body color={C.textMid} style={{ flex: 1 }}>
                {/* No delivery FIGURE here any more. It was printed from a
                    hardcoded ₹150 that was wrong — the live zone rate is ₹120 —
                    and a product page is exactly where a wrong shipping number
                    does the most damage, because it is the first one a shopper
                    reads. What survives is the threshold, which is a published
                    promise the server also honours; the amount itself is
                    quoted by the server in the cart. */}
                {fp >= FREE_SHIPPING_THRESHOLD_PAISE
                  ? "Free delivery on this item."
                  : `Free delivery over ${formatPrice(FREE_SHIPPING_THRESHOLD_PAISE)} — delivery and GST are shown in your cart.`}
              </Body>
            </View>
            <View style={s.assuranceRow}>
              <Icon name="restart_alt" size={16} color={C.forestDeep} />
              <Body color={C.textMid} style={{ flex: 1 }}>
                7-day returns on unused items with tags.
              </Body>
            </View>
            <View style={s.assuranceRow}>
              <Icon name="payments" size={16} color={C.forestDeep} />
              <Body color={C.textMid} style={{ flex: 1 }}>
                Cash on delivery available across India.
              </Body>
            </View>
          </View>

          <Rule weight="strong" style={{ marginTop: S.lg }} />

          <Body color={C.textMid} style={{ marginTop: S.lg }}>
            {p.description || p.short_description}
          </Body>

          {/* ── Size ─────────────────────────────────────────────────────── */}
          {p.variants && p.variants.length > 0 ? (
            <View
              style={{ marginTop: S.block }}
              onLayout={(e) => {
                if (pick !== "size" || jumpedToSize.current) return;
                jumpedToSize.current = true;
                scrollRef.current?.scrollTo({
                  y: Math.max(0, infoY.current + e.nativeEvent.layout.y - 90),
                  animated: true,
                });
              }}
            >
              <View style={s.sizeHead}>
                <Title style={{ flex: 1 }}>Size</Title>
                <TouchableOpacity
                  style={s.guideLink}
                  // A 16pt icon beside 13pt text is a ~20pt-tall target, less
                  // than half the 44pt minimum — and this is the control that
                  // stops someone guessing their size, i.e. the one that
                  // prevents a return. hitSlop rather than padding, so the link
                  // stays visually a link rather than becoming a second button
                  // competing with "Size" beside it.
                  hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Open size guide"
                  onPress={() => {
                    haptics.tap();
                    sizeGuideRef.current?.present();
                  }}
                >
                  <Icon name="straighten" size={16} color={C.ink} />
                  <Text style={s.guideLinkT}>Size guide</Text>
                </TouchableOpacity>
              </View>
              <View style={s.sizeRow}>
                {p.variants.map((v) => {
                  const active = size === v.name;
                  const oos =
                    v.inventory_quantity !== null && v.inventory_quantity !== undefined && v.inventory_quantity <= 0;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      disabled={oos}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active, disabled: oos }}
                      onPress={() => {
                        haptics.select();
                        setSize(v.name);
                      }}
                      style={[s.sizeBtn, active && s.sizeBtnOn, oos && s.sizeBtnOff]}
                    >
                      <Text style={[s.sizeT, active && s.sizeTOn, oos && s.sizeTOff]}>{v.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* ── The claim ────────────────────────────────────────────────── */}
          {p.highlights && p.highlights.length > 0 ? (
            <PullQuote quote={p.highlights[0]} attribution="Field notes" style={{ marginTop: S.block }} />
          ) : null}

          {/* ── Specifications ───────────────────────────────────────────── */}
          {specRows.length > 0 ? (
            <View style={{ marginTop: S.block }}>
              <SectionHead eyebrow="Specifications" title="The details." size="d3" />
              <SpecTable rows={specRows} style={{ marginTop: S.sm }} />
            </View>
          ) : null}

          {/* ── Disclosure ───────────────────────────────────────────────── */}
          <View style={{ marginTop: S.block, borderTopWidth: 1, borderTopColor: C.ruleStrong }}>
            <Accordion title="Care">
              <Body color={C.textMid} style={{ marginTop: 10 }}>
                {p.care_instructions || GENERIC_CARE}
              </Body>
            </Accordion>
            <Accordion title="Shipping & returns">
              <Body color={C.textMid} style={{ marginTop: 10 }}>
                {SHIPPING_COPY}
              </Body>
            </Accordion>
          </View>

          {/* ── Related ──────────────────────────────────────────────────── */}
          {related.length > 0 ? (
            <View style={{ marginTop: S.section }}>
              <SectionHead eyebrow="Goes with it" title="Complete the kit." size="d3" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: S.md, paddingTop: S.lg }}
              >
                {related.map((r, i) => (
                  <Animated.View key={r.id} entering={FadeInDown.delay(i * 50).duration(380)}>
                    <ProductCard
                      width={148}
                      productId={r.id}
                      slug={r.slug}
                      name={r.name}
                      price={r.price}
                      imageUri={r.images?.[0] ?? ""}
                      meta={r.collection?.name}
                    />
                  </Animated.View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {recentlyViewed.length > 0 ? (
            <View style={{ marginTop: S.section }}>
              <SectionHead eyebrow="You looked at" title="Recently viewed." size="d3" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: S.md, paddingTop: S.lg }}
              >
                {recentlyViewed.map((r) => (
                  <ProductCard
                    key={r.id}
                    width={148}
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

          <ProductReviews productId={p.id} />
        </View>
      </ScrollView>

      {/* ── Floating controls over the gallery ───────────────────────────── */}
      <OverlayHeader
        scrolled={scrolled}
        title={p.name}
        onBack={() => goBack("/(tabs)/shop")}
        renderRight={(tone) => (
          <>
            <IconButton
              name="favorite"
              tone={tone}
              color={saved ? C.clay : undefined}
              filled={saved}
              onPress={() => {
                haptics.tap();
                toggle(p!.slug);
                toast.show(saved ? "Removed from saved" : "Saved");
              }}
            />
            <IconButton
              name="ios_share"
              tone={tone}
              accessibilityLabel={`Share ${p!.name}`}
              // `/products/`, PLURAL. The app's own route is `/product/[slug]`
              // and that path was being handed to `webUrl` verbatim — but the
              // storefront's route is `app/products/[slug]`, so every product
              // anyone shared from this app was a 404 for whoever received it.
              // The most-shared object in the shop, and the link was dead.
              onPress={() => shareLink(p!.name, `/products/${p!.slug}`)}
            />
          </>
        )}
      />

      {/* ── Buy bar ──────────────────────────────────────────────────────── */}
      <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
        {p.is_customizable ? (
          <TouchableOpacity
            // `flex: 1`, as the other branch already does. Without it this
            // button hugs its own text and leaves a third of the buy bar as
            // bare paper to its right — on the one row of the page whose whole
            // job is to be the obvious next action. A lone primary CTA fills
            // its bar; it doesn't sit in the middle of one looking unfinished.
            style={[s.cta, { flex: 1 }]}
            activeOpacity={0.92}
            onPress={() => {
              haptics.tap();
              // Carry the size. Every customizable product also renders the
              // size selector above, and "Design yours" is the ONLY way off
              // this page for one — so without this the shopper picks XL, taps
              // the primary CTA, and lands in a studio that has quietly reset
              // them to S. The selector was decorative on exactly the products
              // where it is the page's only real choice.
              router.push(
                size ? `/customize/${p.slug}?size=${encodeURIComponent(size)}` : `/customize/${p.slug}`,
              );
            }}
          >
            <Icon name="draw" size={20} color={C.white} />
            <Text style={s.ctaT}>Design yours</Text>
            <View style={s.ctaRule} />
            <Text style={s.ctaPrice}>{formatPrice(fp)}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={s.barMeta}>
              <Mono color={C.textMuted}>{size ? `SIZE ${size.toUpperCase()}` : "PRICE"}</Mono>
              <Numeric style={{ fontSize: 16, marginTop: 3 }}>{formatPrice(fp)}</Numeric>
            </View>
            <TouchableOpacity
              style={[s.cta, { flex: 1 }, !inStock && s.ctaOff]}
              activeOpacity={0.92}
              disabled={!inStock}
              onPress={handleAdd}
            >
              <Icon name="backpack" size={20} color={C.white} />
              <Text style={s.ctaT}>{inStock ? "Add to pack" : "Out of stock"}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <SizeGuideSheet
        ref={sizeGuideRef}
        currentSize={size}
        onPickSize={(v) => {
          setSize(v);
          sizeGuideRef.current?.dismiss();
        }}
        onClose={() => sizeGuideRef.current?.dismiss()}
      />
    </View>
  );
}

const s = StyleSheet.create({
  rentInstead: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    backgroundColor: C.forest12, borderRadius: R.panel,
    padding: S.md, marginTop: S.lg,
  },
  rentIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center", backgroundColor: C.forest,
  },
  root: { flex: 1, backgroundColor: C.paper },
  info: { paddingHorizontal: S.gutter, paddingTop: S.xl },

  topRow: { flexDirection: "row", alignItems: "center", gap: S.sm },
  assurance: {
    marginTop: S.lg,
    gap: 10,
    backgroundColor: C.forest12,
    borderRadius: R.panel,
    padding: S.md,
  },
  assuranceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5 },

  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 14 },
  // Mono, and the largest numeral in the app. A price is data first.
  price: { fontFamily: F.monoBold, fontSize: 22, letterSpacing: 0.2, color: C.ink },
  strike: { fontFamily: F.mono, fontSize: 13, color: C.textFaint, textDecorationLine: "line-through" },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stockDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: C.forest },

  sizeHead: { flexDirection: "row", alignItems: "center", gap: S.sm },
  guideLink: { flexDirection: "row", alignItems: "center", gap: 5 },
  guideLinkT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
  sizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: S.md },
  sizeBtn: {
    minWidth: 62,
    // Already clears the 44pt touch minimum; minHeight rather than height so it
    // also survives large text instead of clipping the size someone is buying.
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: C.ruleMed,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeBtnOn: { backgroundColor: C.ink, borderColor: C.ink },
  sizeBtnOff: { borderColor: C.ruleHair, backgroundColor: "transparent" },
  sizeT: { fontFamily: F.bodyMedium, fontSize: 15, color: C.ink },
  sizeTOn: { fontFamily: F.bodyBold, color: C.paper },
  sizeTOff: { color: C.disabled, textDecorationLine: "line-through" },

  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.paper,
    borderTopWidth: 1,
    borderTopColor: C.ruleSoft,
    paddingHorizontal: S.gutter,
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    ...SHADOW_BAR,
  },
  barMeta: { minWidth: 78 },
  cta: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: C.forest,
    borderRadius: R.pill,
    // minHeight, matching components/Button.tsx: text scales with the system
    // setting by default, and a 16pt label runs to ~50pt at the top
    // accessibility sizes — inside a fixed 54 that clips the buy button.
    minHeight: 54,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaOff: { backgroundColor: C.disabled },
  ctaT: { fontFamily: F.bodyBold, fontSize: 16, color: C.white, letterSpacing: -0.1 },
  ctaRule: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.3)" },
  // ── From the studio band ────────────────────────────────────────────────
  rangeBand: {
    marginTop: 18, padding: 16, borderRadius: R.panel,
    backgroundColor: C.forest12, borderWidth: 1, borderColor: C.sage12,
  },
  rangeTitle: { fontFamily: F.display, fontSize: 18, lineHeight: 24, color: C.ink, letterSpacing: -0.2 },
  rangeBody: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.textMid, marginTop: 6 },
  rangeBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  rangePrimary: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.forest, borderRadius: R.pill, paddingVertical: 11, paddingHorizontal: 18,
  },
  rangePrimaryT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.paper, letterSpacing: -0.1 },
  rangeSecondary: {
    borderRadius: R.pill, paddingVertical: 11, paddingHorizontal: 18,
    borderWidth: 1, borderColor: C.forest,
  },
  rangeAlts: { flexDirection: "row", gap: 8 },
  rangeAlt: { width: 88 },
  rangeAltThumb: {
    width: "100%", aspectRatio: 4 / 5, borderRadius: R.card, overflow: "hidden",
    backgroundColor: C.sand, borderWidth: 1, borderColor: C.rule,
  },
  rangeAltName: { fontFamily: F.bodySemiBold, fontSize: 10, color: C.ink, marginTop: 4, lineHeight: 13 },
  rangeAltPrice: { fontFamily: F.mono, fontSize: 9, color: C.textMid, marginTop: 1 },
  rangeSecondaryT: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.forest, letterSpacing: -0.1 },

  ctaPrice: { fontFamily: F.monoBold, fontSize: 13, color: C.white },
});
