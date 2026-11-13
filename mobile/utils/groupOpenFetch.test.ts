import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { shouldFetchGroupLedger } from "./groupOpenFetch.ts";

Deno.test("the ledger waits until balances settle, including a balances error", () => {
  assertEquals(shouldFetchGroupLedger({
    balancesFetching: true,
    balancesFetched: false,
    balancesError: false,
  }), false);
  assertEquals(shouldFetchGroupLedger({
    balancesFetching: false,
    balancesFetched: true,
    balancesError: false,
  }), true);
  assertEquals(shouldFetchGroupLedger({
    balancesFetching: false,
    balancesFetched: false,
    balancesError: true,
  }), true);
});
