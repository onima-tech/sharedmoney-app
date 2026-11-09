-- Pin search_path on membership helpers. status has existed since
-- 20251217100000, so keep only the active-member checks.

CREATE OR REPLACE FUNCTION public.is_user_group_member(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.is_user_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_group_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_user_group_owner(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = check_group_id AND created_by = check_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id
      AND user_id = check_user_id
      AND role = 'owner'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.is_user_group_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_group_owner(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_group(
  group_name VARCHAR(255),
  group_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_group_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  INSERT INTO public.groups (name, description, created_by)
  VALUES (group_name, group_description, current_user_id)
  RETURNING id INTO new_group_id;

  -- The trigger adds the creator as owner.
  RETURN new_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.create_group(character varying, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group(character varying, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_user_active_group_member(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = check_group_id AND created_by = check_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id
      AND user_id = check_user_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.is_user_active_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_active_group_member(uuid, uuid) TO authenticated;
