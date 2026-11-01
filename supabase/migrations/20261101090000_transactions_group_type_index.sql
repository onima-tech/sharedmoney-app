-- Speed up balances / stats expense scans:
--   FROM transactions WHERE group_id = $1 AND type = 'expense'
-- Existing single-column indexes (group_id, type) force a less selective path
-- when both predicates are present. Composite covers the balances critical path.
-- Index-only change: no new tables, so no GRANT / RLS updates.

CREATE INDEX IF NOT EXISTS idx_transactions_group_id_type
  ON public.transactions (group_id, type);
