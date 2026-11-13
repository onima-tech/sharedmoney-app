/**
 * Group-page position: a label, one number, and a sentence naming the top
 * two counterparties. The number is the viewer's own balance rows passed
 * through `unifyBalances` (the same helper as the home badge). Counterparties
 * are the viewer-involved edges from `simplifyDebts` / `simplifyUnifiedDebts`.
 * This does not add a new total across people or currencies.
 */
import type { Balance, Participant } from "../types";
import {
  collectCurrencies,
  emptyRateBook,
  isMultiCurrency,
  simplifyUnifiedDebts,
  unifyBalances,
  type RateBook,
  type UnifiedTotal,
} from "./currencyMerge";
import { simplifyDebts, type DebtEdge } from "./debt";
import { formatShareCurrency } from "./settleShareMessage";
import { settlementCounterpartyShortName } from "./settlementPresence";

export type GroupPositionLabel = "You're owed" | "You owe" | "You're even";

export type GroupPosition =
  | { kind: "hidden" }
  | {
      kind: "ready";
      label: GroupPositionLabel | null;
      /** Null when several currencies cannot combine. */
      numberText: string | null;
      sentence: string | null;
      /** Muted line under the name once the position block scrolls away. */
      compactLine: string | null;
      showUnifyLine: boolean;
      showSettle: boolean;
      showRemind: boolean;
      rows: Balance[];
    };

const MATERIAL = 0.01;

function isViewer(
  person: Balance,
  userId?: string,
  participantId?: string,
): boolean {
  return (!!userId && person.user_id === userId)
    || (!!participantId && person.participant_id === participantId)
    || person.full_name === "You";
}

function viewerRows(
  balances: Balance[],
  userId?: string,
  participantId?: string,
): Balance[] {
  return balances.filter((balance) => (
    (!!userId && balance.user_id === userId)
    || (!!participantId && balance.participant_id === participantId)
  ));
}

function involvedEdges(
  edges: DebtEdge[],
  userId?: string,
  participantId?: string,
): DebtEdge[] {
  const mine = edges.filter((edge) => (
    isViewer(edge.fromUser, userId, participantId)
    || isViewer(edge.toUser, userId, participantId)
  ));
  return [...mine].sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    const aOther = isViewer(a.fromUser, userId, participantId) ? a.toUser.user_id : a.fromUser.user_id;
    const bOther = isViewer(b.fromUser, userId, participantId) ? b.toUser.user_id : b.fromUser.user_id;
    return (aOther || "").localeCompare(bOther || "");
  });
}

/** Same viewer-involved rows the settle list already shows. */
export function viewerSettlementRows(input: {
  balances: Balance[];
  currentUserId?: string;
  currentUserParticipantId?: string;
  unifyEnabled: boolean;
  settlementCurrency: string;
  defaultCurrency: string;
  rateBook: RateBook;
}): Balance[] {
  const edges = input.unifyEnabled
    ? simplifyUnifiedDebts(
      input.balances,
      input.settlementCurrency,
      input.rateBook,
      input.currentUserId,
      input.currentUserParticipantId,
    )
    : simplifyDebts(
      input.balances,
      input.currentUserId,
      input.defaultCurrency,
      input.currentUserParticipantId,
    );
  return involvedEdges(edges, input.currentUserId, input.currentUserParticipantId)
    .map((edge): Balance => {
      const owed = isViewer(edge.toUser, input.currentUserId, input.currentUserParticipantId);
      const other = owed ? edge.fromUser : edge.toUser;
      return {
        ...other,
        amount: owed ? edge.amount : -edge.amount,
        currency: edge.currency,
      };
    })
    .filter((row) => Math.abs(row.amount) >= 0.005);
}

function positionHeadline(unified: UnifiedTotal): string {
  const pieces: string[] = [];
  if (Math.abs(unified.amount) >= MATERIAL || unified.leftover.length === 0) {
    pieces.push(formatShareCurrency(Math.abs(unified.amount), unified.currency));
  }
  for (const part of unified.leftover) {
    if (Math.abs(part.original) < MATERIAL) continue;
    pieces.push(formatShareCurrency(Math.abs(part.original), part.currency));
  }
  return pieces.join(" + ");
}

function polarityOf(unified: UnifiedTotal): "owed" | "owe" | "even" | "mixed" {
  const amounts = [unified.amount];
  for (const part of unified.leftover) amounts.push(part.original);
  const nonzero = amounts.filter((amount) => Math.abs(amount) >= MATERIAL);
  if (nonzero.length === 0) return "even";
  if (nonzero.every((amount) => amount > 0)) return "owed";
  if (nonzero.every((amount) => amount < 0)) return "owe";
  return "mixed";
}

function labelFor(polarity: "owed" | "owe" | "even" | "mixed"): GroupPositionLabel | null {
  if (polarity === "owed") return "You're owed";
  if (polarity === "owe") return "You owe";
  if (polarity === "even") return "You're even";
  return null;
}

export function counterpartySentence(
  rows: Balance[],
  participants: Participant[] = [],
  currentUserId?: string | null,
): string | null {
  const top = [...rows]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 2);
  if (top.length === 0) return null;
  const firstOwed = top[0].amount > 0;
  const clauses = top.map((row, index) => {
    const name = settlementCounterpartyShortName(row, participants, currentUserId);
    const amount = formatShareCurrency(Math.abs(row.amount), row.currency);
    const owed = row.amount > 0;
    if (index === 0 || owed !== firstOwed) {
      return owed ? `${name} owes ${amount}` : `You owe ${name} ${amount}`;
    }
    return `${name} ${amount}`;
  });
  return `${clauses.join(" · ")} ›`;
}

export function resolveGroupPosition(input: {
  balances: Balance[];
  currentUserId?: string;
  currentUserParticipantId?: string;
  participants?: Participant[];
  unifyEnabled: boolean;
  settlementCurrency: string;
  defaultCurrency: string;
  rateBook?: RateBook;
  activeMemberCount?: number;
  membersKnown?: boolean;
  hasNonZeroBalance?: boolean;
}): GroupPosition {
  const membersKnown = input.membersKnown !== false;
  const activeMemberCount = input.activeMemberCount ?? 2;
  const hasNonZero = input.hasNonZeroBalance
    ?? input.balances.some((balance) => Math.abs(balance.amount) >= 0.005);
  if (membersKnown && activeMemberCount <= 1 && !hasNonZero) {
    return { kind: "hidden" };
  }

  const rateBook = input.rateBook ?? emptyRateBook();
  const rows = viewerSettlementRows({
    balances: input.balances,
    currentUserId: input.currentUserId,
    currentUserParticipantId: input.currentUserParticipantId,
    unifyEnabled: input.unifyEnabled,
    settlementCurrency: input.settlementCurrency,
    defaultCurrency: input.defaultCurrency,
    rateBook,
  });
  const sentence = counterpartySentence(rows, input.participants, input.currentUserId);
  const showRemind = rows.some((row) => row.amount > 0.005);

  const material = input.balances.filter((balance) => Math.abs(balance.amount) >= MATERIAL);
  const currencies = collectCurrencies(material);
  if (!input.unifyEnabled && isMultiCurrency(currencies)) {
    const showSettle = rows.length > 0;
    return {
      kind: "ready",
      label: null,
      numberText: null,
      sentence,
      compactLine: "Show in one currency",
      showUnifyLine: true,
      showSettle,
      showRemind: showSettle && showRemind,
      rows,
    };
  }

  const mine = viewerRows(input.balances, input.currentUserId, input.currentUserParticipantId);
  const currency = input.unifyEnabled
    ? input.settlementCurrency
    : (mine[0]?.currency || rows[0]?.currency || input.defaultCurrency);
  const source = mine.length > 0
    ? mine
    : rows.map((row) => ({
      user_id: input.currentUserId || "",
      amount: row.amount,
      currency: row.currency,
    }));
  const unified = unifyBalances(source, currency, rateBook);
  const polarity = polarityOf(unified);
  const label = labelFor(polarity);
  const numberText = positionHeadline(unified);
  const showSettle = polarity !== "even" && (rows.length > 0 || unified.leftover.length > 0);
  const compactLine = label && numberText
    ? `${label} ${numberText}`
    : numberText;

  return {
    kind: "ready",
    label,
    numberText,
    sentence: polarity === "even" ? null : sentence,
    compactLine,
    showUnifyLine: false,
    showSettle,
    showRemind: showSettle && showRemind,
    rows,
  };
}
