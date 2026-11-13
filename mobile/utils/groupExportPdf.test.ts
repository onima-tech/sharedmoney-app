import { assertEquals } from "jsr:@std/assert@1";
import type { Balance, GroupStatsMemberBreakdown, Participant } from "../types.ts";
import { simplifyDebts } from "./debt.ts";
import {
  buildGroupExportPdfHtml,
  memberTotalsForExport,
} from "./groupExportPdf.ts";
import {
  formatSettleSummaryEdgeLine,
  formatShareCurrency,
} from "./settleShareMessage.ts";

const AISHA = "aisha";
const DEV = "dev";
const CARA = "cara";

function balance(
  name: string,
  participantId: string,
  amount: number,
  currency: string,
): Balance {
  return {
    user_id: `user-${participantId}`,
    participant_id: participantId,
    full_name: name,
    amount,
    currency,
  };
}

Deno.test("pdf settle-up list uses simplifyDebts and formatShareCurrency", () => {
  const balances = [
    balance("Aisha", AISHA, 500, "INR"),
    balance("Dev", DEV, -500, "INR"),
  ];
  const edges = simplifyDebts(balances, "user-aisha", "INR", AISHA);
  assertEquals(edges.length, 1);
  assertEquals(edges[0].amount, 500);
  assertEquals(edges[0].currency, "INR");

  const html = buildGroupExportPdfHtml({
    groupName: "Phuket",
    exportedOn: "3 Apr 2026",
    memberTotals: [],
    balances,
    currentUserId: "user-aisha",
    currentUserParticipantId: AISHA,
    defaultCurrency: "INR",
  });

  const line = formatSettleSummaryEdgeLine({
    fromName: "Dev",
    toName: "Aisha",
    amount: 500,
    currency: "INR",
  });
  assertEquals(line, "Dev pays Aisha ₹500");
  assertEquals(html.includes(line), true);
  assertEquals(html.includes("₹500.00"), false);
  assertEquals(html.includes("Phuket"), true);
});

Deno.test("pdf keeps balances in their original currencies", () => {
  const html = buildGroupExportPdfHtml({
    groupName: "Phuket",
    exportedOn: "3 Apr 2026",
    memberTotals: [
      {
        name: "Aisha",
        paidByCurrency: { INR: 1250.5, USD: 0 },
        shareByCurrency: { INR: 625.25, USD: 20 },
      },
    ],
    balances: [
      balance("Aisha", AISHA, 625.25, "INR"),
      balance("Dev", DEV, -625.25, "INR"),
      balance("Aisha", AISHA, 20, "USD"),
      balance("Dev", DEV, -20, "USD"),
    ],
    currentUserId: "user-aisha",
    currentUserParticipantId: AISHA,
    defaultCurrency: "INR",
  });

  assertEquals(html.includes(formatShareCurrency(625.25, "INR")), true);
  assertEquals(html.includes(formatShareCurrency(20, "USD")), true);
  assertEquals(html.includes(formatShareCurrency(1250.5, "INR")), true);
  const usdLine = formatSettleSummaryEdgeLine({
    fromName: "Dev",
    toName: "Aisha",
    amount: 20,
    currency: "USD",
  });
  const inrLine = formatSettleSummaryEdgeLine({
    fromName: "Dev",
    toName: "Aisha",
    amount: 625.25,
    currency: "INR",
  });
  assertEquals(html.includes(usdLine), true);
  assertEquals(html.includes(inrLine), true);
  assertEquals(html.includes("1661"), false);
});

Deno.test("pdf lists a member whose share is zero", () => {
  const participants: Participant[] = [
    { id: AISHA, group_id: "g", type: "member", full_name: "Aisha" },
    { id: CARA, group_id: "g", type: "member", full_name: "Cara" },
  ];
  const breakdown: GroupStatsMemberBreakdown[] = [
    {
      participant_id: AISHA,
      full_name: "Aisha",
      share_totals: { INR: 100 },
      paid_totals: { INR: 100 },
      net_balances: {},
    },
  ];
  const totals = memberTotalsForExport({
    participants,
    breakdown,
    defaultCurrency: "INR",
  });
  const cara = totals.find((member) => member.name === "Cara");
  assertEquals(cara?.shareByCurrency.INR, 0);
  assertEquals(cara?.paidByCurrency.INR, 0);

  const html = buildGroupExportPdfHtml({
    groupName: "Flat 4B",
    exportedOn: "3 Apr 2026",
    memberTotals: totals,
    balances: [balance("Aisha", AISHA, 0.5, "INR"), balance("Dev", DEV, -0.5, "INR")],
    currentUserId: "user-aisha",
    currentUserParticipantId: AISHA,
    defaultCurrency: "INR",
  });
  assertEquals(html.includes("Cara"), true);
  assertEquals(html.includes(formatShareCurrency(0, "INR")), true);
});
