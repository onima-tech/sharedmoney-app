import { Balance } from "../types";
import { formatShareCurrency } from "./settleShareMessage";

/**
 * Build the Leave Group confirm body, optionally including the viewer's balance.
 */
export function buildLeaveGroupConfirmMessage(
  _groupName: string,
  balances: Balance[] | undefined,
  currentUserId: string | undefined
): string {
  const base =
    `You'll become a former member. Expenses stay for everyone.`;

  if (!currentUserId || !balances || balances.length === 0) {
    return `${base}`;
  }

  const mine = balances.filter((b) => b.user_id === currentUserId);
  const byCurrency = new Map<string, number>();
  for (const b of mine) {
    byCurrency.set(b.currency, (byCurrency.get(b.currency) || 0) + b.amount);
  }

  const parts = [...byCurrency.entries()]
    .filter(([, amount]) => Math.abs(amount) >= 0.01)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([currency, amount]) => {
      const formatted = formatShareCurrency(amount, currency);
      return amount > 0 ? `+${formatted}` : formatted;
    });

  if (parts.length === 0) {
    return `${base}\n\nYour current balance: Settled`;
  }

  return `${base}\n\nYour current balance: ${parts.join(", ")}`;
}

/** Archive confirm copy (LOCKED). */
export const ARCHIVE_GROUP_CONFIRM_MESSAGE =
  "Hide from your active groups. Find it under Archived.";

/** Remove-from-lists confirm copy (LOCKED). */
export const REMOVE_FROM_LISTS_CONFIRM_MESSAGE =
  "Won't show under Active, Archived, or Former. Others are unaffected.";
