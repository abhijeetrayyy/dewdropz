import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "dewdropz-recently-viewed";
const MAX = 9;

// Mirrors the web app's `dewdropz_recently_viewed` localStorage list
// (dedup, most-recent-first, capped at 9) — AsyncStorage is the mobile
// equivalent of localStorage here.
export async function pushRecentlyViewed(slug: string) {
  const raw = await AsyncStorage.getItem(KEY);
  const list: string[] = raw ? JSON.parse(raw) : [];
  const next = [slug, ...list.filter((s) => s !== slug)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function getRecentlyViewed(excludeSlug?: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY);
  const list: string[] = raw ? JSON.parse(raw) : [];
  return excludeSlug ? list.filter((s) => s !== excludeSlug) : list;
}
