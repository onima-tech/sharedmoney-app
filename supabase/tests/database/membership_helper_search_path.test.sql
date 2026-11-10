BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(37);

INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'active@example.com'),
  ('33333333-3333-4333-8333-333333333333', 'left-owner@example.com'),
  ('44444444-4444-4444-8444-444444444444', 'archived-owner@example.com'),
  ('55555555-5555-4555-8555-555555555555', 'hidden@example.com'),
  ('66666666-6666-4666-8666-666666666666', 'outsider@example.com');

INSERT INTO public.groups (id, name, created_by)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  'Membership helper group',
  '11111111-1111-4111-8111-111111111111'
);

UPDATE public.group_members
SET status = 'left', left_at = NOW()
WHERE group_id = '77777777-7777-4777-8777-777777777777'
  AND user_id = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.group_members (group_id, user_id, role, status, archived_at, hidden_at)
VALUES
  (
    '77777777-7777-4777-8777-777777777777',
    '22222222-2222-4222-8222-222222222222',
    'member',
    'active',
    NULL,
    NULL
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '33333333-3333-4333-8333-333333333333',
    'owner',
    'left',
    NULL,
    NULL
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '44444444-4444-4444-8444-444444444444',
    'owner',
    'active',
    NOW(),
    NULL
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '55555555-5555-4555-8555-555555555555',
    'member',
    'active',
    NULL,
    NOW()
  );

SELECT is_empty(
  $$
    SELECT names.proname
    FROM unnest(ARRAY[
      'is_user_group_member',
      'is_user_group_owner',
      'is_user_active_group_member',
      'create_group'
    ]) AS names(proname)
    LEFT JOIN pg_proc p
      ON p.proname = names.proname
    LEFT JOIN pg_namespace n
      ON n.oid = p.pronamespace
     AND n.nspname = 'public'
    WHERE p.oid IS NULL
      OR NOT p.prosecdef
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg = 'search_path=public'
      )
      OR pg_get_functiondef(p.oid) LIKE '%information_schema%'
      OR pg_get_functiondef(p.oid) NOT LIKE '%public.%'
  $$,
  'helpers are security definer, pin search_path=public, and qualify public objects'
);

SELECT ok(
  to_regprocedure('public.is_user_group_member(uuid, uuid)') IS NOT NULL
  AND to_regprocedure('public.is_user_group_owner(uuid, uuid)') IS NOT NULL
  AND to_regprocedure('public.is_user_active_group_member(uuid, uuid)') IS NOT NULL
  AND to_regprocedure('public.create_group(character varying, text)') IS NOT NULL,
  'helper signatures are unchanged'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'is_user_group_member',
        'is_user_group_owner',
        'is_user_active_group_member',
        'create_group'
      )
  ),
  4::bigint,
  'each helper has one public overload'
);

SELECT is_empty(
  $$
    SELECT fn
    FROM unnest(ARRAY[
      'public.is_user_group_member(uuid,uuid)',
      'public.is_user_group_owner(uuid,uuid)',
      'public.is_user_active_group_member(uuid,uuid)',
      'public.create_group(character varying,text)'
    ]) AS fns(fn)
    WHERE has_function_privilege('anon', fn::regprocedure, 'EXECUTE')
  $$,
  'anon cannot execute membership helpers'
);

SELECT is_empty(
  $$
    SELECT fn
    FROM unnest(ARRAY[
      'public.is_user_group_member(uuid,uuid)',
      'public.is_user_group_owner(uuid,uuid)',
      'public.is_user_active_group_member(uuid,uuid)',
      'public.create_group(character varying,text)'
    ]) AS fns(fn)
    WHERE has_function_privilege('public', fn::regprocedure, 'EXECUTE')
  $$,
  'PUBLIC cannot execute membership helpers'
);

SELECT is_empty(
  $$
    SELECT fn
    FROM unnest(ARRAY[
      'public.is_user_group_member(uuid,uuid)',
      'public.is_user_group_owner(uuid,uuid)',
      'public.is_user_active_group_member(uuid,uuid)',
      'public.create_group(character varying,text)'
    ]) AS fns(fn)
    WHERE NOT has_function_privilege('authenticated', fn::regprocedure, 'EXECUTE')
  $$,
  'authenticated can execute membership helpers'
);

SELECT is_empty(
  $$
    SELECT fn
    FROM unnest(ARRAY[
      'public.is_user_group_member(uuid,uuid)',
      'public.is_user_group_owner(uuid,uuid)',
      'public.is_user_active_group_member(uuid,uuid)',
      'public.create_group(character varying,text)'
    ]) AS fns(fn)
    WHERE NOT has_function_privilege('service_role', fn::regprocedure, 'EXECUTE')
  $$,
  'service_role keeps execute on membership helpers'
);

SELECT is_empty(
  $$
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE p.proname IN (
      'is_user_group_member',
      'is_user_group_owner',
      'is_user_active_group_member',
      'create_group'
    )
      AND NOT (r.rolsuper OR r.rolbypassrls)
  $$,
  'helper owners still bypass RLS'
);

SELECT ok(
  public.is_user_group_member(
    '77777777-7777-4777-8777-777777777777',
    '22222222-2222-4222-8222-222222222222'
  ),
  'active member is a group member'
);

SELECT ok(
  public.is_user_group_member(
    '77777777-7777-4777-8777-777777777777',
    '33333333-3333-4333-8333-333333333333'
  ),
  'left member remains a group member'
);

SELECT ok(
  public.is_user_group_member(
    '77777777-7777-4777-8777-777777777777',
    '44444444-4444-4444-8444-444444444444'
  ),
  'archived member remains a group member'
);

SELECT ok(
  public.is_user_group_member(
    '77777777-7777-4777-8777-777777777777',
    '55555555-5555-4555-8555-555555555555'
  ),
  'hidden member remains a group member'
);

SELECT ok(
  public.is_user_group_member(
    '77777777-7777-4777-8777-777777777777',
    '11111111-1111-4111-8111-111111111111'
  ),
  'left creator remains a group member'
);

SELECT ok(
  NOT public.is_user_group_member(
    '77777777-7777-4777-8777-777777777777',
    '66666666-6666-4666-8666-666666666666'
  ),
  'outsider is not a group member'
);

SELECT ok(
  NOT public.is_user_group_owner(
    '77777777-7777-4777-8777-777777777777',
    '22222222-2222-4222-8222-222222222222'
  ),
  'active non-owner is not a group owner'
);

SELECT ok(
  NOT public.is_user_group_owner(
    '77777777-7777-4777-8777-777777777777',
    '33333333-3333-4333-8333-333333333333'
  ),
  'left owner who did not create the group is not an owner'
);

SELECT ok(
  public.is_user_group_owner(
    '77777777-7777-4777-8777-777777777777',
    '44444444-4444-4444-8444-444444444444'
  ),
  'archived active owner is still an owner'
);

SELECT ok(
  public.is_user_group_owner(
    '77777777-7777-4777-8777-777777777777',
    '11111111-1111-4111-8111-111111111111'
  ),
  'creator remains an owner after leaving'
);

SELECT ok(
  NOT public.is_user_group_owner(
    '77777777-7777-4777-8777-777777777777',
    '66666666-6666-4666-8666-666666666666'
  ),
  'outsider is not a group owner'
);

SELECT ok(
  NOT public.is_user_group_owner(
    '77777777-7777-4777-8777-777777777777',
    '55555555-5555-4555-8555-555555555555'
  ),
  'hidden non-owner is not a group owner'
);

SELECT ok(
  public.is_user_active_group_member(
    '77777777-7777-4777-8777-777777777777',
    '22222222-2222-4222-8222-222222222222'
  ),
  'active member is an active member'
);

SELECT ok(
  NOT public.is_user_active_group_member(
    '77777777-7777-4777-8777-777777777777',
    '33333333-3333-4333-8333-333333333333'
  ),
  'left non-creator is not an active member'
);

SELECT ok(
  public.is_user_active_group_member(
    '77777777-7777-4777-8777-777777777777',
    '44444444-4444-4444-8444-444444444444'
  ),
  'archived membership stays active'
);

SELECT ok(
  public.is_user_active_group_member(
    '77777777-7777-4777-8777-777777777777',
    '55555555-5555-4555-8555-555555555555'
  ),
  'hidden active membership stays active'
);

SELECT ok(
  public.is_user_active_group_member(
    '77777777-7777-4777-8777-777777777777',
    '11111111-1111-4111-8111-111111111111'
  ),
  'creator remains an active member after leaving'
);

SELECT ok(
  NOT public.is_user_active_group_member(
    '77777777-7777-4777-8777-777777777777',
    '66666666-6666-4666-8666-666666666666'
  ),
  'outsider is not an active member'
);

SELECT throws_ok(
  $$INSERT INTO public.group_members (group_id, user_id, role, status)
    VALUES (
      '77777777-7777-4777-8777-777777777777',
      '66666666-6666-4666-8666-666666666666',
      'member',
      'pending'
    )$$,
  '23514',
  'new row for relation "group_members" violates check constraint "group_members_status_check"',
  'group_members.status rejects pending'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.is_user_group_member(
    '77777777-7777-4777-8777-777777777777'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  )$$,
  '42501',
  'permission denied for function is_user_group_member',
  'anon cannot call is_user_group_member'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.create_group('Denied group', NULL)$$,
  'P0001',
  'User not authenticated',
  'create_group rejects a caller without auth.uid()'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.create_group('Created group', 'from helper')$$,
  'authenticated user can create a group'
);
RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.groups g
    JOIN public.group_members gm ON gm.group_id = g.id
    WHERE g.name = 'Created group'
      AND g.description = 'from helper'
      AND g.created_by = '11111111-1111-4111-8111-111111111111'
      AND gm.user_id = '11111111-1111-4111-8111-111111111111'
      AND gm.role = 'owner'
      AND gm.status = 'active'
      AND gm.archived_at IS NULL
      AND gm.hidden_at IS NULL
  ),
  'create_group stores the creator as an active owner'
);

CREATE TEMP TABLE group_members (
  group_id uuid,
  user_id uuid,
  role text,
  status text
);

INSERT INTO pg_temp.group_members (group_id, user_id, role, status)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  '66666666-6666-4666-8666-666666666666',
  'owner',
  'active'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM group_members
    WHERE user_id = '66666666-6666-4666-8666-666666666666'
  ),
  'unqualified group_members resolves to the pg_temp shadow'
);

SELECT ok(
  NOT public.is_user_group_member(
    '77777777-7777-4777-8777-777777777777',
    '66666666-6666-4666-8666-666666666666'
  ),
  'schema-qualified member helper ignores a pg_temp shadow'
);

SELECT ok(
  public.is_user_group_member(
    '77777777-7777-4777-8777-777777777777',
    '22222222-2222-4222-8222-222222222222'
  ),
  'schema-qualified member helper still reads the real active member'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_invitations'
      AND policyname = 'Group members can create invitations'
      AND (
        with_check ILIKE '%is_user_active_group_member%'
        OR qual ILIKE '%is_user_active_group_member%'
      )
  )
  AND EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_exchange_rates'
      AND policyname = 'Members can view group exchange rates'
      AND qual ILIKE '%is_user_group_member%'
  ),
  'existing RLS policies still call the helpers'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.groups'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.group_members'::regclass),
  'groups and group_members still enforce RLS'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'add_group_creator_trigger'
      AND tgrelid = 'public.groups'::regclass
      AND NOT tgisinternal
  ),
  'group creator trigger is unchanged'
);

SELECT * FROM finish();
ROLLBACK;
