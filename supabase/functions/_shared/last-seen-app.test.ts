import {
  aggregateMonthlyReminderEmails,
  UPDATE_NUDGE_SENTENCE,
  UPDATE_NUDGE_UTM_CAMPAIGN,
} from './monthly-reminders.ts';
import {
  APP_PLATFORM_HEADER,
  APP_VERSION_HEADER,
  LAST_SEEN_APP_RPC,
  LAST_SEEN_USER_CHUNK,
  LAST_SEEN_WRITE_CACHE_TTL_MS,
  lastSeenByUserIdFromRows,
  lastSeenForPushRegistration,
  loadLastSeenByUserId,
  parseLastSeenAppHeaders,
  persistLastSeenApp,
  recordLastSeenAppFromRequest,
  resetLastSeenAppWriteCache,
  type LastSeenReader,
  type StoredLastSeenAppRow,
} from './last-seen-app.ts';

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected, null, 2)}, got ${JSON.stringify(actual, null, 2)}`,
    );
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

interface RpcCall {
  fn: string;
  args: { p_app_version: string; p_platform: 'ios' | 'android' | null };
}

function writer(calls: RpcCall[], error: unknown = null, throwOnCall = false) {
  return {
    rpc(fn: string, args: RpcCall['args']) {
      if (throwOnCall) return Promise.reject(new Error('network down'));
      calls.push({ fn, args });
      return Promise.resolve({ error });
    },
  };
}

function headers(version: string | null, platform?: string | null): Headers {
  const result = new Headers();
  if (version !== null) result.set(APP_VERSION_HEADER, version);
  if (platform) result.set(APP_PLATFORM_HEADER, platform);
  return result;
}

function reader(options: {
  rows: StoredLastSeenAppRow[];
  error?: unknown;
  throwOnRead?: boolean;
  chunks?: string[][];
}): LastSeenReader {
  return {
    from(table: string) {
      if (table !== 'user_last_seen_apps') throw new Error(`unexpected table ${table}`);
      return {
        select(columns: string) {
          if (columns !== 'user_id, app_version, platform') {
            throw new Error(`unexpected columns ${columns}`);
          }
          return {
            in(_column: string, values: readonly string[]) {
              options.chunks?.push([...values]);
              if (options.throwOnRead) return Promise.reject(new Error('read failed'));
              const data = options.error
                ? null
                : options.rows.filter((row) => values.includes(row.user_id));
              return Promise.resolve({ data, error: options.error ?? null });
            },
          };
        },
      };
    },
  };
}

const nudgeEdge = {
  group_id: 'group-1',
  group_name: 'Trip',
  from_participant_id: 'alice-participant',
  from_user_id: 'alice-user',
  from_email: 'alice@example.com',
  from_name: 'Alice',
  to_participant_id: 'bob-participant',
  to_user_id: 'bob-user',
  to_email: 'bob@example.com',
  to_name: 'Bob',
  amount: 12.5,
  currency: 'USD',
};

Deno.test('parseable X-App-Version is written for the authenticated user', async () => {
  resetLastSeenAppWriteCache();
  const calls: RpcCall[] = [];
  const request = new Request('https://sharedmoney.app/functions/v1/groups', {
    headers: headers('  2.30.6  ', ' Android '),
  });

  await recordLastSeenAppFromRequest(writer(calls), 'alice-user', request);

  assertEquals(calls, [{
    fn: LAST_SEEN_APP_RPC,
    args: { p_app_version: '2.30.6', p_platform: 'android' },
  }]);
});

Deno.test('missing, unparseable, and repeated versions do not write again', async () => {
  resetLastSeenAppWriteCache();
  const calls: RpcCall[] = [];
  const client = writer(calls);

  assertEquals(parseLastSeenAppHeaders(headers(null)), null);
  assertEquals(parseLastSeenAppHeaders(headers('2.46')), null);
  assertEquals(parseLastSeenAppHeaders(headers('v2.30.6', 'ios')), null);
  assertEquals(parseLastSeenAppHeaders(headers('   ', 'ios')), null);

  await recordLastSeenAppFromRequest(
    client,
    'alice-user',
    new Request('https://sharedmoney.app', { headers: headers(null) }),
  );
  await recordLastSeenAppFromRequest(
    client,
    'alice-user',
    new Request('https://sharedmoney.app', { headers: headers('2.46', 'ios') }),
  );
  await persistLastSeenApp(client, 'alice-user', { appVersion: 'nope', platform: 'ios' });
  assertEquals(calls, []);

  await persistLastSeenApp(client, 'alice-user', { appVersion: '2.30.6', platform: null }, 0);
  await persistLastSeenApp(
    client,
    'alice-user',
    { appVersion: '2.30.6', platform: null },
    LAST_SEEN_WRITE_CACHE_TTL_MS - 1,
  );
  assertEquals(calls.length, 1);
  assertEquals(calls[0].args.p_platform, null);

  await persistLastSeenApp(
    client,
    'alice-user',
    { appVersion: '2.45.9', platform: 'ios' },
    LAST_SEEN_WRITE_CACHE_TTL_MS,
  );
  assertEquals(calls.length, 2);
  assertEquals(calls[1].args, { p_app_version: '2.45.9', p_platform: 'ios' });

  await persistLastSeenApp(client, 'bob-user', { appVersion: '2.30.6', platform: null }, 0);
  assertEquals(calls.length, 3);
});

Deno.test('a failed last-seen write is not cached and does not throw', async () => {
  resetLastSeenAppWriteCache();
  const calls: RpcCall[] = [];
  await persistLastSeenApp(
    writer(calls, { message: 'relation does not exist' }),
    'alice-user',
    { appVersion: '2.30.6', platform: 'ios' },
    0,
  );
  await persistLastSeenApp(writer(calls), 'alice-user', { appVersion: '2.30.6', platform: 'ios' }, 1);
  assertEquals(calls.length, 2);

  resetLastSeenAppWriteCache();
  const thrown: RpcCall[] = [];
  await persistLastSeenApp(
    writer(thrown, null, true),
    'alice-user',
    { appVersion: '2.30.6', platform: 'android' },
    0,
  );
  await persistLastSeenApp(
    writer(thrown),
    'alice-user',
    { appVersion: '2.30.6', platform: 'android' },
    1,
  );
  assertEquals(thrown.length, 1);
});

Deno.test('push registration stores the device platform with the request version', () => {
  const registered = lastSeenForPushRegistration(headers('2.32.0', 'ios'), 'android');
  assertEquals(registered, { appVersion: '2.32.0', platform: 'android' });
  assertEquals(lastSeenForPushRegistration(headers('2.32.0'), 'web'), null);
  assertEquals(lastSeenForPushRegistration(headers('nope'), 'ios'), null);
  assertEquals(lastSeenForPushRegistration(headers(null), 'ios'), null);
});

Deno.test('stored rows become lastSeenByUserId and gate the update line', async () => {
  const rows: StoredLastSeenAppRow[] = [
    { user_id: 'alice-user', app_version: '2.30.6', platform: 'android' },
    { user_id: 'bob-user', app_version: '2.46.0', platform: 'ios' },
    { user_id: 'dave-user', app_version: '2.46', platform: 'android' },
    { user_id: 'erin-user', app_version: null, platform: 'ios' },
    { user_id: 'frank-user', app_version: '2.45.9', platform: 'web' },
    { user_id: '  ', app_version: '1.0.0', platform: 'ios' },
  ];
  const chunks: string[][] = [];
  const lastSeenByUserId = await loadLastSeenByUserId(
    reader({ rows, chunks }),
    ['alice-user', 'bob-user', 'dave-user', 'erin-user', 'frank-user', 'alice-user', ''],
  );

  assertEquals(chunks, [[
    'alice-user',
    'bob-user',
    'dave-user',
    'erin-user',
    'frank-user',
  ]]);
  assertEquals(lastSeenByUserId.get('alice-user'), { appVersion: '2.30.6', platform: 'android' });
  assertEquals(lastSeenByUserId.get('frank-user'), { appVersion: '2.45.9', platform: null });
  assertEquals(lastSeenByUserIdFromRows(rows).has(''), false);

  const emails = aggregateMonthlyReminderEmails({
    periodKey: '2026-08',
    appUrl: 'https://app.example.com',
    edges: [
      nudgeEdge,
      {
        ...nudgeEdge,
        from_user_id: 'dave-user',
        from_email: 'dave@example.com',
        to_user_id: 'erin-user',
        to_email: 'erin@example.com',
      },
      {
        ...nudgeEdge,
        from_user_id: 'frank-user',
        from_email: 'frank@example.com',
        to_user_id: 'cory-user',
        to_email: 'cory@example.com',
      },
    ],
    lastSeenByUserId,
  });

  const byUser = new Map(emails.map((email) => [email.user_id, email]));
  const alice = byUser.get('alice-user');
  if (!alice) throw new Error('missing alice reminder');
  assert(alice.text.includes(UPDATE_NUDGE_SENTENCE), 'alice below 2.46.0 gets the update line');
  assert(alice.text.includes(UPDATE_NUDGE_UTM_CAMPAIGN), 'alice store link keeps the update campaign');
  assert(alice.text.includes('play.google.com'), 'android last-seen uses Google Play');
  assert(!alice.text.includes('apps.apple.com'), 'android last-seen omits the App Store');

  const frank = byUser.get('frank-user');
  if (!frank) throw new Error('missing frank reminder');
  assert(frank.text.includes(UPDATE_NUDGE_SENTENCE), 'unknown platform still gets the line below 2.46.0');
  assert(frank.text.includes('play.google.com'), 'unknown platform includes Google Play');
  assert(frank.text.includes('apps.apple.com'), 'unknown platform includes the App Store');

  for (const userId of ['bob-user', 'dave-user', 'erin-user', 'cory-user']) {
    const email = byUser.get(userId);
    if (!email) throw new Error(`missing reminder for ${userId}`);
    assert(!email.text.includes(UPDATE_NUDGE_SENTENCE), `${userId} does not get the update line`);
    assert(!email.text.includes(UPDATE_NUDGE_UTM_CAMPAIGN), `${userId} does not get the campaign`);
  }
});

Deno.test('a last-seen read failure omits the update line', async () => {
  const lastSeenByUserId = await loadLastSeenByUserId(
    reader({ rows: [], error: { message: 'permission denied' } }),
    ['alice-user'],
  );
  assertEquals(lastSeenByUserId.size, 0);

  const thrown = await loadLastSeenByUserId(
    reader({ rows: [], throwOnRead: true }),
    ['alice-user'],
  );
  assertEquals(thrown.size, 0);
  assertEquals((await loadLastSeenByUserId(reader({ rows: [] }), [])).size, 0);

  const emails = aggregateMonthlyReminderEmails({
    periodKey: '2026-08',
    appUrl: 'https://app.example.com',
    edges: [nudgeEdge],
    lastSeenByUserId,
  });
  assert(!emails[0].text.includes(UPDATE_NUDGE_SENTENCE), 'read failure does not invent a version');
});

Deno.test('last-seen reads page user ids in chunks', async () => {
  const userIds = Array.from({ length: LAST_SEEN_USER_CHUNK + 1 }, (_unused, index) => `user-${index}`);
  const chunks: string[][] = [];
  const lastSeenByUserId = await loadLastSeenByUserId(
    reader({
      rows: [{ user_id: 'user-0', app_version: '2.1.0', platform: 'ios' }],
      chunks,
    }),
    userIds,
  );
  assertEquals(chunks.length, 2);
  assertEquals(chunks[0].length, LAST_SEEN_USER_CHUNK);
  assertEquals(chunks[1], [`user-${LAST_SEEN_USER_CHUNK}`]);
  assertEquals(lastSeenByUserId.get('user-0'), { appVersion: '2.1.0', platform: 'ios' });
});
