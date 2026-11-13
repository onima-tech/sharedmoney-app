import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { BalancesResponse } from "../types";
import {
  clearSavedBalancesAndLedgers,
  GROUP_OPEN_LIMIT,
  hydrateGroupOpenCache,
  peekAllBalances,
  peekGroupOpenOrder,
  peekGroupSnapshot,
  resetGroupOpenMemory,
  saveAllBalances,
  saveGroupOpenPart,
  type GroupOpenStorage,
} from "./groupOpenCache.ts";

function memoryStorage(): GroupOpenStorage & { dump: () => string[] } {
  const keys = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(keys.get(key) ?? null),
    setItem: (key, value) => {
      keys.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      keys.delete(key);
      return Promise.resolve();
    },
    getAllKeys: () => Promise.resolve([...keys.keys()]),
    dump: () => [...keys.keys()],
  };
}

function balances(groupId: string): BalancesResponse {
  return {
    group_balances: [{
      group_id: groupId,
      group_name: groupId,
      balances: [{ user_id: "me", amount: 10, currency: "INR" }],
    }],
    overall_balances: [{ user_id: "me", amount: 10, currency: "INR" }],
  };
}

Deno.test("sign-out clears saved balances and ledger pages and keeps the groups list", async () => {
  resetGroupOpenMemory();
  const storage = memoryStorage();
  await saveAllBalances("user-a", balances("g1"), storage);
  await saveGroupOpenPart("user-a", "g1", {
    balances: balances("g1"),
    ledgerPage: { items: [], has_more: false, next_cursor: null },
    settlements: [],
    participants: [],
  }, storage);
  await storage.setItem("sm:rq-groups:user-a", "[]");

  const removed = await clearSavedBalancesAndLedgers(storage);
  assertEquals(removed.length, 2);
  assertEquals(storage.dump(), ["sm:rq-groups:user-a"]);
  assertEquals(peekAllBalances("user-a"), null);
  assertEquals(peekGroupSnapshot("user-a", "g1"), null);
});

Deno.test("recent groups keep balances, the first ledger page, and participants", async () => {
  resetGroupOpenMemory();
  const storage = memoryStorage();
  for (let index = 1; index <= GROUP_OPEN_LIMIT + 1; index += 1) {
    const groupId = `g${index}`;
    await saveGroupOpenPart("user-a", groupId, {
      balances: balances(groupId),
      ledgerPage: {
        items: [{
          id: index,
          amount: 10,
          description: "Dinner",
          date: "2026-11-12",
          type: "expense",
        }],
        has_more: false,
        next_cursor: null,
      },
      participants: [{
        id: "p-me",
        group_id: groupId,
        user_id: "me",
        type: "member",
        full_name: "You",
      }],
    }, storage);
  }

  assertEquals(peekGroupSnapshot("user-a", "g1"), null);
  const newest = peekGroupSnapshot("user-a", `g${GROUP_OPEN_LIMIT + 1}`);
  assertEquals(newest?.ledgerPage?.items[0]?.description, "Dinner");
  assertEquals(newest?.participants?.[0]?.full_name, "You");
  assertEquals(newest?.balances?.group_balances[0]?.group_id, `g${GROUP_OPEN_LIMIT + 1}`);
  assertEquals(peekGroupOpenOrder("user-a").length, GROUP_OPEN_LIMIT);

  resetGroupOpenMemory();
  await hydrateGroupOpenCache("user-a", storage);
  assertEquals(peekGroupSnapshot("user-a", `g${GROUP_OPEN_LIMIT + 1}`)?.balances?.group_balances.length, 1);
});
