import { fetchBalances } from "../hooks/useBalances";
import { fetchSettlements } from "../hooks/useSettlements";
import { fetchTransactionsPage, type TransactionsCursor } from "../hooks/useTransactions";
import type { Balance, GroupStatsResponse, Settlement, Transaction } from "../types";

const EXPORT_PAGE_SIZE = 100;
const EXPORT_PAGE_CAP = 100;

export async function fetchAllGroupTransactions(groupId: string): Promise<Transaction[]> {
  const items: Transaction[] = [];
  let cursor: TransactionsCursor | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < EXPORT_PAGE_CAP; page += 1) {
    const result = await fetchTransactionsPage({
      groupId,
      cursor,
      limit: EXPORT_PAGE_SIZE,
    });
    items.push(...result.items);
    if (!result.has_more || !result.next_cursor) break;
    const key = `${result.next_cursor.date}:${result.next_cursor.id}`;
    if (seen.has(key)) break;
    seen.add(key);
    cursor = result.next_cursor;
  }
  return items;
}

export async function loadGroupExportSource(groupId: string): Promise<{
  transactions: Transaction[];
  settlements: Settlement[];
  balances: Balance[];
  stats: GroupStatsResponse | null;
}> {
  const [transactions, settlementsResponse, balancesResponse] = await Promise.all([
    fetchAllGroupTransactions(groupId),
    fetchSettlements(groupId),
    fetchBalances(groupId, true),
  ]);
  return {
    transactions,
    settlements: settlementsResponse.settlements ?? [],
    balances: balancesResponse.group_balances?.[0]?.balances ?? [],
    stats: balancesResponse.group_stats ?? null,
  };
}
