import { loadBatchProfiles } from './batch-profiles.ts';

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected, null, 2)}, got ${JSON.stringify(actual, null, 2)}`,
    );
  }
}

const viewer = '11111111-1111-4111-8111-111111111111';
const coMember = '22222222-2222-4222-8222-222222222222';
const archivedCoMember = '33333333-3333-4333-8333-333333333333';
const former = '44444444-4444-4444-8444-444444444444';
const stranger = '55555555-5555-4555-8555-555555555555';

type Row = Record<string, unknown>;
type Filter =
  | { type: 'eq'; col: string; val: unknown }
  | { type: 'in'; col: string; val: unknown[] };

/**
 * In-memory PostgREST builder. Records every filter so a test can see
 * which ids were sent to profiles and group_members.
 */
function createFakeSupabase(tables: Record<string, Row[]>) {
  const calls: Array<{ table: string; filters: Filter[] }> = [];

  const from = (table: string) => {
    const filters: Filter[] = [];
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    builder.select = () => self();
    builder.eq = (col: string, val: unknown) => {
      filters.push({ type: 'eq', col, val });
      return self();
    };
    builder.in = (col: string, val: readonly unknown[]) => {
      filters.push({ type: 'in', col, val: [...val] });
      return self();
    };
    builder.then = (
      onFulfilled?: (value: { data: Row[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      const snapshot = filters.map((filter) => ({ ...filter }));
      calls.push({ table, filters: snapshot });
      const data = (tables[table] ?? []).filter((row) =>
        snapshot.every((filter) => {
          if (filter.type === 'eq') return row[filter.col] === filter.val;
          return filter.val.includes(row[filter.col]);
        })
      );
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
    };
    return builder;
  };

  return { calls, from };
}

function profileSelectIds(calls: Array<{ table: string; filters: Filter[] }>): string[][] {
  return calls
    .filter((call) => call.table === 'profiles')
    .map((call) => {
      const match = call.filters.find((filter) => filter.type === 'in' && filter.col === 'id');
      return (match && match.type === 'in' ? match.val : []) as string[];
    });
}

function membershipFixture(): Record<string, Row[]> {
  return {
    // Archive is archived_at, not a status. Left members are status = 'left'.
    group_members: [
      { user_id: viewer, group_id: 'g-active', status: 'active' },
      { user_id: coMember, group_id: 'g-active', status: 'active' },
      { user_id: viewer, group_id: 'g-archived', status: 'active', archived_at: '2026-09-15T00:00:00Z' },
      { user_id: archivedCoMember, group_id: 'g-archived', status: 'active', archived_at: '2026-09-15T00:00:00Z' },
      { user_id: viewer, group_id: 'g-left', status: 'active' },
      { user_id: former, group_id: 'g-left', status: 'left' },
    ],
    profiles: [
      profileRow(coMember, 'Co Member', '+15550001111', 'co@okbank'),
      profileRow(archivedCoMember, 'Archived Co Member', '+15550002222', 'archived@okbank'),
      profileRow(former, 'Former Member', '+14440003333', 'former@okbank'),
      profileRow(stranger, 'Stranger', '+19990002222', 'stranger@okbank'),
      profileRow(viewer, 'Viewer', '+15550004444', 'viewer@okbank'),
    ],
  };
}

function profileRow(id: string, fullName: string, phone: string, upiId: string): Row {
  return {
    id,
    full_name: fullName,
    avatar_url: null,
    phone,
    country_code: 'US',
    profile_completed: true,
    upi_id: upiId,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

const emails: Record<string, string> = {
  [viewer]: 'me@example.com',
  [coMember]: 'ada@example.com',
  [archivedCoMember]: 'archived@example.com',
  [former]: 'former@example.com',
  [stranger]: 'stranger@example.com',
};

Deno.test('batch profile read omits people who are not active co-members', async () => {
  const supabase = createFakeSupabase(membershipFixture());
  const emailCalls: string[][] = [];
  const fetchEmails = (ids: string[]) => {
    emailCalls.push([...ids]);
    const map = new Map<string, string>();
    for (const id of ids) {
      const email = emails[id];
      if (email) map.set(id, email);
    }
    return Promise.resolve(map);
  };

  const result = await loadBatchProfiles(
    supabase as never,
    viewer,
    'me@example.com',
    [stranger, coMember, former, archivedCoMember, viewer],
    fetchEmails,
  );

  assertEquals(result.error, null);
  assertEquals({
    profiles: result.profiles.map((profile) => ({
      id: profile.id,
      full_name: profile.full_name,
      phone: profile.phone,
      email: profile.email,
    })),
    profileSelectIds: profileSelectIds(supabase.calls),
    emailLookupIds: emailCalls,
  }, {
    profiles: [
      { id: coMember, full_name: 'Co Member', phone: '+15550001111', email: 'ada@example.com' },
      { id: archivedCoMember, full_name: 'Archived Co Member', phone: '+15550002222', email: 'archived@example.com' },
      { id: viewer, full_name: 'Viewer', phone: '+15550004444', email: 'me@example.com' },
    ],
    profileSelectIds: [[coMember, archivedCoMember, viewer]],
    emailLookupIds: [[coMember, archivedCoMember, viewer]],
  });
  assertEquals(result.profiles.map((profile) => profile.upi_id), [
    'co@okbank',
    'archived@okbank',
    'viewer@okbank',
  ]);
});

Deno.test('requesting only a non-co-member does not select profiles or look up emails', async () => {
  const supabase = createFakeSupabase(membershipFixture());
  const emailCalls: string[][] = [];

  const result = await loadBatchProfiles(
    supabase as never,
    viewer,
    'me@example.com',
    [stranger],
    (ids) => {
      emailCalls.push([...ids]);
      return Promise.resolve(new Map());
    },
  );

  assertEquals(result.error, null);
  assertEquals(result.profiles, []);
  assertEquals(profileSelectIds(supabase.calls), []);
  assertEquals(emailCalls, []);
  assertEquals(JSON.stringify(result).includes('Stranger'), false);
  assertEquals(JSON.stringify(result).includes('stranger@example.com'), false);
  assertEquals(JSON.stringify(result).includes('+19990002222'), false);
});
