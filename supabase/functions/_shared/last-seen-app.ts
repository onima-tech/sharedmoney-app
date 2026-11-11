import { log } from './logger.ts';
import type { ReminderAppPlatform, ReminderLastSeenApp } from './monthly-reminders.ts';

export const APP_VERSION_HEADER = 'X-App-Version';
export const APP_PLATFORM_HEADER = 'X-App-Platform';
export const LAST_SEEN_APP_RPC = 'record_last_seen_app';
export const LAST_SEEN_USER_CHUNK = 200;
export const LAST_SEEN_WRITE_CACHE_TTL_MS = 15 * 60 * 1000;

const SEMVER = /^\d+\.\d+\.\d+$/;
const MAX_VERSION_LENGTH = 32;
const WRITE_CACHE_LIMIT = 5000;

const writeCache = new Map<string, number>();

export interface ParsedLastSeenApp {
  appVersion: string;
  platform: ReminderAppPlatform | null;
}

export interface StoredLastSeenAppRow {
  user_id: string;
  app_version: string | null;
  platform: string | null;
}

interface LastSeenWriter {
  rpc: (
    fn: string,
    args: { p_app_version: string; p_platform: ReminderAppPlatform | null },
  ) => PromiseLike<{ error: unknown }>;
}

interface LastSeenQuery {
  select: (columns: string) => {
    in: (
      column: string,
      values: readonly string[],
    ) => PromiseLike<{ data: StoredLastSeenAppRow[] | null; error: unknown }>;
  };
}

export interface LastSeenReader {
  from: (table: string) => LastSeenQuery;
}

export function resetLastSeenAppWriteCache(): void {
  writeCache.clear();
}

export function parseAppVersion(value: string | null | undefined): string | null {
  const version = value?.trim() ?? '';
  if (version.length < 5 || version.length > MAX_VERSION_LENGTH) return null;
  if (!SEMVER.test(version)) return null;
  return version;
}

export function parseAppPlatform(value: string | null | undefined): ReminderAppPlatform | null {
  const platform = value?.trim().toLowerCase() ?? '';
  if (platform === 'ios' || platform === 'android') return platform;
  return null;
}

/** Parseable X-App-Version, plus X-App-Platform when it is ios or android. */
export function parseLastSeenAppHeaders(headers: Headers): ParsedLastSeenApp | null {
  const appVersion = parseAppVersion(headers.get(APP_VERSION_HEADER));
  if (!appVersion) return null;
  return {
    appVersion,
    platform: parseAppPlatform(headers.get(APP_PLATFORM_HEADER)),
  };
}

/**
 * Push registration already knows the device platform. The version still has
 * to come from X-App-Version; a platform alone is not stored.
 */
export function lastSeenForPushRegistration(
  headers: Headers,
  platform: unknown,
): ParsedLastSeenApp | null {
  const parsed = parseLastSeenAppHeaders(headers);
  if (!parsed) return null;
  const devicePlatform = parseAppPlatform(typeof platform === 'string' ? platform : null);
  if (!devicePlatform) return null;
  return { appVersion: parsed.appVersion, platform: devicePlatform };
}

function writeCacheKey(userId: string, lastSeen: ParsedLastSeenApp): string {
  return `${userId}\0${lastSeen.appVersion}\0${lastSeen.platform ?? ''}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200);
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message.slice(0, 200);
  }
  return 'unknown error';
}

/**
 * Records a parseable version for the authenticated user. Identical repeats
 * on a warm isolate skip the database; a failed write is not cached.
 */
export async function persistLastSeenApp(
  supabase: LastSeenWriter,
  userId: string,
  lastSeen: ParsedLastSeenApp,
  now = Date.now(),
): Promise<void> {
  const appVersion = parseAppVersion(lastSeen.appVersion);
  if (!userId || !appVersion) return;
  const parsed: ParsedLastSeenApp = {
    appVersion,
    platform: parseAppPlatform(lastSeen.platform),
  };
  const key = writeCacheKey(userId, parsed);
  const cachedAt = writeCache.get(key);
  if (cachedAt !== undefined && now - cachedAt < LAST_SEEN_WRITE_CACHE_TTL_MS) return;

  try {
    const { error } = await supabase.rpc(LAST_SEEN_APP_RPC, {
      p_app_version: parsed.appVersion,
      p_platform: parsed.platform,
    });
    if (error) {
      log.warn('Failed to record last-seen app version', 'last-seen-app', {
        error: errorMessage(error),
      });
      return;
    }
  } catch (error) {
    log.warn('Failed to record last-seen app version', 'last-seen-app', {
      error: errorMessage(error),
    });
    return;
  }

  if (writeCache.size >= WRITE_CACHE_LIMIT) writeCache.clear();
  writeCache.set(key, now);
}

export async function recordLastSeenAppFromRequest(
  supabase: LastSeenWriter,
  userId: string,
  request: Request,
): Promise<void> {
  const parsed = parseLastSeenAppHeaders(request.headers);
  if (!parsed) return;
  await persistLastSeenApp(supabase, userId, parsed);
}

export function lastSeenByUserIdFromRows(
  rows: readonly StoredLastSeenAppRow[],
): Map<string, ReminderLastSeenApp> {
  const byUserId = new Map<string, ReminderLastSeenApp>();
  for (const row of rows) {
    const userId = row.user_id?.trim();
    if (!userId) continue;
    byUserId.set(userId, {
      appVersion: row.app_version,
      platform: parseAppPlatform(row.platform),
    });
  }
  return byUserId;
}

/**
 * Reads stored versions for the reminder job. A read failure returns an empty
 * map so balance emails still send and the update line stays omitted.
 */
export async function loadLastSeenByUserId(
  supabase: LastSeenReader,
  userIds: readonly string[],
): Promise<Map<string, ReminderLastSeenApp>> {
  const uniqueIds = [...new Set(userIds.map((userId) => userId.trim()).filter((userId) => userId.length > 0))];
  if (uniqueIds.length === 0) return new Map();

  const rows: StoredLastSeenAppRow[] = [];
  try {
    for (let index = 0; index < uniqueIds.length; index += LAST_SEEN_USER_CHUNK) {
      const chunk = uniqueIds.slice(index, index + LAST_SEEN_USER_CHUNK);
      const { data, error } = await supabase
        .from('user_last_seen_apps')
        .select('user_id, app_version, platform')
        .in('user_id', chunk);
      if (error) {
        log.error('Failed to read last-seen app versions', 'last-seen-app', {
          error: errorMessage(error),
        });
        return new Map();
      }
      rows.push(...(data ?? []));
    }
  } catch (error) {
    log.error('Failed to read last-seen app versions', 'last-seen-app', {
      error: errorMessage(error),
    });
    return new Map();
  }

  return lastSeenByUserIdFromRows(rows);
}
