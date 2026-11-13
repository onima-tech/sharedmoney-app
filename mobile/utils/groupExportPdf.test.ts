import { assertEquals } from "jsr:@std/assert@1";
import type { Balance, GroupStatsMemberBreakdown, Participant } from "../types.ts";
import { simplifyDebts } from "./debt.ts";
import {
  buildGroupExportPdfHtml,
  memberTotalsForExport,
  type GroupExportMemberTotal,
} from "./groupExportPdf.ts";
import { exportPersonName } from "./groupExportNames.ts";
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

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function parseDisplayedAmount(display: string): number {
  const numeric = display.replace(/[^\d.-]/g, "").replace(/,/g, "");
  return Number(numeric);
}

function sectionHtml(html: string, heading: string): string {
  const marker = `<h2>${heading}</h2>`;
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const rest = html.slice(start + marker.length);
  const next = rest.indexOf("<h2>");
  return next < 0 ? rest : rest.slice(0, next);
}

function currencyBlocks(section: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const parts = section.split(/<h3>([^<]+)<\/h3>/);
  for (let index = 1; index < parts.length; index += 2) {
    blocks.set(parts[index] ?? "", parts[index + 1] ?? "");
  }
  return blocks;
}

Deno.test("pdf balances equal paid minus share plus settlements paid minus received", () => {
  const memberTotals: GroupExportMemberTotal[] = [
    {
      name: "Aisha",
      paidByCurrency: { INR: 1600, USD: 0 },
      shareByCurrency: { INR: 1425.25, USD: 20 },
    },
    {
      name: "Dev",
      paidByCurrency: { INR: 1250.5, USD: 40 },
      shareByCurrency: { INR: 1425.25, USD: 20 },
    },
    {
      name: "Cara",
      paidByCurrency: { INR: 0 },
      shareByCurrency: { INR: 0 },
    },
  ];
  const settlements = [
    {
      from: { full_name: "Dev" },
      to: { full_name: "Aisha" },
      amount: 800,
      currency: "INR",
    },
  ];
  const html = buildGroupExportPdfHtml({
    groupName: "Phuket",
    exportedOn: "5 Apr 2026",
    memberTotals,
    settlements,
    balances: [
      balance("Aisha", AISHA, -625.25, "INR"),
      balance("Dev", DEV, 625.25, "INR"),
      balance("Aisha", AISHA, -20, "USD"),
      balance("Dev", DEV, 20, "USD"),
    ],
    currentUserId: "user-aisha",
    currentUserParticipantId: AISHA,
    defaultCurrency: "INR",
  });

  const paidShare = new Map<string, Map<string, { paid: number; share: number }>>();
  const totals = sectionHtml(html, "Totals per member");
  for (const row of totals.matchAll(/<tr><td>([^<]+)<\/td><td class="num">([\s\S]*?)<\/td><\/tr>/g)) {
    const name = row[1] ?? "";
    const byCurrency = new Map<string, { paid: number; share: number }>();
    for (const line of (row[2] ?? "").split("<br>")) {
      const match = /Paid (.+) · Share (.+)/.exec(line);
      if (!match?.[1] || !match[2]) continue;
      const currency = match[1].includes("₹") ? "INR" : "USD";
      byCurrency.set(currency, {
        paid: parseDisplayedAmount(match[1]),
        share: parseDisplayedAmount(match[2]),
      });
    }
    paidShare.set(name, byCurrency);
  }

  const settledPaid = new Map<string, number>();
  const settledReceived = new Map<string, number>();
  const settled = sectionHtml(html, "Settled");
  for (const [currency, block] of currencyBlocks(settled)) {
    for (const item of block.matchAll(/<li>([^<]+)<\/li>/g)) {
      const match = /^(.+) paid (.+) ([^0-9]*[0-9][0-9,.]*)/.exec(item[1] ?? "");
      if (!match?.[1] || !match[2] || !match[3]) continue;
      const amount = parseDisplayedAmount(match[3]);
      const paidKey = `${match[1]}|${currency}`;
      const receivedKey = `${match[2]}|${currency}`;
      settledPaid.set(paidKey, (settledPaid.get(paidKey) ?? 0) + amount);
      settledReceived.set(receivedKey, (settledReceived.get(receivedKey) ?? 0) + amount);
    }
  }

  const pageBalance = new Map<string, number>();
  for (const [currency, block] of currencyBlocks(sectionHtml(html, "Balances"))) {
    for (const item of block.matchAll(/<li>([^<]+)<\/li>/g)) {
      const text = item[1] ?? "";
      const owed = /^(.+) is owed (.+)$/.exec(text);
      const owes = /^(.+) owes (.+)$/.exec(text);
      if (owed?.[1] && owed[2]) pageBalance.set(`${owed[1]}|${currency}`, parseDisplayedAmount(owed[2]));
      if (owes?.[1] && owes[2]) pageBalance.set(`${owes[1]}|${currency}`, -parseDisplayedAmount(owes[2]));
    }
  }

  for (const member of memberTotals) {
    const currencies = new Set([
      ...Object.keys(member.paidByCurrency),
      ...Object.keys(member.shareByCurrency),
    ]);
    for (const currency of currencies) {
      const shown = paidShare.get(member.name)?.get(currency);
      const paid = shown?.paid ?? 0;
      const share = shown?.share ?? 0;
      const key = `${member.name}|${currency}`;
      const expected = roundCents(
        paid - share + (settledPaid.get(key) ?? 0) - (settledReceived.get(key) ?? 0),
      );
      assertEquals(pageBalance.get(key) ?? 0, expected);
    }
  }
});

Deno.test("pdf lists recorded settlements between totals and balances", () => {
  const html = buildGroupExportPdfHtml({
    groupName: "Phuket",
    exportedOn: "5 Apr 2026",
    memberTotals: [],
    settlements: [
      {
        from: { full_name: "Dev" },
        to: { full_name: "Aisha" },
        amount: 800,
        currency: "INR",
      },
    ],
    balances: [],
    defaultCurrency: "INR",
  });
  const line = `${exportPersonName({ full_name: "Dev" })} paid ${exportPersonName({ full_name: "Aisha" })} ${formatShareCurrency(800, "INR")}`;
  assertEquals(line, "Dev paid Aisha ₹800");
  assertEquals(html.includes(line), true);
  const totalsAt = html.indexOf("<h2>Totals per member</h2>");
  const settledAt = html.indexOf("<h2>Settled</h2>");
  const balancesAt = html.indexOf("<h2>Balances</h2>");
  assertEquals(totalsAt < settledAt && settledAt < balancesAt, true);
});

Deno.test("pdf omits the settled section when nothing has been recorded", () => {
  const html = buildGroupExportPdfHtml({
    groupName: "Phuket",
    exportedOn: "5 Apr 2026",
    memberTotals: [],
    settlements: [],
    balances: [balance("Aisha", AISHA, 10, "INR")],
    defaultCurrency: "INR",
  });
  assertEquals(html.includes("<h2>Settled</h2>"), false);
  assertEquals(html.includes("<h2>Balances</h2>"), true);
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
