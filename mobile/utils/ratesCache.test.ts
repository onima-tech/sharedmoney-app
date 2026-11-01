import { assertEquals } from "jsr:@std/assert@1";
import {
  isRatesDiskCacheUsable,
  parseCachedRatesEntry,
  ratesCacheKey,
  readRatesDiskCache,
  resolveRatesFetchResult,
  RATES_DISK_CACHE_TTL_MS,
  RATES_FETCH_TIMEOUT_MS,
  writeRatesDiskCache,
  type RatesCacheStorage,
} from "./ratesCache.ts";

const sampleResponse = {
  as_of: "2026-10-27",
  usd_rates: { USD: 1, EUR: 0.86, INR: 88.5 },
  overrides: [],
  stale: false,
  providers: ["frankfurter"],
};

function memoryStorage(seed: Record<string, string> = {}): RatesCacheStorage & {
  store: Record<string, string>;
} {
  const store = { ...seed };
  return {
    store,
    getItem: async (key) => (key in store ? store[key] : null),
    setItem: async (key, value) => {
      store[key] = value;
    },
  };
}

Deno.test("rates cache keys separate market from group books", () => {
  assertEquals(ratesCacheKey(), "exchange-rates-cache-v1:market");
  assertEquals(
    ratesCacheKey("11111111-1111-1111-1111-111111111111"),
    "exchange-rates-cache-v1:group:11111111-1111-1111-1111-111111111111",
  );
});

Deno.test("disk cache TTL rejects expired and invalid timestamps", () => {
  const now = Date.parse("2026-11-01T12:00:00.000Z");
  assertEquals(isRatesDiskCacheUsable(now - 60_000, now), true);
  assertEquals(
    isRatesDiskCacheUsable(now - RATES_DISK_CACHE_TTL_MS - 1, now),
    false,
  );
  assertEquals(isRatesDiskCacheUsable(Number.NaN, now), false);
  assertEquals(RATES_FETCH_TIMEOUT_MS < 15_000, true);
});

Deno.test("parseCachedRatesEntry rejects malformed payloads", () => {
  assertEquals(parseCachedRatesEntry(null), null);
  assertEquals(parseCachedRatesEntry("{"), null);
  assertEquals(parseCachedRatesEntry(JSON.stringify({ cachedAt: 1 })), null);
  const parsed = parseCachedRatesEntry(JSON.stringify({
    cachedAt: 1,
    response: { usd_rates: sampleResponse.usd_rates },
  }));
  assertEquals(parsed?.response.usd_rates?.INR, 88.5);
});

Deno.test("resolveRatesFetchResult prefers network, then usable disk cache", () => {
  const now = Date.parse("2026-11-01T12:00:00.000Z");
  const disk = {
    cachedAt: now - 60_000,
    response: sampleResponse,
  };

  assertEquals(
    resolveRatesFetchResult(
      { ...sampleResponse, usd_rates: { USD: 1, EUR: 0.9 } },
      disk,
      now,
    ),
    {
      response: { ...sampleResponse, usd_rates: { USD: 1, EUR: 0.9 } },
      fromDisk: false,
    },
  );

  const fallback = resolveRatesFetchResult(null, disk, now);
  assertEquals(fallback.fromDisk, true);
  assertEquals(fallback.response?.stale, true);
  assertEquals(fallback.response?.usd_rates?.INR, 88.5);

  assertEquals(
    resolveRatesFetchResult(
      null,
      { cachedAt: now - RATES_DISK_CACHE_TTL_MS - 1, response: sampleResponse },
      now,
    ),
    { response: null, fromDisk: false },
  );
});

Deno.test("timeout/fallback path: failed network reuses disk cache within TTL", async () => {
  const now = Date.parse("2026-11-01T12:00:00.000Z");
  const storage = memoryStorage();
  await writeRatesDiskCache(storage, sampleResponse, undefined, now - 5_000);

  const disk = await readRatesDiskCache(storage);
  const resolved = resolveRatesFetchResult(null, disk, now);

  assertEquals(resolved.fromDisk, true);
  assertEquals(resolved.response?.usd_rates?.EUR, 0.86);
  assertEquals(resolved.response?.stale, true);
});

Deno.test("writeRatesDiskCache persists group-scoped books", async () => {
  const storage = memoryStorage();
  const groupId = "22222222-2222-2222-2222-222222222222";
  await writeRatesDiskCache(storage, {
    ...sampleResponse,
    overrides: [{ from: "EUR", to: "INR", rate: 91.2, source: "group" }],
  }, groupId, 100);

  const disk = await readRatesDiskCache(storage, groupId);
  assertEquals(disk?.cachedAt, 100);
  assertEquals(disk?.response.overrides?.[0]?.rate, 91.2);
  assertEquals(await readRatesDiskCache(storage), null);
});
