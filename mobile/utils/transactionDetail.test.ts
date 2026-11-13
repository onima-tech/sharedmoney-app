import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { Participant, Transaction } from "../types";
import { emptyRateBook, withOverrides } from "./currencyMerge.ts";
import { buildExpenseDetail, buildPaymentDetail } from "./transactionDetail.ts";

const viewer = { userId: "me", participantId: "p-me" };
const now = new Date(2026, 10, 12, 21, 14, 0);
const participants: Participant[] = [
  { id: "p-me", group_id: "g", user_id: "me", type: "member", full_name: "You" },
  { id: "p-rahul", group_id: "g", user_id: "rahul", type: "member", full_name: "Rahul" },
  { id: "p-meera", group_id: "g", user_id: "meera", type: "member", full_name: "Meera" },
  { id: "p-dev", group_id: "g", user_id: "dev", type: "member", full_name: "Dev" },
];

function expense(partial: Partial<Transaction> & Pick<Transaction, "amount" | "splits">): Transaction {
  return {
    id: 1,
    description: "Dinner at Thalassa",
    date: "2026-11-12",
    type: "expense",
    currency: "INR",
    paid_by_participant_id: "p-rahul",
    paid_by: "rahul",
    created_at: "2026-11-11T15:44:00",
    ...partial,
  };
}

Deno.test("equal split lists names only, with You first, and keeps your line secondary", () => {
  const detail = buildExpenseDetail({
    transaction: expense({
      amount: 4800,
      splits: [
        { participant_id: "p-rahul", user_id: "rahul", amount: 1200 },
        { participant_id: "p-me", user_id: "me", amount: 1200 },
        { participant_id: "p-meera", user_id: "meera", amount: 1200 },
        { participant_id: "p-dev", user_id: "dev", amount: 1200 },
      ],
    }),
    viewer,
    participants,
    now,
  });
  assertEquals(detail.amountText, "₹4,800");
  assertEquals(detail.yourLine, "You borrowed ₹1,200");
  assertEquals(detail.yourLine.includes("4,800"), false);
  assertEquals(detail.split, {
    kind: "equal",
    line: "Split equally · ₹1,200 each",
    names: ["You", "Rahul", "Meera", "Dev"],
  });
});

Deno.test("unequal split keeps per-person amounts, You first", () => {
  const detail = buildExpenseDetail({
    transaction: expense({
      amount: 4800,
      splits: [
        { participant_id: "p-rahul", user_id: "rahul", amount: 2400 },
        { participant_id: "p-meera", user_id: "meera", amount: 1200 },
        { participant_id: "p-me", user_id: "me", amount: 1200 },
      ],
    }),
    viewer,
    participants,
    now,
  });
  assertEquals(detail.yourLine, "You borrowed ₹1,200");
  assertEquals(detail.split?.kind, "people");
  if (detail.split?.kind !== "people") return;
  assertEquals(detail.split.rows.map((row) => `${row.name} ${row.amountText}`), [
    "You ₹1,200",
    "Rahul ₹2,400",
    "Meera ₹1,200",
  ]);
});

Deno.test("not in split stays a secondary line", () => {
  const detail = buildExpenseDetail({
    transaction: expense({
      description: "Taxi to airport",
      amount: 900,
      paid_by_participant_id: "p-meera",
      paid_by: "meera",
      splits: [
        { participant_id: "p-meera", user_id: "meera", amount: 450 },
        { participant_id: "p-rahul", user_id: "rahul", amount: 450 },
      ],
    }),
    viewer,
    participants,
    now,
  });
  assertEquals(detail.yourLine, "Not in this split");
  assertEquals(detail.amountText, "₹900");
});

Deno.test("converted amount is one muted rate line in the settlement currency", () => {
  const book = withOverrides(emptyRateBook({ USD: 1, INR: 83, THB: 34.58 }), { "THB:INR": 2.4 }, "group");
  const detail = buildExpenseDetail({
    transaction: expense({
      description: "Beach shack",
      amount: 1200,
      currency: "THB",
      paid_by_participant_id: "p-me",
      paid_by: "me",
      splits: [
        { participant_id: "p-me", user_id: "me", amount: 400 },
        { participant_id: "p-rahul", user_id: "rahul", amount: 800 },
      ],
    }),
    viewer,
    participants,
    now,
    settlementCurrency: "INR",
    rateBook: book,
  });
  assertEquals(detail.amountText, "฿1,200");
  assertEquals(detail.rateLine, "Converted ₹2,880 at 2.40");
  assertEquals(detail.yourLine, "You lent ฿800");
});

Deno.test("a payment detail uses the unsigned amount and who paid whom", () => {
  const detail = buildPaymentDetail({
    settlement: {
      id: "pay-1",
      group_id: "g",
      from_user_id: "rahul",
      to_user_id: "me",
      from_participant_id: "p-rahul",
      to_participant_id: "p-me",
      amount: 1000,
      currency: "INR",
      created_by: "rahul",
      created_at: "2026-11-11T18:00:00",
    },
    viewer,
    participants,
    now,
  });
  assertEquals(detail.title, "Rahul paid you");
  assertEquals(detail.amountText, "₹1,000");
  assertEquals(detail.yourLine, "You received ₹1,000");
  assertEquals(detail.paidByName, "Rahul");
  assertEquals(detail.paidToName, "You");
  assertEquals(detail.split, null);
});
