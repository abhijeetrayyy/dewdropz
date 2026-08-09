import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.bar}>
          <Icon name="search" size={20} color={searching ? C.ink : C.textMuted} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => query.trim() && runSearch(query)}
            placeholder="Search gear, collections, materials"
            placeholderTextColor={C.textFaint}
            style={s.input}
            selectionColor={C.forest}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={10}>
              <Icon name="close" size={19} color={C.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text style={s.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <Rule weight="ink" style={{ marginHorizontal: S.gutter }} />

      {!searching ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: S.gutter, paddingTop: S.xl, paddingBottom: S.section }}
          keyboardShouldPersistTaps="handled"
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
          contentContainerStyle={{ paddingHorizontal: S.gutter, paddingTop: S.md, paddingBottom: S.section }}
          keyboardShouldPersistTaps="handled"
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
  header: { flexDirection: "row", alignItems: "center", gap: S.md, paddingHorizontal: S.gutter, paddingBottom: S.md },
  bar: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, fontFamily: F.body, fontSize: 17, color: C.ink, paddingVertical: 6 },
  cancel: { fontFamily: F.bodySemiBold, fontSize: 15, color: C.textMid },

  sectionRow: { flexDirection: "row", alignItems: "center" },
  clear: { fontFamily: F.bodySemiBold, fontSize: 13, color: C.ink },
  recentRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: 13 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: S.md },
  collectionRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },

  resultRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingVertical: S.md },
  resultImg: { width: 68, height: 84, borderRadius: R.card, backgroundColor: C.sand },
});
