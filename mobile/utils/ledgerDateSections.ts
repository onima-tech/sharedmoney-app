/**
 * Quiet date labels for the group ledger.
 * Today, Yesterday, This week (ISO week, Monday start), Earlier this month,
 * then a month name. Date-only strings stay on that calendar day.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export interface LocalDate {
  year: number;
  month: number;
  day: number;
}

export interface LedgerDateSection<T> {
  label: string;
  items: T[];
}

function isValidDate(date: LocalDate): boolean {
  if (date.month < 1 || date.month > 12 || date.day < 1 || date.day > 31) return false;
  const check = new Date(date.year, date.month - 1, date.day);
  return check.getFullYear() === date.year
    && check.getMonth() === date.month - 1
    && check.getDate() === date.day;
}

export function parseLedgerDate(raw: string | null | undefined): LocalDate | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const date = {
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
    };
    return isValidDate(date) ? date : null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

function fromClock(now: Date): LocalDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function dateValue(date: LocalDate): number {
  return date.year * 10000 + date.month * 100 + date.day;
}

function addDays(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(date.year, date.month - 1, date.day + days);
  return {
    year: shifted.getFullYear(),
    month: shifted.getMonth() + 1,
    day: shifted.getDate(),
  };
}

/** Monday of the ISO week that contains `date`. */
function startOfIsoWeek(date: LocalDate): LocalDate {
  const clock = new Date(date.year, date.month - 1, date.day);
  const weekday = clock.getDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(date, -daysFromMonday);
}

export function ledgerDateSectionLabel(
  raw: string | null | undefined,
  now: Date,
): string {
  const date = parseLedgerDate(raw);
  if (!date) return "Earlier";
  const today = fromClock(now);
  const value = dateValue(date);
  if (value === dateValue(today)) return "Today";
  if (value === dateValue(addDays(today, -1))) return "Yesterday";
  const weekStart = startOfIsoWeek(today);
  const weekEnd = addDays(weekStart, 6);
  if (value >= dateValue(weekStart) && value <= dateValue(weekEnd)) return "This week";
  if (date.year === today.year && date.month === today.month) return "Earlier this month";
  return `${MONTHS[date.month - 1]} ${date.year}`;
}

/** Consecutive items that share a label stay in one section. Input order is kept. */
export function groupByLedgerDateSection<T>(
  items: readonly T[],
  dateOf: (item: T) => string | null | undefined,
  now: Date,
): LedgerDateSection<T>[] {
  const sections: LedgerDateSection<T>[] = [];
  for (const item of items) {
    const label = ledgerDateSectionLabel(dateOf(item), now);
    const last = sections[sections.length - 1];
    if (last && last.label === label) last.items.push(item);
    else sections.push({ label, items: [item] });
  }
  return sections;
}
