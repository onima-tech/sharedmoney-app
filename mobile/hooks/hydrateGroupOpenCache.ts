import AsyncStorage from "@react-native-async-storage/async-storage";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { BalancesResponse, Participant, Settlement, SettlementsResponse } from "../types";
import {
  clearSavedBalancesAndLedgers,
  hydrateGroupOpenCache,
  peekAllBalances,
  peekGroupOpenOrder,
  peekGroupSnapshot,
  resetGroupOpenMemory,
} from "../utils/groupOpenCache";
import { queryKeys } from "./queryKeys";

const hydrated = new Map<string, Promise<void>>();

function keepExisting<T>(current: T | undefined, saved: T): T {
  return current === undefined ? saved : current;
}

/** Paint saved balances and the first ledger page into the query cache. */
export function hydrateGroupQueries(userId: string, client: QueryClient): Promise<void> {
  const existing = hydrated.get(userId);
  if (existing) return existing;
  const promise = hydrateGroupOpenCache(userId, AsyncStorage).then(() => {
    const all = peekAllBalances(userId);
    if (all) {
      client.setQueryData<BalancesResponse>(["balances", "all"], (current) => keepExisting(current, all));
    }
    for (const groupId of peekGroupOpenOrder(userId)) {
      const snapshot = peekGroupSnapshot(userId, groupId);
      if (!snapshot) continue;
      if (snapshot.balances) {
        client.setQueryData<BalancesResponse>(
          queryKeys.balances(groupId),
          (current) => keepExisting(current, snapshot.balances as BalancesResponse),
        );
      }
      if (snapshot.ledgerPage) {
        client.setQueryData<InfiniteData<{ items: unknown[]; has_more: boolean; next_cursor: unknown }>>(
          queryKeys.transactionsFeed(groupId),
          (current) => keepExisting(current, {
            pages: [snapshot.ledgerPage as { items: unknown[]; has_more: boolean; next_cursor: unknown }],
            pageParams: [null],
          }),
        );
      }
      if (snapshot.settlements) {
        const saved: SettlementsResponse = { settlements: snapshot.settlements as Settlement[] };
        client.setQueryData<SettlementsResponse>(
          queryKeys.settlements(groupId),
          (current) => keepExisting(current, saved),
        );
      }
      if (snapshot.participants) {
        client.setQueryData<Participant[]>(
          queryKeys.participants(groupId),
          (current) => keepExisting(current, snapshot.participants as Participant[]),
        );
      }
    }
  });
  hydrated.set(userId, promise);
  return promise;
}

export async function clearGroupOpenCaches(): Promise<void> {
  hydrated.clear();
  resetGroupOpenMemory();
  await clearSavedBalancesAndLedgers(AsyncStorage);
}
