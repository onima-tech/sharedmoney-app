-- Group default split for new expenses only.
-- default_split_mode is equal or weights. default_split_weights maps a
-- participant id to a share count (1-99), for example 2 when a couple counts
-- as two people. Saving an expense copies the resulting amounts onto that
-- expense. This migration does not read or write transactions.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS default_split_mode TEXT NOT NULL DEFAULT 'equal',
  ADD COLUMN IF NOT EXISTS default_split_weights JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_default_split_mode_check;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_default_split_mode_check
  CHECK (default_split_mode IN ('equal', 'weights'));

ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_default_split_weights_object;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_default_split_weights_object
  CHECK (jsonb_typeof(default_split_weights) = 'object');

COMMENT ON COLUMN public.groups.default_split_mode IS
  'Prefill for a new expense: equal, or per-member weights. Never applied to expenses already saved.';
COMMENT ON COLUMN public.groups.default_split_weights IS
  'Participant id to share count (1-99). Ignored unless default_split_mode is weights, and only when prefilling a new expense.';

CREATE OR REPLACE FUNCTION public.update_group_default_split(
  p_group_id UUID,
  p_mode TEXT,
  p_weights JSONB
)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_group public.groups;
  weight_key TEXT;
  weight_value JSONB;
  weight_number NUMERIC;
  weight_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = auth.uid()
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not an active group member';
  END IF;

  IF p_mode IS DISTINCT FROM 'equal' AND p_mode IS DISTINCT FROM 'weights' THEN
    RAISE EXCEPTION 'default_split_mode must be equal or weights';
  END IF;

  IF p_weights IS NULL OR jsonb_typeof(p_weights) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'default_split_weights must be an object';
  END IF;

  FOR weight_key, weight_value IN
    SELECT key, value FROM jsonb_each(p_weights)
  LOOP
    weight_count := weight_count + 1;
    IF weight_count > 100 THEN
      RAISE EXCEPTION 'default_split_weights has too many people';
    END IF;

    IF weight_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Each weight must name a person in this group';
    END IF;

    IF jsonb_typeof(weight_value) IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Each weight must be an integer from 1 to 99';
    END IF;

    weight_number := (weight_value #>> '{}')::numeric;
    IF weight_number <> trunc(weight_number)
       OR weight_number < 1
       OR weight_number > 99 THEN
      RAISE EXCEPTION 'Each weight must be an integer from 1 to 99';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.participants
      WHERE id = weight_key::uuid
        AND group_id = p_group_id
    ) THEN
      RAISE EXCEPTION 'Each weight must name a person in this group';
    END IF;
  END LOOP;

  -- Groups row only. Transaction rows and their splits are left untouched.
  UPDATE public.groups
  SET
    default_split_mode = p_mode,
    default_split_weights = p_weights,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_group_id
  RETURNING * INTO updated_group;

  IF updated_group.id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  RETURN updated_group;
END;
$$;

REVOKE ALL ON FUNCTION public.update_group_default_split(UUID, TEXT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_group_default_split(UUID, TEXT, JSONB)
  TO authenticated, service_role;
