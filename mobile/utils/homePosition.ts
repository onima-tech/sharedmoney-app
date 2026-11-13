/**
 * Home position from `GET /balances` `overall_balances`.
 *
 * The balances API already sums the viewer per currency. This helper displays
 * that one row when it is the only row. It does not add rows together, convert
 * currencies, or pick a currency when the response has none.
 */
import type { Balance } from "../types";
import { formatShareCurrency } from "./settleShareMessage";

const MATERIAL = 0.01;

export type HomePositionLabel = "You're owed" | "You owe" | "You're even";

export type HomePosition =
  | { kind: "unknown" }
  | {
      kind: "amount";
      label: HomePositionLabel;
      /** The single overall_balances figure, or "0" when that response is empty. */
      numberText: string;
      mutedLine: string;
    }
  | {
      kind: "split";
      /** Second currency, or that the rows do not combine. No number. */
      mutedLine: string;
    };

export function countGroupsWithViewerBalance(
  groupBalances: Array<{ group_id: string; balances: Array<{ user_id?: string; amount: number }> }>,
  activeGroupIds: readonly string[],
  userId?: string,
): number {
  const active = new Set(activeGroupIds);
  let count = 0;
  for (const group of groupBalances) {
    if (!active.has(group.group_id)) continue;
    const mine = userId
      ? group.balances.filter((row) => row.user_id === userId)
      : group.balances;
    if (mine.some((row) => Math.abs(row.amount) >= MATERIAL)) count += 1;
  }
  return count;
}

function acrossLine(count: number): string {
  const n = count > 0 ? count : 1;
  return n === 1 ? "Across 1 group" : `Across ${n} groups`;
}

function splitLine(rows: Balance[]): string {
  const first = rows[0]?.currency?.toUpperCase() ?? "";
  const second = rows.find((row) => row.currency.toUpperCase() !== first);
  if (second) return `Also ${second.currency.toUpperCase()} · they don’t combine`;
  return "They don’t combine";
}

export function homePosition(input: {
  hasBalances: boolean;
  overallBalances: Balance[];
  groupsWithBalance: number;
  activeGroupCount: number;
}): HomePosition {
  if (!input.hasBalances) return { kind: "unknown" };

  const rows = input.overallBalances.filter((row) => row.currency.trim().length > 0);
  if (rows.length >= 2) {
    return { kind: "split", mutedLine: splitLine(rows) };
  }

  if (rows.length === 1) {
    const row = rows[0];
    const amount = row.amount;
    const mutedCount = Math.abs(amount) >= MATERIAL
      ? input.groupsWithBalance
      : input.activeGroupCount;
    if (amount > MATERIAL) {
      return {
        kind: "amount",
        label: "You're owed",
        numberText: formatShareCurrency(amount, row.currency),
        mutedLine: acrossLine(mutedCount),
      };
    }
    if (amount < -MATERIAL) {
      return {
        kind: "amount",
        label: "You owe",
        numberText: formatShareCurrency(Math.abs(amount), row.currency),
        mutedLine: acrossLine(mutedCount),
      };
    }
    return {
      kind: "amount",
      label: "You're even",
      numberText: formatShareCurrency(0, row.currency),
      mutedLine: acrossLine(input.activeGroupCount),
    };
  }

  return {
    kind: "amount",
    label: "You're even",
    numberText: "0",
    mutedLine: acrossLine(input.activeGroupCount),
  };
}
