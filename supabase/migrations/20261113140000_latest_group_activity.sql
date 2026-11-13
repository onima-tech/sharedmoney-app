-- Latest ledger row per group for the Home recency line.
-- SECURITY INVOKER so transaction_history RLS still applies.

CREATE OR REPLACE FUNCTION public.latest_group_activity(p_group_ids uuid[])
RETURNS TABLE (
  group_id uuid,
  action text,
  activity_type text,
  changed_by uuid,
  changed_at timestamp,
  changes jsonb,
  snapshot jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (th.group_id)
    th.group_id,
    th.action::text,
    th.activity_type::text,
    th.changed_by,
    th.changed_at,
    th.changes,
    th.snapshot
  FROM public.transaction_history th
  WHERE th.group_id = ANY (p_group_ids)
  ORDER BY th.group_id, th.changed_at DESC;
$$;

REVOKE ALL ON FUNCTION public.latest_group_activity(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.latest_group_activity(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.latest_group_activity(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.latest_group_activity(uuid[]) IS
  'Latest transaction_history row per group, for the Home recency line. Caller must be a member; RLS applies.';
