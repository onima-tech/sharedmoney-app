/**
 * Shared ledger loader for balance + stats calculation.
 * Fetches expense transactions, settlements, and participants in parallel
 * so the balances edge function avoids sequential waterfalls and duplicate
 * re-fetches when include_stats=true.
 */

export type LedgerTransactionSplit = {
  participant_id?: string | null;
  amount: number | string;
};

export type LedgerTransaction = {
  id: number;
  amount: number | string;
  description?: string;
  date?: string;
  type?: string;
  paid_by_participant_id: string | null;
  currency: string;
  transaction_splits?: LedgerTransactionSplit[];
};

export type LedgerParticipant = {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  type?: string;
};

export type LedgerSettlement = {
  id: string;
  group_id: string;
  from_participant_id: string | null;
  to_participant_id: string | null;
  amount: number | string;
  currency: string;
};

export type GroupLedgerSnapshot = {
  transactions: LedgerTransaction[];
  participants: LedgerParticipant[];
  settlements: LedgerSettlement[];
};

const BALANCE_TX_SELECT = `
  id,
  amount,
  paid_by_participant_id,
  currency,
  transaction_splits (
    participant_id,
    amount
  )
`;

const STATS_TX_SELECT = `
  id,
  amount,
  description,
  date,
  type,
  paid_by_participant_id,
  currency,
  transaction_splits (
    participant_id,
    amount
  )
`;

/**
 * Count of parallel PostgREST queries issued by loadGroupLedger.
 * Used in tests / PR before-after reasoning (not a runtime metric).
 */
export const GROUP_LEDGER_PARALLEL_QUERY_COUNT = 3;

export async function loadGroupLedger(
  supabase: any,
  groupId: string,
  options?: { includeStatsFields?: boolean }
): Promise<GroupLedgerSnapshot> {
  const includeStatsFields = options?.includeStatsFields === true;
  const txSelect = includeStatsFields ? STATS_TX_SELECT : BALANCE_TX_SELECT;

  let transactionsQuery = supabase
    .from("transactions")
    .select(txSelect)
    .eq("group_id", groupId)
    .eq("type", "expense");

  if (includeStatsFields) {
    transactionsQuery = transactionsQuery
      .order("date", { ascending: false })
      .order("id", { ascending: false });
  }

  const [transactionsResult, participantsResult, settlementsResult] =
    await Promise.all([
      transactionsQuery,
      supabase
        .from("participants")
        .select("id, user_id, email, full_name, avatar_url, type")
        .eq("group_id", groupId),
      supabase
        .from("settlements")
        .select(
          "id, group_id, from_participant_id, to_participant_id, amount, currency"
        )
        .eq("group_id", groupId),
    ]);

  if (transactionsResult.error) {
    throw transactionsResult.error;
  }
  if (settlementsResult.error) {
    throw settlementsResult.error;
  }
  // Participants missing is non-fatal for empty groups; treat as [].
  if (participantsResult.error) {
    throw participantsResult.error;
  }

  return {
    transactions: (transactionsResult.data || []) as LedgerTransaction[],
    participants: (participantsResult.data || []) as LedgerParticipant[],
    settlements: (settlementsResult.data || []) as LedgerSettlement[],
  };
}
