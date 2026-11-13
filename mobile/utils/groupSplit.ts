import { Transaction, TransactionSplit } from "../types";
import {
  clampShareCount,
  defaultShareMap,
  formatAmountInput,
  isUnequalSplit,
} from "./splits";

export type GroupSplitTransaction = Pick<
  Transaction,
  | "id"
  | "group_id"
  | "type"
  | "created_at"
  | "split_among_participant_ids"
  | "splits"
>;

export type SplitAmongSource = Pick<
  Transaction,
  "type" | "split_among_participant_ids" | "splits"
>;

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function belongsToGroup(
  transaction: GroupSplitTransaction,
  groupId: string
): boolean {
  // Group-scoped feeds may omit group_id; still accept those rows.
  if (!transaction.group_id) return true;
  return transaction.group_id === groupId;
}

function enteredAtMs(transaction: GroupSplitTransaction): number {
  if (!transaction.created_at) return 0;
  const parsed = Date.parse(transaction.created_at);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isExpense(transaction: SplitAmongSource): boolean {
  return !transaction.type || transaction.type === "expense";
}

/**
 * Participant IDs this expense was split among, preferring split rows
 * and falling back to split_among_participant_ids.
 */
export function extractSplitAmongParticipantIds(
  transaction: SplitAmongSource
): string[] {
  if (!isExpense(transaction)) return [];

  const fromSplits = (transaction.splits || [])
    .map((split: Pick<TransactionSplit, "participant_id">) => split.participant_id);
  const splitIds = uniqueIds(fromSplits);
  if (splitIds.length > 0) return splitIds;

  return uniqueIds(transaction.split_among_participant_ids || []);
}

/**
 * Keep last-transaction people who are still available in the current group.
 */
export function intersectSplitAmongWithAvailable(
  selectedIds: string[] | null | undefined,
  availableIds: string[]
): string[] {
  if (!selectedIds || selectedIds.length === 0 || availableIds.length === 0) {
    return [];
  }
  const available = new Set(availableIds);
  return uniqueIds(selectedIds).filter((id) => available.has(id));
}

/**
 * Returns the split-among participant IDs of the most recently entered
 * expense in a group. "Entered" uses created_at, then id as a tiebreaker,
 * so backdated expenses still count as the latest if they were added last.
 */
export function getLastEnteredExpenseSplitAmong(
  transactions: GroupSplitTransaction[],
  groupId: string
): string[] | undefined {
  let latest: GroupSplitTransaction | undefined;

  for (const transaction of transactions) {
    if (!belongsToGroup(transaction, groupId)) continue;
    if (extractSplitAmongParticipantIds(transaction).length === 0) continue;

    if (!latest) {
      latest = transaction;
      continue;
    }

    const timeDelta = enteredAtMs(transaction) - enteredAtMs(latest);
    if (timeDelta > 0 || (timeDelta === 0 && transaction.id > latest.id)) {
      latest = transaction;
    }
  }

  if (!latest) return undefined;
  const ids = extractSplitAmongParticipantIds(latest);
  return ids.length > 0 ? ids : undefined;
}

export type GroupDefaultSplitMode = "equal" | "weights";

export interface GroupDefaultSplit {
  mode: GroupDefaultSplitMode;
  /** Participant id -> share count. Ignored unless mode is weights. */
  weights: Record<string, number>;
}

export interface ExpenseSplitFormState {
  mode: "equal" | "unequal" | "shares";
  selectedIds: string[];
  shares: Record<string, number>;
  amounts: Record<string, string>;
}

/**
 * Read a group's saved default. Missing or unknown data is an equal split.
 * Weights are a prefill for a new expense, not a rewrite of saved splits.
 */
export function normalizeGroupDefaultSplit(
  group: {
    default_split_mode?: unknown;
    default_split_weights?: unknown;
  } | null | undefined,
): GroupDefaultSplit {
  const raw = group?.default_split_weights;
  const weights: Record<string, number> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [id, value] of Object.entries(raw)) {
      if (!id) continue;
      const numeric = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numeric)) continue;
      weights[id] = clampShareCount(numeric);
    }
  }

  const mode: GroupDefaultSplitMode = group?.default_split_mode === "weights"
    ? "weights"
    : "equal";
  return { mode, weights };
}

/**
 * Split state for an expense that has already been saved.
 * The group default is not an input: changing it cannot alter this result.
 */
export function storedExpenseSplitState(expense: {
  splits?: Array<{ participant_id?: string | null; amount: number }> | null;
  split_among_participant_ids?: string[] | null;
}): ExpenseSplitFormState {
  const splits = Array.isArray(expense.splits) ? expense.splits : [];
  if (splits.length > 0) {
    const selectedIds = uniqueIds(splits.map((split) => split.participant_id));
    const amounts: Record<string, string> = {};
    for (const split of splits) {
      if (!split.participant_id) continue;
      amounts[split.participant_id] = formatAmountInput(split.amount);
    }
    return {
      mode: isUnequalSplit(splits) ? "unequal" : "equal",
      selectedIds,
      shares: defaultShareMap(selectedIds),
      amounts,
    };
  }

  const selectedIds = uniqueIds(expense.split_among_participant_ids || []);
  return {
    mode: "equal",
    selectedIds,
    shares: defaultShareMap(selectedIds),
    amounts: {},
  };
}

/**
 * Prefill for a new expense. Equal keeps the last expense's people.
 * Weights include every current person and do not consult that memory.
 */
export function newExpenseSplitFromGroupDefault({
  groupDefault,
  availableParticipantIds,
  rememberedIds,
}: {
  groupDefault: GroupDefaultSplit;
  availableParticipantIds: string[];
  rememberedIds?: string[] | null;
}): Pick<ExpenseSplitFormState, "mode" | "selectedIds" | "shares"> {
  const available = uniqueIds(availableParticipantIds);

  switch (groupDefault.mode) {
    case "weights": {
      const shares: Record<string, number> = {};
      for (const id of available) {
        shares[id] = clampShareCount(groupDefault.weights[id] ?? 1);
      }
      return { mode: "shares", selectedIds: available, shares };
    }
    case "equal": {
      const remembered = intersectSplitAmongWithAvailable(rememberedIds, available);
      const selectedIds = remembered.length > 0 ? remembered : available;
      return {
        mode: "equal",
        selectedIds,
        shares: defaultShareMap(selectedIds),
      };
    }
    default: {
      const unreachable: never = groupDefault.mode;
      return unreachable;
    }
  }
}

export function resolveGroupDefaultSplitAmong({
  groupId,
  latestSplitAmong,
  feedTransactions,
}: {
  groupId: string;
  latestSplitAmong?: string[] | null;
  feedTransactions: GroupSplitTransaction[];
}): string[] | undefined {
  const fromLatest = uniqueIds(latestSplitAmong || []);
  if (fromLatest.length > 0) return fromLatest;
  return getLastEnteredExpenseSplitAmong(feedTransactions, groupId);
}
