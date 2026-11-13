import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { Balance } from "../types";
import { emptyRateBook, unifyBalances } from "./currencyMerge.ts";
import { buildGroupPosition, SHOW_IN_ONE_CURRENCY } from "./groupPosition.ts";
import { formatShareCurrency } from "./settleShareMessage.ts";

const book = emptyRateBook({ USD: 1, INR: 83, EUR: 0.92 });

function row(
  userId: string,
  amount: number,
  currency: string,
  name: string,
): Balance {
  return {
    user_id: userId,
    participant_id: `p-${userId}`,
    full_name: name,
    amount,
    currency,
  };
}

function position(balances: Balance[], unify = false) {
  return buildGroupPosition({
    balances,
    currentUserId: "me",
    currentParticipantId: "p-me",
    unify,
    settlementCurrency: "INR",
    rateBook: book,
    defaultCurrency: "INR",
  });
}

Deno.test("position owed names the top two counterparties and uses the viewer row", () => {
  const balances = [
    row("me", 2400, "INR", "You"),
    row("rahul", -1600, "INR", "Rahul"),
    row("meera", -800, "INR", "Meera"),
  ];
  const result = position(balances);
  assertEquals(result.kind, "amount");
  if (result.kind !== "amount") return;
  assertEquals(result.label, "You're owed");
  assertEquals(result.amountText, formatShareCurrency(2400, "INR"));
  assertEquals(result.sentence, "Rahul owes ₹1,600 · Meera ₹800 ›");
  assertEquals(result.counterparties.length, 2);
  assertEquals(result.showSettle, true);
  assertEquals(result.showRemind, true);
  assertEquals(result.compactLine, `You're owed ${result.amountText}`);
});

Deno.test("position owe with one counterparty", () => {
  const result = position([
    row("me", -1050, "INR", "You"),
    row("rahul", 1050, "INR", "Rahul"),
  ]);
  assertEquals(result.kind, "amount");
  if (result.kind !== "amount") return;
  assertEquals(result.label, "You owe");
  assertEquals(result.amountText, formatShareCurrency(1050, "INR"));
  assertEquals(result.sentence, "You owe Rahul ₹1,050 ›");
  assertEquals(result.counterparties.length, 1);
  assertEquals(result.showSettle, true);
  assertEquals(result.showRemind, false);
});

Deno.test("position even has no settle sentence and does not claim a counterparty", () => {
  const result = position([]);
  assertEquals(result.kind, "amount");
  if (result.kind !== "amount") return;
  assertEquals(result.label, "You're even");
  assertEquals(result.amountText, formatShareCurrency(0, "INR"));
  assertEquals(result.sentence, null);
  assertEquals(result.counterparties.length, 0);
  assertEquals(result.showSettle, false);
  assertEquals(result.showRemind, false);
  assertEquals(result.compactLine, "You're even");
});

Deno.test("multi-currency without unify shows the prompt and no combined total", () => {
  const result = position([
    row("me", 10, "USD", "You"),
    row("me", 20, "EUR", "You"),
    row("rahul", -10, "USD", "Rahul"),
    row("meera", -20, "EUR", "Meera"),
  ]);
  assertEquals(result.kind, "uncombined");
  if (result.kind !== "uncombined") return;
  assertEquals(result.prompt, SHOW_IN_ONE_CURRENCY);
  assertEquals(result.sentence, null);
  assertEquals("amountText" in result, false);
  assertEquals(result.compactLine, "Show in one currency");
  assertEquals(result.showSettle, true);
});

Deno.test("unified position number matches unifyBalances, not a new sum of edges", () => {
  const balances = [
    row("me", 10, "USD", "You"),
    row("me", 10, "EUR", "You"),
    row("rahul", -10, "USD", "Rahul"),
    row("meera", -10, "EUR", "Meera"),
  ];
  const result = position(balances, true);
  const unified = unifyBalances(
    balances.filter((balance) => balance.user_id === "me"),
    "INR",
    book,
  );
  assertEquals(result.kind, "amount");
  if (result.kind !== "amount") return;
  assertEquals(result.amountText, formatShareCurrency(Math.abs(unified.amount), unified.currency));
  assertEquals(result.label, unified.amount > 0 ? "You're owed" : "You owe");
  assertEquals(result.counterparties.length, 2);
});
