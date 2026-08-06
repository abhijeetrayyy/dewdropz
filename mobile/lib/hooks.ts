import { useState } from "react";

// Shared pull-to-refresh state: wraps one or more React Query `refetch`
// calls so `<RefreshControl refreshing={...} onRefresh={...}>` reflects the
// real in-flight state instead of a hardcoded `false` — several screens
// previously showed "pull to try again" copy with no RefreshControl wired
// to it at all. Not memoized with useCallback: refetcher arrays are always
// passed as fresh literals from call sites, so memoizing against a
// variable-length array would fight React's hook-deps rules for no benefit.
export function usePullToRefresh(refetchers: (() => Promise<unknown>)[]) {
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all(refetchers.map((fn) => fn()));
    } finally {
      setRefreshing(false);
    }
  }

  return { refreshing, onRefresh };
}
