/**
 * Read-only transaction detail built from the tapped row.
 * Equal splits name people without repeating each amount.
 * A converted expense gets one muted rate line from the existing rate book.
 */
import type { Participant, Settlement, Transaction, TransactionSplit } from "../types";
import { resolveRate, type RateBook } from "./currencyMerge";
import { ledgerDateSectionLabel } from "./ledgerDateSections";
import { resolveLedgerParticipantName, type LedgerNameMember } from "./ledgerNames";
import { formatShareCurrency } from "./settleShareMessage";
import {
  buildExpenseRowModel,
  NOT_IN_SPLIT_LABEL,
  paymentAmountText,
  paymentRowTitle,
  type ViewerRef,
} from "./transactionRowImpact";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const EQUAL_DUST = 0.01;

export interface DetailSplitRow {
  key: string;
  name: string;
  amountText: string | null;
}

export interface TransactionDetailModel {
  title: string;
  amountText: string;
  meta: string;
  rateLine: string | null;
  yourLine: string;
  paidByName: string;
  paidToName: string | null;
  split:
    | { kind: "equal"; line: string; names: string[] }
    | { kind: "people"; label: string; rows: DetailSplitRow[] }
    | null;
  historySeed: string;
}

function metaLine(dateRaw: string | null | undefined, category: string | null | undefined, now: Date): string {
  const dateLabel = ledgerDateSectionLabel(dateRaw, now);
  const trimmed = category?.trim();
  return trimmed ? `${dateLabel} · ${trimmed}` : dateLabel;
}

function rateLineFor(
  amount: number,
  currency: string | null | undefined,
  settlementCurrency: string | null | undefined,
  rateBook: RateBook | null | undefined,
): string | null {
  if (!currency || !settlementCurrency || !rateBook) return null;
  if (currency.toUpperCase() === settlementCurrency.toUpperCase()) return null;
  const quote = resolveRate(currency, settlementCurrency, rateBook);
  if (!quote || quote.rate === 1) return null;
  const converted = Math.round(amount * quote.rate * 100) / 100;
  return `Converted ${formatShareCurrency(converted, quote.to)} at ${quote.rate.toFixed(2)}`;
}

export function formatDetailStamp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const hours = parsed.getHours();
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]}, ${hour12}:${minutes} ${suffix}`;
}

export function detailHistorySeed(actor: string, at?: string | null): string {
  const stamp = formatDetailStamp(at);
  if (stamp) return `Added by ${actor} · ${stamp} ›`;
  return "History ›";
}

function personName(
  participantId: string | null | undefined,
  userId: string | null | undefined,
  viewer: ViewerRef,
  participants: Participant[],
  members: LedgerNameMember[],
): string {
  return resolveLedgerParticipantName({
    participantId,
    userId,
    currentUserId: viewer.userId,
    participants,
    members,
  });
}

function isViewerSplit(split: TransactionSplit, viewer: ViewerRef): boolean {
  if (viewer.participantId && split.participant_id === viewer.participantId) return true;
  if (viewer.userId && split.user_id && split.user_id === viewer.userId) return true;
  return false;
}

function yourLineForExpense(net: number | null, involvesViewer: boolean, impactText: string, currency: string): string {
  if (impactText === NOT_IN_SPLIT_LABEL || (!involvesViewer && net == null)) {
    return "Not in this split";
  }
  if (net == null) return "";
  if (net > 0.01) return `You lent ${formatShareCurrency(net, currency)}`;
  if (net < -0.01) return `You borrowed ${formatShareCurrency(Math.abs(net), currency)}`;
  return "You're even";
}

function splitModel(
  splits: TransactionSplit[],
  currency: string,
  viewer: ViewerRef,
  participants: Participant[],
  members: LedgerNameMember[],
): TransactionDetailModel["split"] {
  if (splits.length === 0) return null;
  const ordered = [...splits].sort((a, b) => {
    const aYou = isViewerSplit(a, viewer) ? 0 : 1;
    const bYou = isViewerSplit(b, viewer) ? 0 : 1;
    return aYou - bYou;
  });
  const amounts = ordered.map((split) => split.amount);
  const equal = ordered.length >= 2
    && Math.max(...amounts) - Math.min(...amounts) <= EQUAL_DUST;
  const names = ordered.map((split) => personName(
    split.participant_id,
    split.user_id,
    viewer,
    participants,
    members,
  ));
  if (equal) {
    return {
      kind: "equal",
      line: `Split equally · ${formatShareCurrency(ordered[0].amount, currency)} each`,
      names,
    };
  }
  return {
    kind: "people",
    label: "Unequal split",
    rows: ordered.map((split, index) => ({
      key: split.participant_id || split.user_id || String(index),
      name: names[index] || "Someone",
      amountText: formatShareCurrency(split.amount, currency),
    })),
  };
}

export function buildExpenseDetail(input: {
  transaction: Transaction;
  viewer: ViewerRef;
  participants?: Participant[];
  members?: LedgerNameMember[];
  now: Date;
  settlementCurrency?: string | null;
  rateBook?: RateBook | null;
}): TransactionDetailModel {
  const participants = input.participants ?? [];
  const members = input.members ?? [];
  const currency = input.transaction.currency || "INR";
  const payerName = personName(
    input.transaction.paid_by_participant_id,
    input.transaction.paid_by,
    input.viewer,
    participants,
    members,
  );
  const model = buildExpenseRowModel({
    amount: input.transaction.amount,
    currency,
    payerName,
    paidByParticipantId: input.transaction.paid_by_participant_id,
    paidByUserId: input.transaction.paid_by,
    splits: input.transaction.splits,
    viewer: input.viewer,
  });
  const actor = payerName;
  return {
    title: input.transaction.description || "Untitled",
    amountText: formatShareCurrency(input.transaction.amount, currency),
    meta: metaLine(input.transaction.date, input.transaction.category, input.now),
    rateLine: rateLineFor(input.transaction.amount, currency, input.settlementCurrency, input.rateBook),
    yourLine: yourLineForExpense(model.net, model.involvesViewer, model.impactText, currency),
    paidByName: payerName,
    paidToName: null,
    split: splitModel(input.transaction.splits ?? [], currency, input.viewer, participants, members),
    historySeed: detailHistorySeed(actor, input.transaction.created_at),
  };
}

export function buildPaymentDetail(input: {
  settlement: Settlement;
  viewer: ViewerRef;
  participants?: Participant[];
  members?: LedgerNameMember[];
  now: Date;
  settlementCurrency?: string | null;
  rateBook?: RateBook | null;
}): TransactionDetailModel {
  const participants = input.participants ?? [];
  const members = input.members ?? [];
  const currency = input.settlement.currency || "INR";
  const fromName = personName(
    input.settlement.from_participant_id,
    input.settlement.from_user_id,
    input.viewer,
    participants,
    members,
  );
  const toName = personName(
    input.settlement.to_participant_id,
    input.settlement.to_user_id,
    input.viewer,
    participants,
    members,
  );
  const viewerPaid = fromName === "You";
  const viewerReceived = toName === "You";
  const yourLine = viewerReceived
    ? `You received ${formatShareCurrency(input.settlement.amount, currency)}`
    : viewerPaid
      ? `You paid ${formatShareCurrency(input.settlement.amount, currency)}`
      : "Not in this split";
  return {
    title: paymentRowTitle(fromName, toName),
    amountText: paymentAmountText(input.settlement.amount, currency),
    meta: metaLine(input.settlement.created_at, null, input.now),
    rateLine: rateLineFor(
      input.settlement.amount,
      currency,
      input.settlementCurrency,
      input.rateBook,
    ),
    yourLine,
    paidByName: fromName,
    paidToName: toName,
    split: null,
    historySeed: detailHistorySeed(fromName, input.settlement.created_at),
  };
}
