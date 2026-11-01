import { isValidIsoCurrency, normalizeIsoCurrency } from "./isoCurrencies.ts";

export const MARKET_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
/** Bound how long a stale-cache hit waits on upstream refresh before serving stale. */
export const STALE_REFRESH_DEADLINE_MS = 2500;
/** Per-provider HTTP timeout. Kept short so one hung upstream cannot approach gateway limits. */
export const UPSTREAM_FETCH_TIMEOUT_MS = 4000;
/** After the first provider succeeds, briefly wait for the second to fill missing quotes. */
export const SECOND_PROVIDER_GRACE_MS = 400;
export const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=USD";
export const EXCHANGE_RATE_API_URL = "https://open.er-api.com/v6/latest/USD";

export type RateSource = "market" | "group" | "expense";

export type MarketQuoteRow = {
  base_currency: string;
  quote_currency: string;
  rate: number;
  as_of: string;
  provider: string;
  updated_at: string;
};

export type GroupRateRow = {
  from_currency: string;
  to_currency: string;
  rate: number;
  source: Exclude<RateSource, "market">;
  updated_at?: string;
};

export type RatesPayload = {
  as_of: string | null;
  usd_rates: Record<string, number>;
  overrides: Array<{
    from: string;
    to: string;
    rate: number;
    source: Exclude<RateSource, "market">;
    updated_at?: string;
  }>;
  stale: boolean;
  providers: string[];
};

export function isCacheFresh(
  updatedAt: string | Date | null | undefined,
  now = Date.now(),
  ttlMs = MARKET_CACHE_TTL_MS,
): boolean {
  if (!updatedAt) return false;
  const timestamp = updatedAt instanceof Date
    ? updatedAt.getTime()
    : Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) return false;
  return now - timestamp < ttlMs;
}

export type MarketRefreshOutcome =
  | { kind: "fresh" }
  | { kind: "stale" }
  | { kind: "empty" };

/**
 * Decide what a /rates GET should return when the Postgres cache may be stale
 * and an upstream refresh may still be in flight.
 */
export function chooseMarketBookOutcome(input: {
  hasCache: boolean;
  cacheFresh: boolean;
  freshAvailable: boolean;
  refreshTimedOut: boolean;
}): MarketRefreshOutcome {
  if (input.hasCache && input.cacheFresh) return { kind: "fresh" };
  if (input.freshAvailable) return { kind: "fresh" };
  if (input.hasCache && (input.refreshTimedOut || !input.freshAvailable)) {
    return { kind: "stale" };
  }
  return { kind: "empty" };
}

export async function raceWithDeadline<T>(
  promise: Promise<T>,
  deadlineMs: number,
): Promise<{ timedOut: false; value: T } | { timedOut: true; value?: undefined }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then((value) => ({ timedOut: false as const, value })),
      new Promise<{ timedOut: true }>((resolve) => {
        timer = setTimeout(() => resolve({ timedOut: true }), deadlineMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function parseUsdRateMap(rates: unknown): Record<string, number> {
  const record = asRecord(rates);
  if (!record) return {};

  const usdRates: Record<string, number> = { USD: 1 };
  for (const [code, raw] of Object.entries(record)) {
    const currency = normalizeIsoCurrency(code);
    const rate = typeof raw === "number" ? raw : Number(raw);
    if (!currency || !Number.isFinite(rate) || rate <= 0) continue;
    usdRates[currency] = rate;
  }
  return usdRates;
}

export function parseFrankfurterResponse(
  json: unknown,
): { asOf: string; usdRates: Record<string, number> } | null {
  const record = asRecord(json);
  if (!record) return null;
  const usdRates = parseUsdRateMap(record.rates);
  if (Object.keys(usdRates).length <= 1) return null;
  const asOf = typeof record.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
    ? record.date
    : new Date().toISOString().slice(0, 10);
  return { asOf, usdRates };
}

export function parseExchangeRateApiResponse(
  json: unknown,
): { asOf: string; usdRates: Record<string, number> } | null {
  const record = asRecord(json);
  if (!record || record.result !== "success") return null;
  const usdRates = parseUsdRateMap(record.rates);
  if (Object.keys(usdRates).length <= 1) return null;

  let asOf = new Date().toISOString().slice(0, 10);
  if (typeof record.time_last_update_utc === "string") {
    const parsed = Date.parse(record.time_last_update_utc);
    if (!Number.isNaN(parsed)) {
      asOf = new Date(parsed).toISOString().slice(0, 10);
    }
  }
  return { asOf, usdRates };
}

export function mergeUsdRates(
  primary: Record<string, number>,
  fallback: Record<string, number> = {},
): Record<string, number> {
  return {
    USD: 1,
    ...fallback,
    ...primary,
  };
}

export function usdRatesToRows(
  usdRates: Record<string, number>,
  asOf: string,
  providerFor: (code: string) => string,
  updatedAt = new Date().toISOString(),
): MarketQuoteRow[] {
  return Object.entries(usdRates)
    .filter(([, rate]) => Number.isFinite(rate) && rate > 0)
    .map(([quote, rate]) => ({
      base_currency: "USD",
      quote_currency: quote.toUpperCase(),
      rate,
      as_of: asOf,
      provider: providerFor(quote.toUpperCase()),
      updated_at: updatedAt,
    }));
}

export function rowsToUsdRates(
  rows: Array<{ quote_currency?: string; rate?: number | string }>,
): Record<string, number> {
  const usdRates: Record<string, number> = { USD: 1 };
  for (const row of rows) {
    const currency = normalizeIsoCurrency(row.quote_currency);
    const rate = typeof row.rate === "number" ? row.rate : Number(row.rate);
    if (!currency || !Number.isFinite(rate) || rate <= 0) continue;
    usdRates[currency] = rate;
  }
  return usdRates;
}

export function buildRatesPayload(
  usdRates: Record<string, number>,
  overrides: GroupRateRow[],
  asOf: string | null,
  stale: boolean,
  providers: string[] = [],
): RatesPayload {
  return {
    as_of: asOf,
    usd_rates: { USD: 1, ...usdRates },
    overrides: overrides.map((row) => ({
      from: row.from_currency.toUpperCase(),
      to: row.to_currency.toUpperCase(),
      rate: Number(row.rate),
      source: row.source,
      updated_at: row.updated_at,
    })),
    stale,
    providers,
  };
}

export type GroupRateInput = {
  group_id: string;
  from: string;
  to: string;
  rate: number;
  source: Exclude<RateSource, "market">;
};

export function validateGroupRateInput(body: unknown): {
  valid: boolean;
  error?: string;
  value?: GroupRateInput;
} {
  const record = asRecord(body);
  if (!record) {
    return { valid: false, error: "Request body is required" };
  }

  const groupId = typeof record.group_id === "string" ? record.group_id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) {
    return { valid: false, error: "Invalid group_id format. Expected UUID." };
  }

  const from = normalizeIsoCurrency(record.from);
  const to = normalizeIsoCurrency(record.to);
  if (!from || !to) {
    return { valid: false, error: "from and to must be valid ISO currency codes" };
  }
  if (from === to) {
    return { valid: false, error: "from and to must be different currencies" };
  }

  const rate = typeof record.rate === "number" ? record.rate : Number(record.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { valid: false, error: "rate must be a positive number" };
  }
  if (rate > 1_000_000) {
    return { valid: false, error: "rate exceeds the maximum allowed value" };
  }

  const source = record.source === "expense" ? "expense" : "group";
  return {
    valid: true,
    value: { group_id: groupId, from, to, rate, source },
  };
}

export function normalizeOptionalCurrency(value: unknown): {
  valid: boolean;
  error?: string;
  value?: string | null;
} {
  if (value === undefined) {
    return { valid: true };
  }
  if (value === null || value === "") {
    return { valid: true, value: null };
  }
  if (!isValidIsoCurrency(value)) {
    return { valid: false, error: "Currency must be a valid ISO 4217 code" };
  }
  return { valid: true, value: normalizeIsoCurrency(value) };
}
