import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  GROUP_LEDGER_PARALLEL_QUERY_COUNT,
  loadGroupLedger,
} from "./load-group-ledger.ts";

type FakeResult = { data: unknown; error: unknown };

function createFakeSupabase(handlers: Record<string, () => FakeResult>) {
  const calls: string[] = [];

  const makeBuilder = (table: string) => {
    const resultPromise = Promise.resolve().then(() => handlers[table]());
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    builder.select = () => self();
    builder.eq = () => self();
    builder.order = () => self();
    builder.then = (
      onFulfilled?: (value: FakeResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => resultPromise.then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (reason: unknown) => unknown) =>
      resultPromise.catch(onRejected);
    return builder;
  };

  return {
    calls,
    from: (table: string) => {
      calls.push(table);
      return makeBuilder(table);
    },
  };
}

Deno.test("GROUP_LEDGER_PARALLEL_QUERY_COUNT documents three parallel reads", () => {
  assertEquals(GROUP_LEDGER_PARALLEL_QUERY_COUNT, 3);
});

Deno.test("loadGroupLedger fetches transactions, participants, settlements in parallel", async () => {
  const supabase = createFakeSupabase({
    transactions: () => ({
      data: [
        {
          id: 1,
          amount: 10,
          paid_by_participant_id: "p1",
          currency: "USD",
          transaction_splits: [{ participant_id: "p1", amount: 10 }],
        },
      ],
      error: null,
    }),
    participants: () => ({
      data: [
        {
          id: "p1",
          user_id: "u1",
          email: "a@example.com",
          full_name: "A",
          avatar_url: null,
          type: "member",
        },
      ],
      error: null,
    }),
    settlements: () => ({
      data: [],
      error: null,
    }),
  });

  const snapshot = await loadGroupLedger(supabase, "group-1", {
    includeStatsFields: true,
  });

  assertEquals(snapshot.transactions.length, 1);
  assertEquals(snapshot.participants.length, 1);
  assertEquals(snapshot.settlements.length, 0);
  // from() is invoked for all three before any await settles (parallel batch).
  assertEquals(supabase.calls.sort(), [
    "participants",
    "settlements",
    "transactions",
  ]);
});

Deno.test("loadGroupLedger throws when transactions query fails", async () => {
  const supabase = createFakeSupabase({
    transactions: () => ({
      data: null,
      error: { message: "boom" },
    }),
    participants: () => ({ data: [], error: null }),
    settlements: () => ({ data: [], error: null }),
  });

  await assertRejects(() => loadGroupLedger(supabase, "group-1"));
});
