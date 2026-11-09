import { emptyRateBook, type RateBook } from "./currencyMerge";

/**
 * Static mid-market-style quotes used by the design gallery and as an
 * offline fallback when the shared rate book has not loaded yet.
 * Quoted as units of each currency per 1 USD.
 */
export const PREVIEW_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.86,
  GBP: 0.74,
  INR: 88.5,
  AED: 3.67,
  JPY: 147,
  CAD: 1.36,
  AUD: 1.52,
  SGD: 1.28,
  THB: 32.5,
  CHF: 0.8,
  HKD: 7.78,
  CNY: 7.12,
  KRW: 1350,
  MYR: 4.22,
  PHP: 56.2,
  VND: 25400,
  PKR: 279,
  BDT: 122,
  LKR: 302,
  NPR: 141.6,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.307,
  BHD: 0.376,
  OMR: 0.385,
  EGP: 48.2,
  TRY: 34.1,
  ZAR: 17.8,
  BRL: 5.45,
  MXN: 18.6,
  NZD: 1.64,
  SEK: 9.45,
  NOK: 10.2,
  DKK: 6.42,
  PLN: 3.68,
  CZK: 21.4,
  HUF: 355,
  ILS: 3.62,
  TWD: 31.8,
  IDR: 16200,
};

export const PREVIEW_RATES_AS_OF = "2026-09-03";

export function createPreviewRateBook(
  overrides: Record<string, number> = {}
): RateBook {
  const book = emptyRateBook(PREVIEW_USD_RATES);
  book.asOf = PREVIEW_RATES_AS_OF;
  for (const [key, rate] of Object.entries(overrides)) {
    if (!Number.isFinite(rate) || rate <= 0) continue;
    book.overrides[key.toUpperCase()] = { rate, source: "group" };
  }
  return book;
}
