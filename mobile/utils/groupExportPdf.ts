import type { Balance, GroupStatsMemberBreakdown, Participant } from "../types";
import { simplifyDebts } from "./debt";
import { exportPersonName } from "./groupExportNames";
import {
  formatSettleSummaryEdgeLine,
  formatShareCurrency,
} from "./settleShareMessage";

export type GroupExportMemberTotal = {
  name: string;
  paidByCurrency: Record<string, number>;
  shareByCurrency: Record<string, number>;
};

export type GroupExportRecordedSettlement = {
  from: { full_name?: string | null; email?: string | null };
  to: { full_name?: string | null; email?: string | null };
  amount: number;
  currency: string;
};

export type GroupExportPdfInput = {
  groupName: string;
  exportedOn: string;
  memberTotals: GroupExportMemberTotal[];
  /** Settlements already recorded. Omitted from the page when empty. */
  settlements?: GroupExportRecordedSettlement[];
  balances: Balance[];
  currentUserId?: string;
  currentUserParticipantId?: string;
  defaultCurrency: string;
};

const MATERIAL = 0.005;

const EXPORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function formatExportDate(date: Date): string {
  const month = EXPORT_MONTHS[date.getMonth()] ?? "";
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function copyAmounts(source: Record<string, number> | undefined): Record<string, number> {
  const copy: Record<string, number> = {};
  for (const [currency, amount] of Object.entries(source ?? {})) {
    const code = currency.trim().toUpperCase();
    if (!code || !Number.isFinite(amount)) continue;
    copy[code] = amount;
  }
  return copy;
}

function currenciesOf(paid: Record<string, number>, share: Record<string, number>): string[] {
  return Array.from(new Set([...Object.keys(paid), ...Object.keys(share)])).sort();
}

/**
 * Joins people to spending totals the server already computed.
 * Does not derive a new total from expense rows.
 */
export function memberTotalsForExport(input: {
  participants: Participant[];
  breakdown: GroupStatsMemberBreakdown[];
  defaultCurrency: string;
}): GroupExportMemberTotal[] {
  const byId = new Map(input.breakdown.map((entry) => [entry.participant_id, entry]));
  const fallback = input.defaultCurrency.trim().toUpperCase() || "INR";
  return input.participants.map((person) => {
    const entry = byId.get(person.id);
    const paidByCurrency = copyAmounts(entry?.paid_totals);
    const shareByCurrency = copyAmounts(entry?.share_totals);
    if (Object.keys(paidByCurrency).length === 0 && Object.keys(shareByCurrency).length === 0) {
      paidByCurrency[fallback] = 0;
      shareByCurrency[fallback] = 0;
    }
    return {
      name: exportPersonName(person),
      paidByCurrency,
      shareByCurrency,
    };
  });
}

function balanceName(person: Balance): string {
  const named = exportPersonName(person);
  return named === "Member" ? "Someone" : named;
}

function money(amount: number, currency: string): string {
  return formatShareCurrency(Math.abs(amount), currency);
}

/**
 * One-page summary. Balances stay in the currency they were recorded in.
 * Settle-up comes from `simplifyDebts` — this file does not pair debts itself.
 */
export function buildGroupExportPdfHtml(input: GroupExportPdfInput): string {
  const groupName = input.groupName.trim() || "Group";
  const edges = simplifyDebts(
    input.balances,
    input.currentUserId,
    input.defaultCurrency,
    input.currentUserParticipantId,
  ).filter((edge) => Math.abs(edge.amount) >= MATERIAL);

  const settleLines = edges.map((edge) => formatSettleSummaryEdgeLine({
    fromName: balanceName(edge.fromUser),
    toName: balanceName(edge.toUser),
    amount: edge.amount,
    currency: edge.currency,
  }));

  const recorded = (input.settlements ?? []).filter((settlement) => (
    Number.isFinite(settlement.amount) && Math.abs(settlement.amount) >= MATERIAL
  ));
  const settledByCurrency = new Map<string, GroupExportRecordedSettlement[]>();
  for (const settlement of recorded) {
    const currency = (settlement.currency || input.defaultCurrency).toUpperCase();
    const list = settledByCurrency.get(currency) ?? [];
    list.push(settlement);
    settledByCurrency.set(currency, list);
  }
  const settledBlocks = Array.from(settledByCurrency.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, rows]) => {
      const lines = [...rows]
        .sort((a, b) => {
          const aLine = `${exportPersonName(a.from)} ${exportPersonName(a.to)}`;
          const bLine = `${exportPersonName(b.from)} ${exportPersonName(b.to)}`;
          return aLine.localeCompare(bLine);
        })
        .map((row) => {
          const from = escapeHtml(exportPersonName(row.from));
          const to = escapeHtml(exportPersonName(row.to));
          const formatted = escapeHtml(money(row.amount, currency));
          return `<li>${from} paid ${to} ${formatted}</li>`;
        })
        .join("");
      return `<h3>${escapeHtml(currency)}</h3><ul>${lines}</ul>`;
    })
    .join("");

  const totalsRows = input.memberTotals.map((member) => {
    const currencies = currenciesOf(member.paidByCurrency, member.shareByCurrency);
    const lines = (currencies.length > 0 ? currencies : [input.defaultCurrency]).map((currency) => {
      const paid = member.paidByCurrency[currency] ?? 0;
      const share = member.shareByCurrency[currency] ?? 0;
      return `Paid ${money(paid, currency)} · Share ${money(share, currency)}`;
    });
    return `<tr><td>${escapeHtml(member.name)}</td><td class="num">${lines.map(escapeHtml).join("<br>")}</td></tr>`;
  }).join("");

  const byCurrency = new Map<string, Balance[]>();
  for (const balance of input.balances) {
    if (Math.abs(balance.amount) < MATERIAL) continue;
    const currency = (balance.currency || input.defaultCurrency).toUpperCase();
    const list = byCurrency.get(currency) ?? [];
    list.push(balance);
    byCurrency.set(currency, list);
  }
  const balanceBlocks = Array.from(byCurrency.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, rows]) => {
      const lines = [...rows]
        .sort((a, b) => balanceName(a).localeCompare(balanceName(b)))
        .map((row) => {
          const name = escapeHtml(balanceName(row));
          const formatted = escapeHtml(money(row.amount, currency));
          const verb = row.amount > 0 ? "is owed" : "owes";
          return `<li>${name} ${verb} ${formatted}</li>`;
        })
        .join("");
      return `<h3>${escapeHtml(currency)}</h3><ul>${lines}</ul>`;
    })
    .join("");

  const settleBlock = settleLines.length > 0
    ? `<ul>${settleLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
    : `<p class="quiet">Everyone is settled.</p>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(groupName)} export</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #17202A;
    background: #ffffff;
    font-size: 12px;
    line-height: 1.4;
    padding: 28px 32px;
  }
  h1 { font-size: 22px; line-height: 1.2; margin: 0; font-weight: 700; }
  .eyebrow { margin: 0 0 4px; color: #4A5870; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
  .meta { margin: 4px 0 0; color: #4A5870; }
  h2 { margin: 22px 0 8px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #4A5870; font-weight: 700; }
  h3 { margin: 10px 0 4px; font-size: 12px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 0; border-bottom: 1px solid #DCE3EC; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; }
  ul { margin: 0; padding: 0; list-style: none; }
  li { padding: 6px 0; border-bottom: 1px solid #DCE3EC; }
  .quiet { margin: 0; color: #4A5870; }
</style>
</head>
<body>
  <p class="eyebrow">Group export</p>
  <h1>${escapeHtml(groupName)}</h1>
  <p class="meta">${escapeHtml(input.exportedOn)}</p>
  <h2>Totals per member</h2>
  ${totalsRows
    ? `<table>${totalsRows}</table>`
    : `<p class="quiet">No spending recorded.</p>`}
  ${settledBlocks ? `<h2>Settled</h2>${settledBlocks}` : ""}
  <h2>Balances</h2>
  ${balanceBlocks || `<p class="quiet">No outstanding balances.</p>`}
  <h2>Settle up</h2>
  ${settleBlock}
</body>
</html>`;
}
