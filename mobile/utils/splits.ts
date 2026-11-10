export const SPLIT_SUM_TOLERANCE = 0.01;

export interface SplitShare {
  participant_id: string;
  amount: number;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function roundMoney(amount: number): number {
  return fromCents(toCents(amount));
}

export function sanitizeAmountInput(text: string): string | null {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) return null;
  if (parts[1] && parts[1].length > 2) return null;
  return cleaned;
}

export function parseAmountInput(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function formatAmountInput(amount: number): string {
  return roundMoney(amount).toFixed(2);
}

function allocateLargestRemainderCents(
  totalCents: number,
  weights: number[],
): number[] {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (weights.length === 0 || totalWeight <= 0) return [];

  const allocations = weights.map((weight, index) => {
    const raw = totalCents * weight;
    return {
      index,
      amount: Math.floor(raw / totalWeight),
      remainder: raw % totalWeight,
    };
  });
  let remaining = totalCents - allocations.reduce((sum, item) => sum + item.amount, 0);

  [...allocations]
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach((allocation) => {
      if (remaining > 0) {
        allocations[allocation.index].amount += 1;
        remaining -= 1;
      }
    });

  return allocations.map((allocation) => allocation.amount);
}

export function calculateEqualSplits(
  totalAmount: number,
  participantIds: string[],
): SplitShare[] {
  const uniqueIds = [...new Set(participantIds)];
  if (uniqueIds.length === 0) return [];

  const cents = allocateLargestRemainderCents(
    toCents(totalAmount),
    uniqueIds.map(() => 1),
  );
  return uniqueIds.map((participantId, index) => ({
    participant_id: participantId,
    amount: fromCents(cents[index]),
  }));
}

export function equalSplitAmountMap(
  totalAmount: number,
  participantIds: string[],
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const split of calculateEqualSplits(totalAmount, participantIds)) {
    next[split.participant_id] = formatAmountInput(split.amount);
  }
  return next;
}

export function sumSelectedAmounts(
  amounts: Record<string, string>,
  selectedIds: string[],
): number {
  return roundMoney(
    selectedIds.reduce((sum, id) => {
      const parsed = parseAmountInput(amounts[id] ?? "");
      return sum + (parsed ?? 0);
    }, 0),
  );
}

export function remainingSplitAmount(
  totalAmount: number,
  assignedAmount: number,
): number {
  return roundMoney(totalAmount - assignedAmount);
}

export function areSplitAmountsEqual(amounts: number[]): boolean {
  if (amounts.length <= 1) return true;

  const cents = amounts.map(toCents);
  const totalCents = cents.reduce((sum, value) => sum + value, 0);
  const splitCount = cents.length;
  const baseCents = Math.floor(totalCents / splitCount);
  const remainderCents = totalCents - baseCents * splitCount;
  const lowCount = cents.filter((value) => value === baseCents).length;
  const highCount = cents.filter((value) => value === baseCents + 1).length;

  if (lowCount + highCount === splitCount && highCount === remainderCents) {
    return true;
  }

  // Older equal splits dumped the entire remainder on one person.
  if (remainderCents > 1) {
    const dumpedCount = cents.filter((value) => value === baseCents + remainderCents).length;
    if (lowCount === splitCount - 1 && dumpedCount === 1) {
      return true;
    }
  }

  return false;
}

export function isUnequalSplit(splits: Array<{ amount: number }>): boolean {
  if (splits.length < 2) return false;
  return !areSplitAmountsEqual(splits.map((split) => split.amount));
}

export function distributeRemaining(
  currentAmounts: Record<string, string>,
  selectedIds: string[],
  totalAmount: number,
): Record<string, string> {
  if (selectedIds.length === 0) return { ...currentAmounts };

  const assignedCents = selectedIds.reduce((sum, id) => {
    const parsed = parseAmountInput(currentAmounts[id] ?? "");
    return sum + toCents(parsed ?? 0);
  }, 0);
  const remainingCents = toCents(totalAmount) - assignedCents;
  if (remainingCents <= 0) return { ...currentAmounts };

  const baseCents = Math.floor(remainingCents / selectedIds.length);
  const extraCents = remainingCents - baseCents * selectedIds.length;
  const next = { ...currentAmounts };

  selectedIds.forEach((id, index) => {
    const current = toCents(parseAmountInput(currentAmounts[id] ?? "") ?? 0);
    const addition = baseCents + (index === 0 ? extraCents : 0);
    next[id] = formatAmountInput(fromCents(current + addition));
  });

  return next;
}

export function scaleSplitsToTotal(
  splits: SplitShare[],
  newTotal: number,
): SplitShare[] {
  if (splits.length === 0) return [];

  const oldCents = splits.map((split) => toCents(split.amount));
  const oldTotalCents = oldCents.reduce((sum, cents) => sum + cents, 0);
  if (oldTotalCents <= 0) {
    return calculateEqualSplits(
      newTotal,
      splits.map((split) => split.participant_id),
    );
  }

  const newTotalCents = toCents(newTotal);
  let allocated = 0;
  return splits.map((split, index) => {
    const nextCents = index === splits.length - 1
      ? newTotalCents - allocated
      : Math.round((oldCents[index] * newTotalCents) / oldTotalCents);
    allocated += nextCents;
    return {
      participant_id: split.participant_id,
      amount: fromCents(nextCents),
    };
  });
}

export const MAX_SHARE_COUNT = 99;

export function sharePercent(amount: number, totalAmount: number): number {
  if (totalAmount <= 0 || amount <= 0) return 0;
  return Math.round((amount / totalAmount) * 100);
}

export function defaultShareMap(participantIds: string[]): Record<string, number> {
  return Object.fromEntries(participantIds.map((id) => [id, 1]));
}

export function clampShareCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_SHARE_COUNT, Math.max(1, Math.floor(value)));
}

export function calculateShareSplits(
  totalAmount: number,
  selectedIds: string[],
  shares: Record<string, number>,
): SplitShare[] {
  const uniqueIds = [...new Set(selectedIds)];
  if (uniqueIds.length === 0) return [];

  const weights = uniqueIds.map((id) => clampShareCount(shares[id] ?? 1));
  const cents = allocateLargestRemainderCents(toCents(totalAmount), weights);
  if (cents.length === 0) return [];

  return uniqueIds.map((participantId, index) => ({
    participant_id: participantId,
    amount: fromCents(cents[index]),
  }));
}

export function amountsFromShares(
  totalAmount: number,
  selectedIds: string[],
  shares: Record<string, number>,
): Record<string, string> {
  return Object.fromEntries(
    calculateShareSplits(totalAmount, selectedIds, shares).map((split) => [
      split.participant_id,
      formatAmountInput(split.amount),
    ]),
  );
}

export function sharesAreUnequal(
  selectedIds: string[],
  shares: Record<string, number>,
): boolean {
  if (selectedIds.length < 2) return false;
  const first = clampShareCount(shares[selectedIds[0]] ?? 1);
  return selectedIds.some((id) => clampShareCount(shares[id] ?? 1) !== first);
}

export function splitsFromAmountMap(
  amounts: Record<string, string>,
  selectedIds: string[],
): SplitShare[] | null {
  const splits: SplitShare[] = [];
  for (const participantId of selectedIds) {
    const amount = parseAmountInput(amounts[participantId] ?? "");
    if (amount === null || amount <= 0) return null;
    splits.push({ participant_id: participantId, amount: roundMoney(amount) });
  }
  return splits;
}
