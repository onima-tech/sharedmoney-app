/**
 * Typographic position for a group: a label, one number, one sentence.
 * The number is the viewer's own balance row (or `unifyBalances` of those
 * rows). Counterparties are settlement edges from `simplifyDebts` /
 * `simplifyUnifiedDebts`. This does not add counterparty amounts into a total.
 */
import type { Balance } from "../types";
import {
  formatUnifiedHeadline,
  simplifyUnifiedDebts,
  unifyBalances,
  type RateBook,
} from "./currencyMerge";
import { simplifyDebts, type DebtEdge } from "./debt";
import { formatShareCurrency, settleSharePersonName } from "./settleShareMessage";

export type PositionLabel = "You're owed" | "You owe" | "You're even";

export const SHOW_IN_ONE_CURRENCY = "Show in one currency ›";
export const SHOW_IN_ONE_CURRENCY_COMPACT = "Show in one currency";

export interface PositionCounterparty {
  balance: Balance;
  name: string;
}

interface AmountPosition {
  kind: "amount";
  label: PositionLabel;
  amountText: string;
  compactLine: string;
  sentence: string | null;
  counterparties: PositionCounterparty[];
  showSettle: boolean;
  showRemind: boolean;
}

interface UncombinedPosition {
  kind: "uncombined";
  prompt: typeof SHOW_IN_ONE_CURRENCY;
  compactLine: typeof SHOW_IN_ONE_CURRENCY_COMPACT;
  sentence: null;
  counterparties: PositionCounterparty[];
  showSettle: boolean;
  showRemind: boolean;
}

export type GroupPosition = AmountPosition | UncombinedPosition;

const DUST = 0.01;

function sameIdentity(
  person: { user_id?: string | null; participant_id?: string | null },
  userId: string,
  participantId?: string | null,
): boolean {
  if (person.user_id && person.user_id === userId) return true;
  if (participantId && person.participant_id && person.participant_id === participantId) {
    return true;
  }
  return false;
}

function isViewer(
  person: Balance,
  userId: string,
  participantId?: string | null,
): boolean {
  if (sameIdentity(person, userId, participantId)) return true;
  return person.full_name === "You" && person.user_id === userId;
}

function labelFor(amount: number): PositionLabel {
  if (amount > DUST) return "You're owed";
  if (amount < -DUST) return "You owe";
  return "You're even";
}

function viewerRows(
  balances: Balance[],
  userId: string,
  participantId?: string | null,
): Balance[] {
  return balances.filter((balance) => (
    sameIdentity(balance, userId, participantId) && Math.abs(balance.amount) >= DUST
  ));
}

function counterpartyFromEdge(
  edge: DebtEdge,
  userId: string,
  participantId?: string | null,
): PositionCounterparty | null {
  const viewerOwed = isViewer(edge.toUser, userId, participantId);
  const viewerOwes = isViewer(edge.fromUser, userId, participantId);
  if (!viewerOwed && !viewerOwes) return null;
  const other = viewerOwed ? edge.fromUser : edge.toUser;
  const amount = viewerOwed ? edge.amount : -edge.amount;
  if (Math.abs(amount) < 0.005) return null;
  const balance: Balance = {
    ...other,
    amount,
    currency: edge.currency,
  };
  return {
    balance,
    name: settleSharePersonName(balance),
  };
}

function sentenceFor(people: PositionCounterparty[]): string | null {
  const top = people.slice(0, 2);
  if (top.length === 0) return null;
  const firstOwesYou = top[0].balance.amount > 0;
  const clauses = top.map((person, index) => {
    const money = formatShareCurrency(Math.abs(person.balance.amount), person.balance.currency);
    const owesYou = person.balance.amount > 0;
    if (index === 0) {
      return owesYou ? `${person.name} owes ${money}` : `You owe ${person.name} ${money}`;
    }
    if (owesYou === firstOwesYou) return `${person.name} ${money}`;
    return owesYou ? `${person.name} owes ${money}` : `you owe ${person.name} ${money}`;
  });
  return `${clauses.join(" · ")} ›`;
}

export function buildGroupPosition(input: {
  balances: Balance[];
  currentUserId: string;
  currentParticipantId?: string | null;
  unify: boolean;
  settlementCurrency: string;
  rateBook: RateBook;
  defaultCurrency: string;
}): GroupPosition {
  const {
    balances,
    currentUserId,
    currentParticipantId,
    unify,
    settlementCurrency,
    rateBook,
    defaultCurrency,
  } = input;

  const edges = unify
    ? simplifyUnifiedDebts(
      balances,
      settlementCurrency,
      rateBook,
      currentUserId,
      currentParticipantId ?? undefined,
    )
    : simplifyDebts(
      balances,
      currentUserId,
      defaultCurrency,
      currentParticipantId ?? undefined,
    );

  const counterparties = edges
    .map((edge) => counterpartyFromEdge(edge, currentUserId, currentParticipantId))
    .filter((person): person is PositionCounterparty => person != null)
    .sort((a, b) => {
      const byAmount = Math.abs(b.balance.amount) - Math.abs(a.balance.amount);
      if (Math.abs(byAmount) > 0.001) return byAmount;
      return a.name.localeCompare(b.name);
    });

  const mine = viewerRows(balances, currentUserId, currentParticipantId);
  const currencies = [...new Set(mine.map((row) => (row.currency || defaultCurrency).toUpperCase()))];
  const showRemind = counterparties.some((person) => person.balance.amount > DUST);

  if (!unify && currencies.length > 1) {
    return {
      kind: "uncombined",
      prompt: SHOW_IN_ONE_CURRENCY,
      compactLine: SHOW_IN_ONE_CURRENCY_COMPACT,
      sentence: null,
      counterparties,
      showSettle: counterparties.length > 0,
      showRemind: counterparties.length > 0 && showRemind,
    };
  }

  const target = currencies.length === 1 ? currencies[0] : settlementCurrency || defaultCurrency;
  const unified = mine.length > 0
    ? unifyBalances(mine, unify ? settlementCurrency : target, rateBook)
    : null;
  const leftover = unified?.leftover.filter((part) => Math.abs(part.original) >= DUST) ?? [];
  if (unified && leftover.length > 0 && Math.abs(unified.amount) < DUST) {
    return {
      kind: "uncombined",
      prompt: SHOW_IN_ONE_CURRENCY,
      compactLine: SHOW_IN_ONE_CURRENCY_COMPACT,
      sentence: null,
      counterparties,
      showSettle: counterparties.length > 0,
      showRemind: counterparties.length > 0 && showRemind,
    };
  }

  const signed = unified && Math.abs(unified.amount) >= DUST ? unified.amount : 0;
  const label = labelFor(signed);
  const currency = unified?.currency || target || defaultCurrency;
  const amountText = unified && leftover.length > 0
    ? formatUnifiedHeadline(unified)
    : formatShareCurrency(Math.abs(signed), currency);
  const even = label === "You're even";

  return {
    kind: "amount",
    label,
    amountText,
    compactLine: even ? label : `${label} ${amountText}`,
    sentence: even ? null : sentenceFor(counterparties),
    counterparties: even ? [] : counterparties,
    showSettle: !even && counterparties.length > 0,
    showRemind: !even && showRemind,
  };
}
