BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(35);

SELECT has_table('public', 'user_last_seen_apps', 'last-seen app versions are stored per user');
SELECT has_column('public', 'user_last_seen_apps', 'user_id', 'last-seen rows belong to one user');
SELECT has_column('public', 'user_last_seen_apps', 'app_version', 'last-seen rows store the app version');
SELECT has_column('public', 'user_last_seen_apps', 'platform', 'last-seen rows store platform when known');
SELECT has_column('public', 'user_last_seen_apps', 'seen_at', 'last-seen rows store when the version was recorded');

SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.user_last_seen_apps'::regclass
  ),
  'last-seen app versions have row level security'
);

SELECT has_function(
  'public',
  'record_last_seen_app',
  ARRAY['text', 'text'],
  'record_last_seen_app(text, text) exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc AS proc
    JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND proc.proname = 'record_last_seen_app'
      AND pg_get_function_identity_arguments(proc.oid) = 'p_app_version text, p_platform text'
      AND NOT proc.prosecdef
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(proc.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg = 'search_path=public, pg_temp'
      )
  ),
  'record_last_seen_app is security invoker with search_path pinned'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.user_last_seen_apps', 'SELECT'),
  'anonymous users cannot read last-seen app versions'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.user_last_seen_apps', 'INSERT'),
  'anonymous users cannot insert last-seen app versions'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.user_last_seen_apps', 'SELECT'),
  'authenticated users can select their own last-seen row'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.user_last_seen_apps', 'INSERT'),
  'authenticated users can insert their own last-seen row'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.user_last_seen_apps', 'UPDATE'),
  'authenticated users can update their own last-seen row'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_last_seen_apps', 'DELETE'),
  'authenticated users cannot delete last-seen rows'
);
SELECT ok(
  has_table_privilege('service_role', 'public.user_last_seen_apps', 'SELECT'),
  'the reminder job can read last-seen app versions'
);

INSERT INTO auth.users (id, email)
VALUES
  ('a4850001-0000-4000-8000-000000000001', 'last-seen-485-a@example.com'),
  ('a4850002-0000-4000-8000-000000000002', 'last-seen-485-b@example.com');

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.record_last_seen_app('2.30.6', 'ios') $$,
  '42501',
  'permission denied for function record_last_seen_app',
  'anonymous users cannot record a last-seen app version'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4850001-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT lives_ok(
  $$ SELECT public.record_last_seen_app('2.30.6', 'android') $$,
  'an authenticated user can record their own last-seen version'
);
RESET ROLE;

SELECT is(
  (
    SELECT app_version
    FROM public.user_last_seen_apps
    WHERE user_id = 'a4850001-0000-4000-8000-000000000001'
  ),
  '2.30.6',
  'the recorded version is stored for that user'
);
SELECT is(
  (
    SELECT platform
    FROM public.user_last_seen_apps
    WHERE user_id = 'a4850001-0000-4000-8000-000000000001'
  ),
  'android',
  'a known platform is stored with the version'
);

UPDATE public.user_last_seen_apps
SET seen_at = '2020-01-01T00:00:00Z'
WHERE user_id = 'a4850001-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4850001-0000-4000-8000-000000000001', true);
SELECT lives_ok(
  $$ SELECT public.record_last_seen_app('not-a-version', 'ios') $$,
  'an unparseable version does not raise'
);
SELECT lives_ok(
  $$ SELECT public.record_last_seen_app(NULL, 'ios') $$,
  'a missing version does not raise'
);
SELECT lives_ok(
  $$ SELECT public.record_last_seen_app('2.30.6', NULL) $$,
  'recording the same version with an unknown platform does not raise'
);
RESET ROLE;

SELECT is(
  (
    SELECT app_version
    FROM public.user_last_seen_apps
    WHERE user_id = 'a4850001-0000-4000-8000-000000000001'
  ),
  '2.30.6',
  'unparseable and missing versions do not replace the stored version'
);
SELECT is(
  (
    SELECT platform
    FROM public.user_last_seen_apps
    WHERE user_id = 'a4850001-0000-4000-8000-000000000001'
  ),
  'android',
  'an unknown platform does not clear a known platform'
);
SELECT is(
  (
    SELECT seen_at
    FROM public.user_last_seen_apps
    WHERE user_id = 'a4850001-0000-4000-8000-000000000001'
  ),
  '2020-01-01T00:00:00Z'::timestamptz,
  'an unchanged version does not rewrite the row'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4850001-0000-4000-8000-000000000001', true);
SELECT lives_ok(
  $$ SELECT public.record_last_seen_app('2.45.9', NULL) $$,
  'a newer version can be recorded without a platform'
);
RESET ROLE;

SELECT is(
  (
    SELECT app_version
    FROM public.user_last_seen_apps
    WHERE user_id = 'a4850001-0000-4000-8000-000000000001'
  ),
  '2.45.9',
  'a changed version replaces the stored version'
);
SELECT is(
  (
    SELECT platform
    FROM public.user_last_seen_apps
    WHERE user_id = 'a4850001-0000-4000-8000-000000000001'
  ),
  'android',
  'a version change without a platform keeps the known platform'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a4850002-0000-4000-8000-000000000002', true);
SELECT is(
  (SELECT count(*)::integer FROM public.user_last_seen_apps),
  0,
  'a user cannot read another user last-seen app version'
);
SELECT throws_ok(
  $$
    INSERT INTO public.user_last_seen_apps (user_id, app_version)
    VALUES ('a4850001-0000-4000-8000-000000000001', '9.9.9')
  $$,
  '42501',
  'new row violates row-level security policy for table "user_last_seen_apps"',
  'a user cannot store a last-seen version for someone else'
);
SELECT lives_ok(
  $$ SELECT public.record_last_seen_app('2.10.0', 'ios') $$,
  'a second user records only their own row'
);
SELECT throws_ok(
  $$
    UPDATE public.user_last_seen_apps
    SET app_version = 'nope'
    WHERE user_id = 'a4850002-0000-4000-8000-000000000002'
  $$,
  '23514',
  'new row for relation "user_last_seen_apps" violates check constraint "user_last_seen_apps_app_version_semver"',
  'stored versions must be parseable x.y.z'
);
RESET ROLE;

SELECT is(
  (SELECT count(*)::integer FROM public.user_last_seen_apps),
  2,
  'each user has their own last-seen row'
);
SELECT is(
  (
    SELECT app_version
    FROM public.user_last_seen_apps
    WHERE user_id = 'a4850001-0000-4000-8000-000000000001'
  ),
  '2.45.9',
  'another user cannot replace the first user version'
);
SELECT is(
  (
    SELECT app_version
    FROM public.user_last_seen_apps
    WHERE user_id = 'a4850002-0000-4000-8000-000000000002'
  ),
  '2.10.0',
  'the second user version is stored separately'
);

SELECT * FROM finish();
ROLLBACK;
