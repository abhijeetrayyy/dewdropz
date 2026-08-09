import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "dewdropz-recent-searches";
const MAX = 6;

export async function pushRecentSearch(term: string) {
  const t = term.trim().toLowerCase();
  if (!t) return;
  const raw = await AsyncStorage.getItem(KEY);
  const list: string[] = raw ? JSON.parse(raw) : [];
  const next = [t, ...list.filter((s) => s !== t)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function getRecentSearches(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearRecentSearches() {
  await AsyncStorage.removeItem(KEY);
}
