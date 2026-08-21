import { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Img as Image } from "@/components/ui/Img";
import Animated, { FadeIn } from "react-native-reanimated";
import { useCollectionsQuery, useProductsQuery } from "@/lib/queries";
import { getRecentSearches, pushRecentSearch, clearRecentSearches } from "@/lib/recentSearches";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Rule } from "@/components/editorial/Rule";
import { EmptyState } from "@/components/ui/EmptyState";
import { Body, Eyebrow, Mono, Numeric, Title } from "@/components/ui/Type";
import { formatPrice } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { C, F, M, R, S } from "@/lib/theme";

const TRENDING = ["Hoodies", "Custom prints", "Packs", "Under ₹1,500"];

// Search. Two functional fixes on top of the restyle:
//
//   • v4 matched on `p.name` only, so searching "hoodie" missed anything whose
//     name didn't literally contain it while its description did. Now name,
//     collection and description all participate.
//   • v4 rendered zero results as an empty white space with a "0 pieces"
//     count and nothing else. There's a real empty state now.
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  // A genuine platform split, not a tuning preference. iOS presents a modal as
  // a sheet already positioned below the status bar, so adding the safe-area
  // inset there stacks a second one and leaves the field floating in dead ink.
  // Android presents the same route edge-to-edge, so WITHOUT the inset the
  // search field runs underneath the clock and the signal icons. No single
  // value is correct on both.
  const panelTop = Platform.OS === "android" ? insets.top + S.sm : S.lg;
  const { data: products = [] } = useProductsQuery();
  const { data: collections = [] } = useCollectionsQuery();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    getRecentSearches().then(setRecent);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (products as any[]).filter((p) => {
      const haystack = [p.name, p.collection?.name, p.short_description, p.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [products, query]);

  function runSearch(term: string) {
    haptics.select();
    setQuery(term);
    pushRecentSearch(term).then((next) => next && setRecent(next));
  }

  const searching = query.trim().length > 0;

  return (
    <View style={s.root}>
      {/* The other half of the same platform split as `panelTop` above. Insetting
          the field stopped it running under the clock, but the PANEL still fills
          the whole window on Android, so the ink surface sits behind a status bar
          that is still drawing the root layout's dark glyphs — near-black clock,
          signal and battery on near-black ink.
          Android only: on iOS the sheet leaves paper up there, where dark glyphs
          are the correct ones and asking for light would erase them instead. */}
      {Platform.OS === "android" ? <StatusBar style="light" /> : null}
      {/* The field lives INSIDE the ink panel rather than on a cream bar above
          a hairline. Search is a modal that opens over whatever you were doing,
          so it needs to read as a distinct surface, not as the previous screen
          with a text box bolted to the top. */}
      <View style={[s.panel, { paddingTop: panelTop }]}>
        <View style={s.panelRow}>
          <View style={s.bar}>
            <Icon name="search" size={19} color={searching ? C.paper : "rgba(251,247,239,0.5)"} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => query.trim() && runSearch(query)}
              placeholder="Search gear, collections, materials"
              placeholderTextColor="rgba(251,247,239,0.4)"
              style={s.input}
              selectionColor={C.sage}
              returnKeyType="search"
              keyboardAppearance="dark"
            />
            {query.length > 0 ? (
              <TouchableOpacity
                onPress={() => setQuery("")}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Icon name="close" size={18} color="rgba(251,247,239,0.6)" />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
            <Text style={s.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!searching ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.section }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {recent.length > 0 ? (
            <View style={{ marginBottom: S.block }}>
              <View style={s.sectionRow}>
                <Eyebrow color={C.textMuted} style={{ flex: 1 }}>
                  Recent
                </Eyebrow>
                <TouchableOpacity
                  onPress={() => {
                    clearRecentSearches();
                    setRecent([]);
                  }}
                  hitSlop={8}
                >
                  <Text style={s.clear}>Clear</Text>
                </TouchableOpacity>
              </View>
              <Rule weight="soft" style={{ marginTop: 9 }} />
              {recent.map((r) => (
                <TouchableOpacity key={r} style={s.recentRow} onPress={() => runSearch(r)} activeOpacity={0.7}>
                  <Icon name="history" size={18} color={C.textFaint} />
                  <Body style={{ flex: 1 }}>{r}</Body>
                  <Icon name="north_west" size={17} color={C.faintIcon} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={{ marginBottom: S.block }}>
            <Eyebrow color={C.textMuted}>Trending</Eyebrow>
            <Rule weight="soft" style={{ marginTop: 9 }} />
            <View style={s.chipWrap}>
              {TRENDING.map((t) => (
                <Chip key={t} label={t} onPress={() => runSearch(t)} />
              ))}
            </View>
          </View>

          {collections.length > 0 ? (
            <View>
              <Eyebrow color={C.textMuted}>Browse by collection</Eyebrow>
              <Rule weight="soft" style={{ marginTop: 9 }} />
              {(collections as any[]).map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  style={s.collectionRow}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/collections/${c.slug}`)}
                >
                  <Mono color={C.textFaint} style={{ width: 20 }}>
                    {String(i + 1).padStart(2, "0")}
                  </Mono>
                  <Title style={{ flex: 1 }}>{c.name}</Title>
                  <Icon name="arrow_forward" size={17} color={C.faintIcon} />
                </TouchableOpacity>
              ))}
              <Rule weight="soft" />
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: S.section }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Mono color={C.textMuted} style={{ paddingVertical: S.sm }}>
            {results.length} {results.length === 1 ? "RESULT" : "RESULTS"} FOR “{query.trim().toUpperCase()}”
          </Mono>
          <Rule weight="soft" />

          {results.length === 0 ? (
            <EmptyState
              eyebrow="No matches"
              title="Nothing by that name."
              body="Try a broader word — “pack”, “tee”, “merino” — or browse the full gear room."
              ctaLabel="Browse everything"
              onPress={() => {
                router.back();
                router.push("/(tabs)/shop");
              }}
            />
          ) : (
            results.map((p: any, i: number) => (
              <Animated.View key={p.id} entering={FadeIn.delay(Math.min(i, 8) * 25).duration(M.base)}>
                <TouchableOpacity style={s.resultRow} activeOpacity={0.7} onPress={() => router.push(`/product/${p.slug}`)}>
                  {p.images?.[0] ? (
                    <Image source={{ uri: p.images[0] }} style={s.resultImg} contentFit="cover" transition={180} alt="" />
                  ) : (
                    <View style={s.resultImg} />
                  )}
                  <View style={{ flex: 1 }}>
                    {p.collection?.name ? <Mono color={C.textMuted}>{p.collection.name.toUpperCase()}</Mono> : null}
                    <Title style={{ marginTop: 4 }} numberOfLines={2}>
                      {p.name}
                    </Title>
                    <Numeric style={{ marginTop: 6 }}>{formatPrice(p.price)}</Numeric>
                  </View>
                  <Icon name="arrow_forward" size={17} color={C.faintIcon} />
                </TouchableOpacity>
                <Rule weight="hair" />
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  panel: {
    backgroundColor: C.ink,
    borderBottomLeftRadius: R.sheet,
    borderBottomRightRadius: R.sheet,
    paddingBottom: S.lg,
    marginBottom: S.block,
  },
  panelRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingHorizontal: S.gutter },
  // A filled pill, so the field looks like somewhere you type rather than a
  // line of text that happens to be editable.
  bar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(251,247,239,0.1)",
    borderRadius: R.chip,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontFamily: F.body, fontSize: 16, color: C.paper, paddingVertical: 11 },
  cancel: { fontFamily: F.bodySemiBold, fontSize: 15, color: C.sage },

  sectionRow: { flexDirection: "row", alignItems: "center" },
  clear: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
  recentRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: 13 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: S.md },
  collectionRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },

  resultRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  resultImg: { width: 68, height: 84, borderRadius: R.card, backgroundColor: C.sand },
});
