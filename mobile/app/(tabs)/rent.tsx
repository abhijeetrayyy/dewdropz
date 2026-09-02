import { useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Animated, { FadeInDown, useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { Img as Image } from "@/components/ui/Img";
import { ScreenHeader } from "@/components/editorial/ScreenHeader";
import { StatusCap } from "@/components/ui/StatusCap";
import { Rule } from "@/components/editorial/Rule";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Body, Eyebrow, Meta, Mono, Numeric, Title } from "@/components/ui/Type";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRange } from "@/components/rent/DateRange";
import { RentFilterSheet } from "@/components/rent/RentFilterSheet";
import {
  useRentalItemsQuery, useRentalCategoriesQuery, useRentalAvailabilityQuery,
} from "@/lib/queries";
import {
  applyRentalFilters, rateBands, shelve, countActiveRental,
  EMPTY_RENTAL_FILTERS, CAPACITY_BUCKETS, type RentalFilters,
} from "@/lib/rental-filter";
import { prettyDate, todayLocal, addDays } from "@/lib/rent/dates";
import { usePullToRefresh } from "@/lib/hooks";
import { useTabBarSpace } from "@/components/TabBar";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";

/**
 * The gear locker.
 *
 * WHAT THIS SCREEN IS FOR, WHICH IS NOT WHAT THE SHOP TAB IS FOR.
 *
 * A shop is browsed; a locker is checked. Somebody arriving here is going
 * somewhere on particular days and needs to know what they can have on those
 * days — so the dates are the FIRST control, and once they are set every row
 * answers for itself. This screen used to be a ruled index of day rates where
 * you opened an item, filled in two date fields, and were told after the fact
 * that it was already booked: the whole transaction happening in the wrong
 * order.
 *
 * AVAILABILITY IS NOT COMPUTED HERE. It arrives from
 * `rental_items_availability` — one call for the whole list, the same predicate
 * `rental_available_units` uses at checkout. The shelf shown and the shelf
 * booked against must be one opinion, and the database owns it.
 *
 * The filtering is `lib/rental-filter.ts`, a deliberate port of the web's copy
 * with a test that holds the two together. Everything that decides which gear a
 * customer sees is identical on both surfaces.
 */
export default function RentIndexScreen() {
  // The header is a SIBLING of the scroll view, not a child, and reads the
  // offset through `scrollY`. Inside it, the whole panel — back button and
  // all — scrolled away and left no way back.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  // How much room the floating header needs at the top of the scroll
  // content. The panel is out of the layout so its collapse cannot resize
  // this list mid-drag — see ScreenHeader. It reports its height here.
  const [headerH, setHeaderH] = useState(0);
  const sheetRef = useRef<BottomSheetModal>(null);

  const { data: items = [], isLoading, isError, refetch } = useRentalItemsQuery();
  const { data: categories = [] } = useRentalCategoriesQuery();
  const { refreshing, onRefresh } = usePullToRefresh([refetch]);
  const tabSpace = useTabBarSpace();

  const [filters, setFilters] = useState<RentalFilters>(EMPTY_RENTAL_FILTERS);
  const [datesOpen, setDatesOpen] = useState(false);

  const { data: availability = {}, isFetching: checkingShelf } = useRentalAvailabilityQuery(
    filters.from, filters.to,
  );

  const datesChosen = !!filters.from && !!filters.to;
  const bands = useMemo(() => rateBands(items), [items]);
  const ctx = useMemo(() => ({ bands, availability }), [bands, availability]);
  const shown = useMemo(() => applyRentalFilters(items, filters, ctx), [items, filters, ctx]);
  const activeCount = countActiveRental(filters);

  // Grouped into shelves only while nothing is narrowed. Once somebody has
  // filtered, headings are noise between them and the answer.
  const grouped = activeCount === 0 && filters.sort === "featured";
  const shelves = useMemo(() => (grouped ? shelve(shown, categories) : []), [grouped, shown, categories]);

  // Most hires in a trekking shop are a weekend. Computed from the LOCAL
  // calendar, never `toISOString()` — for anybody in IST before 05:30 that
  // reports yesterday, which is the bug `lib/rent/dates.ts` exists to end.
  const presets = useMemo(() => {
    const today = todayLocal();
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
    const toSat = (6 - dow + 7) % 7 || 7;
    const sat = addDays(today, toSat);
    return [
      { label: "This weekend", from: sat, to: addDays(sat, 1) },
      { label: "Next weekend", from: addDays(sat, 7), to: addDays(sat, 8) },
      { label: "A week", from: addDays(today, 1), to: addDays(today, 7) },
    ];
  }, []);

  const setDates = (from: string | null, to: string | null) =>
    setFilters((f) => ({ ...f, from: from ?? "", to: to ?? "" }));

  const chips = [
    ...(filters.q.trim() ? [{ k: "q", label: `“${filters.q.trim()}”`, clear: () => setFilters((f) => ({ ...f, q: "" })) }] : []),
    ...filters.categories.map((slug) => ({
      k: `c:${slug}`,
      label: categories.find((c) => c.slug === slug)?.name ?? slug,
      clear: () => setFilters((f) => ({ ...f, categories: f.categories.filter((x) => x !== slug) })),
    })),
    ...filters.fulfilment.map((v) => ({
      k: `f:${v}`, label: v === "pickup" ? "Collect" : "Posted",
      clear: () => setFilters((f) => ({ ...f, fulfilment: f.fulfilment.filter((x) => x !== v) })),
    })),
    ...filters.bands.map((key) => ({
      k: `b:${key}`, label: bands.find((b) => b.key === key)?.label ?? key,
      clear: () => setFilters((f) => ({ ...f, bands: f.bands.filter((x) => x !== key) })),
    })),
    ...filters.capacities.map((key) => ({
      k: `p:${key}`, label: CAPACITY_BUCKETS.find((b) => b.key === key)?.label ?? key,
      clear: () => setFilters((f) => ({ ...f, capacities: f.capacities.filter((x) => x !== key) })),
    })),
    ...(filters.availableOnly ? [{ k: "free", label: "Only what is free", clear: () => setFilters((f) => ({ ...f, availableOnly: false })) }] : []),
  ];

  return (
    <View style={s.root}>
      <StatusCap tone="forest" />
      <ScreenHeader
        tone="forest"
        showBack={false}
        eyebrow="The gear locker"
        title="Rent it"
        lede="A four-season tent is worth carrying and not worth owning if you use it twice a year. Tell us when you are going and the locker will show you what is free."
        stats={items.length > 0 ? [{ label: "In the locker", value: String(items.length) }] : undefined}
        scrollY={scrollY}
        onHeight={setHeaderH}
      />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: S.section + tabSpace }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={headerH} tintColor={C.ink} />}
      >
        {/* ── When are you going ────────────────────────────────────────────
            First, and the width of the screen, because it is the question the
            rest of the list answers. Collapsed to a summary once chosen — a
            month grid permanently open would push every piece of gear below
            the fold on a phone. */}
        <View style={s.dateBand}>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={datesChosen ? "Change your dates" : "Pick your dates"}
            onPress={() => { haptics.select(); setDatesOpen((o) => !o); }}
            style={s.dateHead}
          >
            <Icon name="calendar_month" size={18} color={C.forest} />
            <View style={{ flex: 1 }}>
              <Eyebrow>{datesChosen ? "Your dates" : "When are you going?"}</Eyebrow>
              <Body style={{ marginTop: 2 }}>
                {datesChosen
                  ? `${prettyDate(filters.from)} → ${prettyDate(filters.to)}`
                  : "Pick your dates to see what is free"}
              </Body>
            </View>
            <Icon name={datesOpen ? "expand_less" : "expand_more"} size={20} color={C.textMuted} />
          </TouchableOpacity>

          {!datesOpen && (
            <View style={s.presets}>
              {presets.map((p) => (
                <Chip
                  key={p.label}
                  label={p.label}
                  tone="meadow"
                  selected={filters.from === p.from && filters.to === p.to}
                  onPress={() => setDates(p.from, p.to)}
                />
              ))}
              {datesChosen && (
                <Chip label="Clear" onPress={() => setDates(null, null)} />
              )}
            </View>
          )}

          {datesOpen && (
            <View style={{ marginTop: S.md }}>
              <DateRange
                from={filters.from || null}
                to={filters.to || null}
                onChange={(f, t) => setDates(f, t)}
                // The locker-wide picker is not for one item, so it cannot know
                // an item's maximum. A generous ceiling here; the item screen
                // enforces its own.
                maxDays={30}
              />
            </View>
          )}

          {datesChosen && (
            <Meta style={{ marginTop: S.sm }} accessibilityLiveRegion="polite">
              {checkingShelf ? "Checking the locker…" : "Showing what is free for those dates. Both days count."}
            </Meta>
          )}
        </View>

        {/* ── Search, filter, count ─────────────────────────────────────── */}
        <View style={s.tools}>
          <View style={s.search}>
            <Icon name="search" size={18} color={C.textMuted} />
            <TextInput
              value={filters.q}
              onChangeText={(q) => setFilters((f) => ({ ...f, q }))}
              placeholder="Tent, pack, spikes…"
              placeholderTextColor={C.textMuted}
              accessibilityLabel="Search the gear locker"
              returnKeyType="search"
              style={s.searchInput}
            />
            {!!filters.q && (
              <TouchableOpacity
                onPress={() => setFilters((f) => ({ ...f, q: "" }))}
                accessibilityRole="button"
                accessibilityLabel="Clear the search"
                hitSlop={10}
              >
                <Icon name="close" size={16} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => { haptics.select(); sheetRef.current?.present(); }}
            accessibilityRole="button"
            accessibilityLabel="Filter and sort"
            style={s.filterBtn}
          >
            <Icon name="tune" size={18} color={C.ink} />
            {activeCount > 0 && <Mono style={s.filterCount}>{activeCount}</Mono>}
          </TouchableOpacity>
        </View>

        <View style={s.chips}>
          <Mono style={{ fontSize: 10, color: C.textMuted }}>
            {shown.length} OF {items.length}
          </Mono>
          {chips.map((c) => (
            <Chip key={c.k} label={c.label} selected onPress={c.clear} />
          ))}
        </View>

        <View style={{ paddingHorizontal: S.gutter }}>
          {isError ? (
            <ErrorState message="Couldn't load the locker." onRetry={() => refetch()} />
          ) : isLoading ? (
            <SkeletonRows count={4} />
          ) : items.length === 0 ? (
            <EmptyState
              tone="forest"
              icon="camping"
              title="Nothing to rent just now"
              body="The locker is empty while we check the gear back in. Try again in a day or two."
            />
          ) : shown.length === 0 ? (
            <EmptyState
              tone="forest"
              icon="search_off"
              title="Nothing matches that"
              body={
                filters.availableOnly && datesChosen
                  ? "Nothing is free for those dates with those filters. Try a different weekend, or clear “only what is free” to see when it comes back."
                  : "Try fewer filters, or a different word."
              }
              ctaLabel="Clear the filters"
              // The dates survive a clear. They are the errand, not a filter on
              // it, and wiping the weekend somebody is planning because they
              // unticked "Shelter" is the most annoying thing this could do.
              onPress={() => setFilters({ ...EMPTY_RENTAL_FILTERS, from: filters.from, to: filters.to })}
            />
          ) : grouped ? (
            shelves.map((shelfGroup) => (
              <View key={shelfGroup.category?.slug ?? "loose"} style={{ marginTop: S.lg }}>
                <View style={s.shelfHead}>
                  <Title style={{ fontFamily: F.displayRegular, fontSize: 19 }}>
                    {shelfGroup.category?.name ?? "Everything else"}
                  </Title>
                  <Mono style={{ fontSize: 10, color: C.textMuted }}>{shelfGroup.items.length}</Mono>
                </View>
                {!!shelfGroup.category?.blurb && (
                  <Meta style={{ marginTop: 2 }}>{shelfGroup.category.blurb}</Meta>
                )}
                <Rule weight="soft" style={{ marginTop: S.sm }} />
                {shelfGroup.items.map((it, i) => (
                  <GearRow key={it.id} item={it} index={i} shelf={availability[it.id]} datesChosen={datesChosen} dates={filters} />
                ))}
              </View>
            ))
          ) : (
            shown.map((it, i) => (
              <GearRow key={it.id} item={it} index={i} shelf={availability[it.id]} datesChosen={datesChosen} dates={filters} />
            ))
          )}
        </View>
      </Animated.ScrollView>

      <RentFilterSheet
        ref={sheetRef}
        items={items}
        filters={filters}
        ctx={ctx}
        categories={categories}
        bands={bands}
        datesChosen={datesChosen}
        resultCount={shown.length}
        onChange={setFilters}
        onClear={() => setFilters({ ...EMPTY_RENTAL_FILTERS, from: filters.from, to: filters.to })}
      />
    </View>
  );
}

/**
 * One piece of gear.
 *
 * The row answers "can I have it?" once dates are chosen — which is what a
 * person is scanning for and what the old list made you open an item to learn.
 * A row with nothing free is dimmed rather than removed: disappearing gear
 * reads as a broken screen, and "none free" is the sentence that makes somebody
 * try a different weekend instead of leaving.
 */
function GearRow({
  item, index, shelf, datesChosen, dates,
}: {
  item: import("@/lib/data").RentalItem;
  index: number;
  shelf?: { free: number; total: number };
  datesChosen: boolean;
  dates: { from: string; to: string };
}) {
  const none = datesChosen && shelf?.free === 0;
  const short = datesChosen && shelf !== undefined && shelf.free > 0 && shelf.free <= 2;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320)}>
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={
          `${item.name}, ${formatPrice(item.daily_rate)} a day` +
          (datesChosen && shelf ? `, ${shelf.free} free for your dates` : "")
        }
        onPress={() => {
          haptics.select();
          // The dates travel with the tap, so somebody who has already said
          // when they are going does not say it again on every item.
          const q = datesChosen ? `?from=${dates.from}&to=${dates.to}` : "";
          router.push(`/rent/${item.slug}${q}`);
        }}
        style={[s.row, none && s.rowDim]}
      >
        <View style={s.thumb}>
          {item.images?.[0] ? (
            <Image source={{ uri: item.images[0] }} style={s.img} contentFit="cover" alt="" />
          ) : (
            // An absent photograph is a real state. Saying so beats a grey
            // rectangle that reads as a failed load.
            <View style={s.imgEmpty}>
              <Mono style={{ fontSize: 9 }}>NO PHOTO</Mono>
            </View>
          )}
          {datesChosen && shelf !== undefined && (
            <View style={[s.badge, none ? s.badgeNone : short ? s.badgeShort : s.badgeFree]}>
              <Mono style={s.badgeText}>
                {shelf.total === 0 ? "NONE" : none ? "NONE FREE" : short ? `${shelf.free} LEFT` : `${shelf.free} FREE`}
              </Mono>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Title numberOfLines={1}>{item.name}</Title>
          {!!item.summary && <Meta numberOfLines={2} style={{ marginTop: 2 }}>{item.summary}</Meta>}
          <View style={s.figures}>
            <Numeric style={{ fontSize: 15 }}>{formatPrice(item.daily_rate)}</Numeric>
            <Body color={C.textMuted} style={{ fontSize: 13 }}> / day</Body>
          </View>
          <Mono style={{ fontSize: 10, marginTop: 2 }}>
            {formatPrice(item.deposit)} DEPOSIT, REFUNDED
          </Mono>
          {/* The two facts that separate one piece of gear from another, each
              omitted rather than shown as a dash — an unweighed item should not
              advertise that the shop has not weighed it. */}
          <Mono style={{ fontSize: 10, marginTop: 4, color: C.sageDeep }}>
            {[
              item.allows_pickup && item.allows_shipping ? "COLLECT OR POSTED" : item.allows_pickup ? "COLLECT ONLY" : "POSTED",
              item.capacity != null ? (item.capacity === 1 ? "SOLO" : `SLEEPS ${item.capacity}`) : null,
              item.weight_grams != null ? `${(item.weight_grams / 1000).toFixed(1)} KG` : null,
            ].filter(Boolean).join(" · ")}
          </Mono>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  dateBand: {
    backgroundColor: C.forest12,
    paddingHorizontal: S.gutter, paddingVertical: S.md,
  },
  dateHead: { flexDirection: "row", alignItems: "center", gap: S.sm },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: S.md },
  tools: { flexDirection: "row", gap: S.sm, paddingHorizontal: S.gutter, marginTop: S.md },
  search: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: S.sm,
    borderWidth: 1, borderColor: C.ruleSoft, borderRadius: R.pill,
    paddingHorizontal: S.md, height: 44,
  },
  searchInput: { flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, padding: 0 },
  filterBtn: {
    width: 44, height: 44, borderRadius: R.pill,
    borderWidth: 1, borderColor: C.ruleSoft,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 3,
  },
  filterCount: { fontSize: 10, color: C.forest },
  chips: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8,
    paddingHorizontal: S.gutter, marginTop: S.md,
  },
  shelfHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  row: { flexDirection: "row", gap: S.md, paddingVertical: S.md, alignItems: "flex-start" },
  rowDim: { opacity: 0.55 },
  thumb: { width: 84, height: 100, borderRadius: R.card, overflow: "hidden", backgroundColor: C.sand },
  img: { width: "100%", height: "100%" },
  imgEmpty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.ruleSoft, borderRadius: R.card,
  },
  badge: {
    position: "absolute", top: 5, left: 5,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: R.pill,
  },
  badgeFree: { backgroundColor: C.forest },
  badgeShort: { backgroundColor: C.clayDeep },
  badgeNone: { backgroundColor: C.ink },
  badgeText: { fontSize: 8, color: C.paper },
  figures: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
});
