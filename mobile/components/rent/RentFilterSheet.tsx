import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Rule } from "@/components/editorial/Rule";
import { Button } from "@/components/Button";
import { Eyebrow, Meta } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/theme";
import {
  RENTAL_SORTS, CAPACITY_BUCKETS, rentalFacetCount, rateBandMatches,
  type RentalFilters, type RentalFilterCtx, type RateBand,
} from "@/lib/rental-filter";
import type { RentalItem, RentalCategory } from "@/lib/data";

/**
 * Narrowing the locker.
 *
 * The web gets a 260px rail that holds still; a phone gets this. What is
 * deliberately the SAME on both is everything that decides an answer:
 * multi-select throughout, a count on every value that says "if I tap this,
 * what do I get", and the identical predicate underneath — `lib/rental-filter`,
 * whose two copies are held together by a drift test.
 *
 * The counts are the reason this is worth a sheet rather than a row of chips.
 * A facet value with no number beside it is a guess; with one, choosing is
 * reading. And a value that would return nothing says so instead of pretending.
 */
type Props = {
  items: RentalItem[];
  filters: RentalFilters;
  ctx: RentalFilterCtx;
  categories: RentalCategory[];
  bands: RateBand[];
  datesChosen: boolean;
  resultCount: number;
  onChange: (f: RentalFilters) => void;
  onClear: () => void;
};

export const RentFilterSheet = forwardRef<BottomSheetModal, Props>(
  ({ items, filters, ctx, categories, bands, datesChosen, resultCount, onChange, onClear }, ref) => {
    const set = (patch: Partial<RentalFilters>) => {
      haptics.select();
      onChange({ ...filters, ...patch });
    };
    const flip = (d: "categories" | "fulfilment" | "bands" | "capacities", v: string) =>
      set({ [d]: filters[d].includes(v) ? filters[d].filter((x) => x !== v) : [...filters[d], v] } as Partial<RentalFilters>);

    const count = (d: keyof RentalFilters, p: (i: RentalItem) => boolean) =>
      rentalFacetCount(items, filters, ctx, d, p);

    const dismiss = () => (ref as React.RefObject<BottomSheetModal> | null)?.current?.dismiss();

    const capacities = CAPACITY_BUCKETS.filter((b) =>
      items.some((i) => i.capacity != null && b.test(i.capacity)),
    );

    return (
      <Sheet ref={ref} snapPoints={["82%"]} eyebrow="Narrow it down" title="Filter & sort" onClose={dismiss}>
        {/* Availability leads, because once dates are set it is the facet that
            decides whether any of the others matter. Rendered even without
            dates — but saying so, rather than offering a control that would
            silently do nothing. */}
        <Section eyebrow="Availability">
          {datesChosen ? (
            <View style={s.row}>
              <Chip
                label="Only what is free"
                tone="meadow"
                count={count("availableOnly", (i) => (ctx.availability?.[i.id]?.free ?? 0) > 0)}
                selected={filters.availableOnly}
                onPress={() => set({ availableOnly: !filters.availableOnly })}
              />
            </View>
          ) : (
            <Meta>Pick your dates first and the locker will show what is actually free.</Meta>
          )}
        </Section>

        <Section eyebrow="Kind of gear">
          <View style={s.row}>
            {categories.map((c) => (
              <Chip
                key={c.slug}
                label={c.name}
                count={count("categories", (i) => i.category?.slug === c.slug)}
                selected={filters.categories.includes(c.slug)}
                onPress={() => flip("categories", c.slug)}
              />
            ))}
          </View>
        </Section>

        <Section eyebrow="How you get it">
          <View style={s.row}>
            {([["pickup", "Collect in Dehradun"], ["ship", "Posted to you"]] as const).map(([v, label]) => (
              <Chip
                key={v}
                label={label}
                count={count("fulfilment", (i) => (v === "pickup" ? i.allows_pickup : i.allows_shipping))}
                selected={filters.fulfilment.includes(v)}
                onPress={() => flip("fulfilment", v)}
              />
            ))}
          </View>
        </Section>

        {bands.length > 0 && (
          <Section eyebrow="Daily rate">
            <View style={s.row}>
              {bands.map((b) => (
                <Chip
                  key={b.key}
                  label={b.label}
                  count={count("bands", (i) => rateBandMatches(b, i.daily_rate))}
                  selected={filters.bands.includes(b.key)}
                  onPress={() => flip("bands", b.key)}
                />
              ))}
            </View>
          </Section>
        )}

        {/* Only the buckets something falls into — and note what this facet
            does NOT do: gear where the question is meaningless (poles, spikes)
            is never removed by it, because a person outfitting a trip for two
            still needs poles. The drift test holds both copies to that. */}
        {capacities.length > 0 && (
          <Section eyebrow="Who it is for">
            <View style={s.row}>
              {capacities.map((b) => (
                <Chip
                  key={b.key}
                  label={b.label}
                  count={count("capacities", (i) => i.capacity != null && b.test(i.capacity))}
                  selected={filters.capacities.includes(b.key)}
                  onPress={() => flip("capacities", b.key)}
                />
              ))}
            </View>
          </Section>
        )}

        <Section eyebrow="Sort by">
          <View style={s.row}>
            {RENTAL_SORTS.map((o) => (
              <Chip
                key={o.key}
                label={o.label}
                selected={filters.sort === o.key}
                onPress={() => set({ sort: o.key })}
              />
            ))}
          </View>
        </Section>

        <Rule weight="soft" />
        <View style={s.actions}>
          <Button title="Reset" variant="quiet" onPress={onClear} style={{ flex: 1 }} />
          <Button
            title={`Show ${resultCount} ${resultCount === 1 ? "piece" : "pieces"}`}
            variant="dark"
            onPress={dismiss}
            style={{ flex: 1.4 }}
          />
        </View>
      </Sheet>
    );
  },
);

RentFilterSheet.displayName = "RentFilterSheet";

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: S.xl }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Rule weight="soft" style={{ marginTop: 9, marginBottom: S.md }} />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actions: { flexDirection: "row", gap: S.sm, marginTop: S.xl },
});
