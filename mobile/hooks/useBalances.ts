import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { BalancesResponse, GroupStatsResponse } from "../types";
import { fetchWithAuth } from "../utils/api";
import { balancesCacheMissingStats } from "./balancesCacheStats";
import { queryKeys } from "./queryKeys";

export type UseBalancesOptions = {
  /** When true and groupId is set, fetch include_stats=true (single round-trip). */
  includeStats?: boolean;
  /** Defaults to true when the user is signed in. */
  enabled?: boolean;
};

export async function fetchBalances(
  groupId?: string | null,
  includeStats = false
): Promise<BalancesResponse> {
  let endpoint = groupId ? `/balances?group_id=${groupId}` : "/balances";
  if (groupId && includeStats) {
    endpoint += (endpoint.includes("?") ? "&" : "?") + "include_stats=true";
  }
  const response = await fetchWithAuth(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch balances: ${response.status}`);
  }
  return response.json();
}

export function useBalances(
  groupId?: string | null,
  options?: UseBalancesOptions
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const includeStats = Boolean(groupId) && Boolean(options?.includeStats);
  const enabledOption = options?.enabled;
  const statsRefetchAttempted = useRef(false);

  const query = useQuery<BalancesResponse, Error>({
    // Use "all" for global fetch to differentiate from specific group fetches
    queryKey: groupId ? queryKeys.balances(groupId) : ["balances", "all"],
    queryFn: async () => {
      const data = await fetchBalances(groupId, includeStats);
      if (includeStats && groupId && data.group_stats) {
        queryClient.setQueryData(queryKeys.groupStats(groupId), data.group_stats);
      }
      return data;
    },
    enabled:
      !!user?.id &&
      (enabledOption !== false) &&
      (!!groupId || groupId === null || groupId === undefined),
    staleTime: 30_000,
    // Prefetch (and any without-stats writer) shares this key; force a remount
    // refetch when the warm cache lacks group_stats so insight tiles are not $0.
    refetchOnMount: (q) => {
      if (balancesCacheMissingStats(q.state.data, includeStats)) {
        return "always";
      }
      return true;
    },
  });

  // Cover the race where a without-stats write lands after mount (no remount).
  useEffect(() => {
    if (!balancesCacheMissingStats(query.data, includeStats)) {
      if (query.data?.group_stats != null) {
        statsRefetchAttempted.current = false;
      }
      return;
    }
    if (query.isFetching || query.isLoading || statsRefetchAttempted.current) {
      return;
    }
    statsRefetchAttempted.current = true;
    void query.refetch();
  }, [
    includeStats,
    query.data,
    query.isFetching,
    query.isLoading,
    query.refetch,
  ]);

  return {
    data: query.data ?? { group_balances: [], overall_balances: [] },
    groupStats: (query.data?.group_stats ?? null) as GroupStatsResponse | null,
    /** True once a response is in memory, including a disk seed via setQueryData. */
    hasData: query.data != null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetched: query.isFetched,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
