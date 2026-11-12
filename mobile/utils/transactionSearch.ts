/**
 * On-page ledger search over rows already loaded.
 * Filters stay off the default ledger until the field is opened.
 */

export type TransactionSearchFilter = "all" | "expenses" | "payments" | "involving-me";

export interface LedgerSearchFields {
  kind: "expense" | "payment";
  title: string;
  payerLine: string;
  amountText: string;
  amount: number;
  involvesViewer: boolean;
}

export const LOADED_ROWS_SEARCH_NOTE = "Only loaded transactions are searched";
export const SEARCHING_TRANSACTIONS_LINE = "Searching…";

export function involvingMeFilterLabel(
  windowWidth: number,
  fontScale: number,
): "Involving me" | "Me" {
  if (!(fontScale > 0) || fontScale > 1.1) return "Me";
  if (windowWidth < 340) return "Me";
  return "Involving me";
}

export function transactionSearchFilterLabel(
  filter: TransactionSearchFilter,
  involvingLabel: "Involving me" | "Me",
): string {
  switch (filter) {
    case "all":
      return "All";
    case "expenses":
      return "Expenses";
    case "payments":
      return "Payments";
    case "involving-me":
      return involvingLabel;
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

/** Term inside the empty-state quotes. A typed query wins over the filter name. */
export function transactionSearchTerm(
  query: string,
  filter: TransactionSearchFilter,
  involvingLabel: "Involving me" | "Me",
): string {
  const trimmed = query.trim();
  if (trimmed) return trimmed;
  if (filter === "all") return "";
  return transactionSearchFilterLabel(filter, involvingLabel);
}

export function transactionSearchEmptyMessage(term: string): string {
  return `No transactions match “${term}”`;
}

function fold(value: string): string {
  return value.toLowerCase();
}

function amountFold(value: string): string {
  return fold(value).replace(/[₹$€£¥฿,\s]/g, "").replace(/\.00\b/g, "");
}

export function ledgerRowMatchesQuery(fields: LedgerSearchFields, query: string): boolean {
  const needle = query.trim();
  if (!needle) return true;
  const hay = fold([fields.title, fields.payerLine, fields.amountText].join("\n"));
  if (hay.includes(fold(needle))) return true;
  const amountNeedle = amountFold(needle);
  if (!amountNeedle) return false;
  const amountHay = amountFold(
    `${fields.amountText} ${fields.payerLine} ${fields.amount}`,
  );
  return amountHay.includes(amountNeedle);
}

export function ledgerRowMatchesFilter(
  fields: LedgerSearchFields,
  filter: TransactionSearchFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "expenses":
      return fields.kind === "expense";
    case "payments":
      return fields.kind === "payment";
    case "involving-me":
      return fields.involvesViewer;
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

export function ledgerRowMatchesSearch(
  fields: LedgerSearchFields,
  query: string,
  filter: TransactionSearchFilter,
): boolean {
  return ledgerRowMatchesFilter(fields, filter) && ledgerRowMatchesQuery(fields, query);
}
