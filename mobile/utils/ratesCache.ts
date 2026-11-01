import type { RatesResponse } from "./rateBook";

/** How long a disk-cached market book may be served when the network fails. */
export const RATES_DISK_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Client-side deadline for `/rates` so a slow edge never owns the UI for 15s. */
export const RATES_FETCH_TIMEOUT_MS = 5000;

const STORAGE_PREFIX = "exchange-rates-cache-v1:";

export type CachedRatesEntry = {
  cachedAt: number;
  response: RatesResponse;
};

export type RatesCacheStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function ratesCacheKey(groupId?: string): string {
  return groupId
    ? `${STORAGE_PREFIX}group:${groupId}`
    : `${STORAGE_PREFIX}market`;
}

export function isRatesDiskCacheUsable(
  cachedAt: number,
  now = Date.now(),
  ttlMs = RATES_DISK_CACHE_TTL_MS,
): boolean {
  if (!Number.isFinite(cachedAt) || cachedAt <= 0) return false;
  return now - cachedAt < ttlMs;
}

export function parseCachedRatesEntry(raw: string | null): CachedRatesEntry | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedRatesEntry>;
    if (
      typeof parsed.cachedAt !== "number" ||
      !parsed.response ||
      typeof parsed.response !== "object" ||
      !parsed.response.usd_rates ||
      typeof parsed.response.usd_rates !== "object"
    ) {
      return null;
    }
    return {
      cachedAt: parsed.cachedAt,
      response: parsed.response as RatesResponse,
    };
  } catch {
    return null;
  }
}

/**
 * Prefer a live network book; otherwise reuse a still-valid disk cache.
 * Preview/static fallbacks are applied by resolveRateBook when this returns null.
 */
export function resolveRatesFetchResult(
  networkResponse: RatesResponse | null,
  diskEntry: CachedRatesEntry | null,
  now = Date.now(),
  ttlMs = RATES_DISK_CACHE_TTL_MS,
): { response: RatesResponse | null; fromDisk: boolean } {
  if (networkResponse?.usd_rates && Object.keys(networkResponse.usd_rates).length > 0) {
    return { response: networkResponse, fromDisk: false };
  }
  if (
    diskEntry &&
    isRatesDiskCacheUsable(diskEntry.cachedAt, now, ttlMs) &&
    diskEntry.response.usd_rates &&
    Object.keys(diskEntry.response.usd_rates).length > 0
  ) {
    return {
      response: { ...diskEntry.response, stale: true },
      fromDisk: true,
    };
  }
  return { response: null, fromDisk: false };
}

export async function readRatesDiskCache(
  storage: RatesCacheStorage,
  groupId?: string,
): Promise<CachedRatesEntry | null> {
  try {
    const raw = await storage.getItem(ratesCacheKey(groupId));
    return parseCachedRatesEntry(raw);
  } catch {
    return null;
  }
}

export async function writeRatesDiskCache(
  storage: RatesCacheStorage,
  response: RatesResponse,
  groupId?: string,
  cachedAt = Date.now(),
): Promise<void> {
  if (!response?.usd_rates || Object.keys(response.usd_rates).length === 0) {
    return;
  }
  const entry: CachedRatesEntry = { cachedAt, response };
  try {
    await storage.setItem(ratesCacheKey(groupId), JSON.stringify(entry));
  } catch {
    // Disk cache is best-effort; network success already returned to the caller.
  }
}
