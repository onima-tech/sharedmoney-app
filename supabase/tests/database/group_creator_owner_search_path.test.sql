BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(22);

INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'creator@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'outsider@example.com');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE p.proname = 'add_group_creator_as_owner'
      AND pg_get_function_identity_arguments(p.oid) = ''
      AND p.prosecdef
      AND p.provolatile = 'v'
      AND r.rolname = 'postgres'
      AND (r.rolsuper OR r.rolbypassrls)
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg = 'search_path=public, pg_temp'
      )
      AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO public.group_members%'
      AND pg_get_functiondef(p.oid) LIKE '%ON CONFLICT (group_id, user_id) DO NOTHING%'
      AND pg_get_functiondef(p.oid) LIKE '%RETURN NEW%'
  ),
  'creator trigger function is security definer, qualified, and pins search_path'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'add_group_creator_as_owner'
  ),
  1::bigint,
  'creator trigger function has one public overload'
);

SELECT is(
  (
    SELECT p.proacl::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'add_group_creator_as_owner'
  ),
  '{postgres=X/postgres,service_role=X/postgres}',
  'creator trigger grants stay limited to postgres and service_role'
);

SELECT is_empty(
  $$
    SELECT role_name
    FROM unnest(ARRAY['anon', 'public', 'authenticated']) AS roles(role_name)
    WHERE has_function_privilege(
      role_name,
      'public.add_group_creator_as_owner()'::regprocedure,
      'EXECUTE'
    )
  $$,
  'anon, PUBLIC, and authenticated cannot execute the creator trigger function'
);

SELECT is_empty(
  $$
    SELECT role_name
    FROM unnest(ARRAY['postgres', 'service_role']) AS roles(role_name)
    WHERE NOT has_function_privilege(
      role_name,
      'public.add_group_creator_as_owner()'::regprocedure,
      'EXECUTE'
    )
  $$,
  'postgres and service_role still can execute the creator trigger function'
);

SELECT is(
  (
    SELECT pg_get_triggerdef(t.oid)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'groups'
      AND t.tgname = 'add_group_creator_trigger'
      AND NOT t.tgisinternal
  ),
  'CREATE TRIGGER add_group_creator_trigger AFTER INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION add_group_creator_as_owner()',
  'creator trigger stays AFTER INSERT and calls the same function'
);

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.create_group('Created via rpc', 'rpc')$$,
  'signed-in user can create a group'
);
RESET ROLE;

SELECT ok(
  (
    SELECT count(*) = 1
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE g.name = 'Created via rpc'
      AND g.description = 'rpc'
      AND g.created_by = '11111111-1111-4111-8111-111111111111'
      AND gm.user_id = '11111111-1111-4111-8111-111111111111'
      AND gm.role = 'owner'
      AND gm.status = 'active'
      AND gm.archived_at IS NULL
      AND gm.hidden_at IS NULL
  ),
  'create_group stores one active owner membership'
);

SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO public.groups (id, name, created_by)
    VALUES (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'Created via insert',
      '11111111-1111-4111-8111-111111111111'
    )$$,
  'signed-in user can insert a group directly'
);
RESET ROLE;

SELECT ok(
  (
    SELECT count(*) = 1
    FROM public.group_members
    WHERE group_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
      AND user_id = '11111111-1111-4111-8111-111111111111'
      AND role = 'owner'
      AND status = 'active'
  ),
  'direct insert stores one active owner membership'
);

SET LOCAL ROLE authenticated;
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.groups
    WHERE name = 'Created via rpc'
  ),
  'creator can read the group under RLS'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE g.name = 'Created via rpc'
      AND gm.user_id = '11111111-1111-4111-8111-111111111111'
      AND gm.role = 'owner'
      AND gm.status = 'active'
  ),
  'creator can read the owner membership under RLS'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SET LOCAL ROLE authenticated;
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.groups
    WHERE name = 'Created via rpc'
  ),
  'outsider cannot read the group under RLS'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE g.name = 'Created via rpc'
  ),
  'outsider cannot read the membership under RLS'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
CREATE TEMP TABLE group_members (
  group_id uuid,
  user_id uuid,
  role varchar,
  UNIQUE (group_id, user_id)
);
SELECT set_config('search_path', 'pg_temp, public, extensions', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.create_group('Shadow rpc', 'shadow')$$,
  'create_group succeeds while a temp group_members shadow exists'
);
RESET ROLE;

SELECT ok(
  (SELECT count(*) FROM pg_temp.group_members) = 0,
  'creator trigger does not insert into the temp shadow'
);
SELECT ok(
  (
    SELECT count(*) = 1
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE g.name = 'Shadow rpc'
      AND gm.user_id = '11111111-1111-4111-8111-111111111111'
      AND gm.role = 'owner'
      AND gm.status = 'active'
  ),
  'creator trigger still inserts the public owner row'
);

DROP TABLE pg_temp.group_members;
CREATE TEMP TABLE group_members (
  group_id uuid,
  user_id uuid,
  role varchar
);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO public.groups (id, name, created_by)
    VALUES (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'Shadow insert',
      '11111111-1111-4111-8111-111111111111'
    )$$,
  'direct insert succeeds when the temp shadow has no unique constraint'
);
RESET ROLE;

SELECT ok(
  (SELECT count(*) FROM pg_temp.group_members) = 0,
  'direct insert does not write the unconstrained temp shadow'
);
SELECT ok(
  (
    SELECT count(*) = 1
    FROM public.group_members
    WHERE group_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
      AND user_id = '11111111-1111-4111-8111-111111111111'
      AND role = 'owner'
      AND status = 'active'
  ),
  'direct insert still stores one public owner membership'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.add_group_creator_as_owner()$$,
  '42501',
  'permission denied for function add_group_creator_as_owner',
  'anon cannot call the creator trigger function'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.add_group_creator_as_owner()$$,
  '42501',
  'permission denied for function add_group_creator_as_owner',
  'authenticated cannot call the creator trigger function directly'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
