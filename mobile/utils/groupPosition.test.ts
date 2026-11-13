import { assertEquals } from "jsr:@std/assert@1";
import type { Balance, Participant } from "../types";
import { emptyRateBook } from "./currencyMerge.ts";
import { resolveGroupPosition } from "./groupPosition.ts";

const book = emptyRateBook({ USD: 1, EUR: 0.8, INR: 83, GBP: 0.74, THB: 32 });

function balance(id: string, amount: number, currency = "INR"): Balance {
  return {
    participant_id: id,
    user_id: id,
    full_name: id === "me" ? "You" : id,
    amount,
    currency,
  };
}

const people: Participant[] = [
  { id: "me", group_id: "g", user_id: "me", type: "member", full_name: "You" },
  { id: "Rahul", group_id: "g", user_id: "Rahul", type: "member", full_name: "Rahul" },
  { id: "Meera", group_id: "g", user_id: "Meera", type: "member", full_name: "Meera" },
];

function position(balances: Balance[], extras: Partial<Parameters<typeof resolveGroupPosition>[0]> = {}) {
  return resolveGroupPosition({
    balances,
    currentUserId: "me",
    participants: people,
    unifyEnabled: false,
    settlementCurrency: "INR",
    defaultCurrency: "INR",
    rateBook: book,
    activeMemberCount: 3,
    ...extras,
  });
}

Deno.test("position owed: label, viewer number, and the top two counterparties", () => {
  const result = position([
    balance("me", 2400),
    balance("Rahul", -1600),
    balance("Meera", -800),
  ]);
  assertEquals(result.kind, "ready");
  if (result.kind !== "ready") return;
  assertEquals(result.label, "You're owed");
  assertEquals(result.numberText, "₹2,400");
  assertEquals(result.sentence, "Rahul owes ₹1,600 · Meera ₹800 ›");
  assertEquals(result.showSettle, true);
  assertEquals(result.showRemind, true);
  assertEquals(result.showUnifyLine, false);
  assertEquals(result.compactLine, "You're owed ₹2,400");
});

Deno.test("position number drops .00 on whole amounts and keeps paise", () => {
  const whole = position([
    balance("me", 30000),
    balance("Rahul", -30000),
  ]);
  assertEquals(whole.kind, "ready");
  if (whole.kind !== "ready") return;
  assertEquals(whole.numberText, "₹30,000");
  assertEquals(whole.sentence, "Rahul owes ₹30,000 ›");

  const paise = position([
    balance("me", 5625.5),
    balance("Rahul", -5625.5),
  ]);
  assertEquals(paise.kind, "ready");
  if (paise.kind !== "ready") return;
  assertEquals(paise.numberText, "₹5,625.50");
  assertEquals(paise.sentence, "Rahul owes ₹5,625.50 ›");
});

Deno.test("position owe: one counterparty", () => {
  const result = position([
    balance("me", -1050),
    balance("Rahul", 1050),
  ]);
  assertEquals(result.kind, "ready");
  if (result.kind !== "ready") return;
  assertEquals(result.label, "You owe");
  assertEquals(result.numberText, "₹1,050");
  assertEquals(result.sentence, "You owe Rahul ₹1,050 ›");
  assertEquals(result.showSettle, true);
  assertEquals(result.showRemind, false);
});

Deno.test("position even has a number and no settle", () => {
  const result = position([
    balance("me", 0),
    balance("Rahul", 0),
  ]);
  assertEquals(result.kind, "ready");
  if (result.kind !== "ready") return;
  assertEquals(result.label, "You're even");
  assertEquals(result.numberText, "₹0");
  assertEquals(result.sentence, null);
  assertEquals(result.showSettle, false);
  assertEquals(result.showRemind, false);
});

Deno.test("position uses the viewer's balance, not the counterparty's group net", () => {
  const result = position([
    balance("me", 20, "USD"),
    balance("Alice", -100, "USD"),
    balance("Bob", 80, "USD"),
  ], { settlementCurrency: "USD", defaultCurrency: "USD" });
  assertEquals(result.kind, "ready");
  if (result.kind !== "ready") return;
  assertEquals(result.numberText, "$20");
  assertEquals(result.sentence, "Alice owes $20 ›");
});

Deno.test("multi-currency without unify shows the currency line and no combined total", () => {
  const result = position([
    balance("me", 50, "USD"),
    balance("Alice", -50, "USD"),
    balance("me", -30, "EUR"),
    balance("Bob", 30, "EUR"),
  ], { settlementCurrency: "USD", defaultCurrency: "USD" });
  assertEquals(result.kind, "ready");
  if (result.kind !== "ready") return;
  assertEquals(result.numberText, null);
  assertEquals(result.label, null);
  assertEquals(result.showUnifyLine, true);
  assertEquals(result.compactLine, "Show in one currency");
  assertEquals(result.sentence?.includes("$50"), true);
  assertEquals(result.sentence?.includes("€30"), true);
  assertEquals(result.showSettle, true);
});

Deno.test("unify uses the settlement-currency total from unifyBalances", () => {
  const result = position([
    balance("me", 50, "USD"),
    balance("Alice", -50, "USD"),
  ], {
    unifyEnabled: true,
    settlementCurrency: "INR",
    defaultCurrency: "USD",
  });
  assertEquals(result.kind, "ready");
  if (result.kind !== "ready") return;
  assertEquals(result.label, "You're owed");
  assertEquals(result.numberText, "₹4,150");
  assertEquals(result.showUnifyLine, false);
  assertEquals(result.sentence, "Alice owes ₹4,150 ›");
});

Deno.test("solo group has no position block", () => {
  const result = position([], { activeMemberCount: 1, hasNonZeroBalance: false });
  assertEquals(result.kind, "hidden");
});
