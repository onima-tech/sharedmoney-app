-- Pin search_path on the group-creator trigger and schema-qualify its insert.
-- pg_temp is listed last so a temporary group_members cannot be chosen first.
-- The public insert, conflict behavior, return value, owner, and grants stay the same.

CREATE OR REPLACE FUNCTION public.add_group_creator_as_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
