BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'owner@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'member@example.com'),
  ('33333333-3333-4333-8333-333333333333', 'outsider@example.com');

INSERT INTO public.groups (id, name, created_by)
VALUES (
  '44444444-4444-4444-8444-444444444444',
  'Flat 4B',
  '11111111-1111-4111-8111-111111111111'
);

SELECT is(
  (
    SELECT default_split_mode
    FROM public.groups
    WHERE id = '44444444-4444-4444-8444-444444444444'
  ),
  'equal',
  'a new group defaults to an equal split'
);

SELECT is(
  (
    SELECT default_split_weights
    FROM public.groups
    WHERE id = '44444444-4444-4444-8444-444444444444'
  ),
  '{}'::jsonb,
  'a new group stores no per-member weights'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.update_group_default_split(uuid, text, jsonb)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.update_group_default_split(uuid, text, jsonb)',
    'EXECUTE'
  ),
  'only signed-in users can update a group default split'
);

INSERT INTO public.participants (id, group_id, user_id, type, role, full_name)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'member',
    'owner',
    'Aisha'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'member',
    'member',
    'Dev'
  );

INSERT INTO public.group_members (group_id, user_id, role, status)
VALUES
  (
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'owner',
    'active'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'member',
    'active'
  );

INSERT INTO public.transactions (
  id,
  amount,
  description,
  date,
  type,
  currency,
  user_id,
  paid_by_participant_id,
  group_id
)
VALUES (
  910418,
  900.00,
  'Friday dinner',
  CURRENT_DATE,
  'expense',
  'INR',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '44444444-4444-4444-8444-444444444444'
);

INSERT INTO public.transaction_splits (transaction_id, participant_id, amount)
VALUES
  (910418, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 450.00),
  (910418, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 450.00);

CREATE TEMP TABLE default_split_expense_before AS
SELECT
  t.amount AS expense_amount,
  t.description AS expense_description,
  t.updated_at AS expense_updated_at,
  (
    SELECT count(*)
    FROM public.transaction_history h
    WHERE h.transaction_id = t.id
  ) AS history_count,
  (
    SELECT count(*) FROM public.transactions
  ) AS transaction_count,
  (
    SELECT array_agg(s.participant_id::text || ':' || s.amount::text ORDER BY s.participant_id)
    FROM public.transaction_splits s
    WHERE s.transaction_id = t.id
  ) AS split_rows
FROM public.transactions t
WHERE t.id = 910418;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$SELECT public.update_group_default_split(
    '44444444-4444-4444-8444-444444444444'::uuid,
    'weights',
    '{"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1": 2, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2": 1}'::jsonb
  )$$,
  'an active member can save per-member weights'
);

RESET ROLE;

SELECT is(
  (
    SELECT default_split_mode = 'weights'
      AND default_split_weights = '{"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1": 2, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2": 1}'::jsonb
    FROM public.groups
    WHERE id = '44444444-4444-4444-8444-444444444444'
  ),
  true,
  'the group stores the weights default'
);

SELECT ok(
  (
    SELECT t.amount = snap.expense_amount
      AND t.description = snap.expense_description
      AND t.updated_at IS NOT DISTINCT FROM snap.expense_updated_at
      AND (
        SELECT count(*)
        FROM public.transaction_history h
        WHERE h.transaction_id = t.id
      ) = snap.history_count
      AND (SELECT count(*) FROM public.transactions) = snap.transaction_count
      AND (
        SELECT array_agg(s.participant_id::text || ':' || s.amount::text ORDER BY s.participant_id)
        FROM public.transaction_splits s
        WHERE s.transaction_id = t.id
      ) = snap.split_rows
    FROM public.transactions t
    CROSS JOIN default_split_expense_before snap
    WHERE t.id = 910418
  ),
  'changing the default to weights does not rewrite the earlier expense'
);

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$SELECT public.update_group_default_split(
    '44444444-4444-4444-8444-444444444444'::uuid,
    'equal',
    '{}'::jsonb
  )$$,
  'an active member can switch the default back to equal'
);

RESET ROLE;

SELECT ok(
  (
    SELECT t.amount = snap.expense_amount
      AND t.description = snap.expense_description
      AND t.updated_at IS NOT DISTINCT FROM snap.expense_updated_at
      AND (
        SELECT array_agg(s.participant_id::text || ':' || s.amount::text ORDER BY s.participant_id)
        FROM public.transaction_splits s
        WHERE s.transaction_id = t.id
      ) = snap.split_rows
    FROM public.transactions t
    CROSS JOIN default_split_expense_before snap
    WHERE t.id = 910418
  ),
  'switching the default back to equal still leaves the earlier expense unchanged'
);

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT public.update_group_default_split(
    '44444444-4444-4444-8444-444444444444'::uuid,
    'weights',
    '{}'::jsonb
  )$$,
  'P0001',
  'Not an active group member',
  'someone outside the group cannot change the default'
);

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

SELECT throws_ok(
  $$SELECT public.update_group_default_split(
    '44444444-4444-4444-8444-444444444444'::uuid,
    'weights',
    '{"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1": 1.5}'::jsonb
  )$$,
  'P0001',
  'Each weight must be an integer from 1 to 99',
  'fractional weights are rejected'
);

SELECT throws_ok(
  $$SELECT public.update_group_default_split(
    '44444444-4444-4444-8444-444444444444'::uuid,
    'weights',
    '{"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb": 2}'::jsonb
  )$$,
  'P0001',
  'Each weight must name a person in this group',
  'a weight for someone outside the group is rejected'
);

SELECT throws_ok(
  $$SELECT public.update_group_default_split(
    '44444444-4444-4444-8444-444444444444'::uuid,
    'percent',
    '{}'::jsonb
  )$$,
  'P0001',
  'default_split_mode must be equal or weights',
  'only equal and weights are stored'
);

SELECT * FROM finish();
ROLLBACK;
