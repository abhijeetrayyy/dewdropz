import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { Body, Meta, Mono } from "@/components/ui/Type";
import { haptics } from "@/lib/haptics";
import { C, F, R, S } from "@/lib/theme";
import { MONTHS, daysBetween, monthCells, prettyDate, stepMonth, todayLocal } from "@/lib/rent/dates";

/** First and last day of a {year, month}, as plain YYYY-MM-DD — the window to
 *  ask the database for. Built from characters and UTC, never a local clock. */
function firstDayOf(c: { year: number; month: number }): string {
  return `${c.year}-${String(c.month + 1).padStart(2, "0")}-01`;
}
function lastDayOf(c: { year: number; month: number }): string {
  return new Date(Date.UTC(c.year, c.month + 1, 0)).toISOString().slice(0, 10);
}

/**
 * Picking the days a rental runs for.
 *
 * WHY THIS IS HAND-BUILT. The obvious answer is
 * `@react-native-community/datetimepicker`, and it is the wrong one twice
 * over: it is a native module, so adding it invalidates every APK and IPA
 * already on a phone and forces a fresh build for a calendar; and its platform
 * pickers select a single instant, when what a rental needs is a RANGE with
 * some days unselectable. A month grid is a few dozen lines of arithmetic and
 * owes nothing to a native dependency.
 *
 * DATES ARE LOCAL, DELIBERATELY. `new Date().toISOString()` is UTC, so for
 * anybody in IST between midnight and 05:30 it reports yesterday — a customer
 * standing in Dehradun at 00:30 would be shown today as already past and
 * unbookable. `todayLocal()` reads the local calendar fields instead. Every
 * date leaves here as a plain YYYY-MM-DD string, which is what `daterange` in
 * Postgres stores and what the pricing function counts in; no timezone travels
 * with it.
 */

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type Props = {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  /** Longest rental this item allows, so the grid can refuse an over-long range. */
  maxDays: number;
  /**
   * Free units per day, from `rental_item_day_availability`. The buffer is
   * already inside it — a tent due back on the 10th with a day's drying shows
   * held through the 11th and free on the 12th — so this component must never
   * widen it again.
   *
   * A GUIDE TO PICKING, NOT THE AUTHORITY ON BOOKING, and the difference is
   * real. Two units can make a range look free day by day without any ONE unit
   * being free across the whole of it. So a full DAY is untappable, and a
   * RANGE is not refused here: the sentence a person acts on still comes from
   * the quote, over the whole range, from the same function the booking write
   * uses. Refusing a selection this grid cannot be certain about would block
   * bookings that are genuinely possible.
   */
  days?: Record<string, { free: number; total: number }>;
  /** True while the month's counts are still arriving. Days are offered rather
   *  than greyed while unknown — greying the whole grid on every month step
   *  makes the control feel broken, and a day that turns out to be full is
   *  caught by the availability check before anything is booked. */
  daysLoading?: boolean;
  /** Notified when the visible month changes, so the screen can fetch it. */
  onMonthChange?: (from: string, to: string) => void;
};

export function DateRange({ from, to, onChange, maxDays, days, daysLoading, onMonthChange }: Props) {
  const today = todayLocal();
  const [cursor, setCursor] = useState(() => {
    const base = from ?? today;
    return { year: Number(base.slice(0, 4)), month: Number(base.slice(5, 7)) - 1 };
  });

  // The cells for the month on screen: leading blanks so the 1st lands on the
  // right weekday, then the days themselves.
  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor]);

  // Can't go back past the month containing today — those days are all dead.
  const atFloor = cursor.year === Number(today.slice(0, 4)) && cursor.month === Number(today.slice(5, 7)) - 1;

  function step(delta: number) {
    haptics.select();
    setCursor((c) => {
      const next = stepMonth(c, delta);
      // Told on the way out rather than through an effect on `cursor`: the
      // month is changing because somebody tapped, which is an event, and an
      // effect would be a second render to say what this handler already knows.
      onMonthChange?.(firstDayOf(next), lastDayOf(next));
      return next;
    });
  }

  function pick(iso: string) {
    haptics.select();
    // First tap sets the start. Second tap sets the end — unless it lands
    // before the start or beyond the allowed length, in which case treating it
    // as a NEW start is what somebody correcting themselves actually meant.
    if (!from || (from && to)) return onChange(iso, null);
    if (iso < from) return onChange(iso, null);
    if (daysBetween(from, iso) > maxDays) return onChange(iso, null);
    onChange(from, iso);
  }

  return (
    <View>
      <View style={s.head}>
        <Pressable
          onPress={() => step(-1)}
          disabled={atFloor}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: atFloor }}
          style={s.arrow}
        >
          <Icon name="chevron_left" size={20} color={atFloor ? C.disabled : C.ink} />
        </Pressable>
        <Body style={{ fontFamily: F.displayRegular }}>
          {MONTHS[cursor.month]} {cursor.year}
        </Body>
        <Pressable
          onPress={() => step(1)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={s.arrow}
        >
          <Icon name="chevron_right" size={20} color={C.ink} />
        </Pressable>
      </View>

      <View style={s.week}>
        {WEEKDAYS.map((d, i) => (
          <Mono key={i} style={s.weekday}>{d}</Mono>
        ))}
      </View>

      <View style={s.grid}>
        {cells.map((iso, i) => {
          if (!iso) return <View key={`b${i}`} style={s.cell} />;
          const past = iso < today;
          const isFrom = iso === from;
          const isTo = iso === to;
          const inRange = !!from && !!to && iso > from && iso < to;
          const tooLong = !!from && !to && iso > from && daysBetween(from, iso) > maxDays;
          const info = days?.[iso];
          const full = info !== undefined && info.free === 0;
          const disabled = past || tooLong || full;
          const selected = isFrom || isTo;
          // Only where it is SCARCE. Printing "6" under every day of an empty
          // month is noise that hides the one day saying "1".
          const scarce = !disabled && info !== undefined && info.free > 0 && info.free <= 2;

          return (
            <Pressable
              key={iso}
              onPress={() => pick(iso)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={
                past
                  ? `${prettyDate(iso)}, in the past`
                  : full
                    ? `${prettyDate(iso)}, none free`
                    : info
                      ? `${prettyDate(iso)}, ${info.free} free`
                      : prettyDate(iso)
              }
              accessibilityState={{ disabled, selected }}
              style={[s.cell, inRange && s.inRange, selected && s.selected]}
            >
              <Body
                style={[s.day, full && s.dayFull]}
                // `disabled` is the one token deliberately below 4.5:1 —
                // WCAG exempts inactive controls, and a greyed day that meets
                // contrast reads as tappable.
                color={selected ? C.paper : disabled ? C.disabled : C.ink}
              >
                {Number(iso.slice(8))}
              </Body>
              {scarce && (
                <Mono style={s.scarce} color={selected ? C.paper : C.clayDeep}>
                  {info!.free}
                </Mono>
              )}
            </Pressable>
          );
        })}
      </View>

      <Meta style={{ marginTop: S.sm }}>
        {daysLoading && !from
          ? "Checking the locker…"
          : !from
          ? "Tap the day you want it from."
          : !to
            ? `From ${prettyDate(from)} — now tap the day you bring it back.`
            : `${prettyDate(from)} → ${prettyDate(to)} · ${daysBetween(from, to)} days, both counted.`}
      </Meta>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: S.sm },
  arrow: { padding: 4 },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  // Seven to a row, sized by fraction rather than a fixed width so the grid
  // holds on a 320pt phone and a tablet alike.
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  inRange: { backgroundColor: C.forest12 },
  selected: { backgroundColor: C.forest, borderRadius: R.card },
  day: { fontSize: 15 },
  // Struck rather than merely faded: "the 14th is full" is information somebody
  // is using to pick a different weekend, so the number stays readable and the
  // meaning lives in the line through it.
  dayFull: { textDecorationLine: "line-through" },
  scarce: { fontSize: 9, lineHeight: 10, marginTop: 1 },
});
