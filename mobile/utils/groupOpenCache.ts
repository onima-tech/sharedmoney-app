/**
 * Disk cache for the last all-balances response and the last ~10 opened
 * groups (balances, first ledger page, participants). Sign-out clears it.
 * Storage is injected so this stays on the AsyncStorage the app already uses.
 */
import type { BalancesResponse, Participant, Settlement, Transaction } from "../types";
import { queryKeys } from "../hooks/queryKeys";

export const GROUP_OPEN_CACHE_LIMIT = 10;

export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type SavedTransactionPage = {
  items: Transaction[];
  has_more: boolean;
  next_cursor: { date: string; id: number } | null;
};

export type SavedGroupOpen = {
  groupId: string;
  savedAt: string;
  balances: BalancesResponse;
  ledger: {
    transactions: SavedTransactionPage;
    settlements: Settlement[];
  };
  participants: Participant[];
};

type GroupOpenFile = {
  order: string[];
  groups: Record<string, SavedGroupOpen>;
};

export type SavedAllBalances = {
  savedAt: string;
  response: BalancesResponse;
};

export type QueryDataWriter = {
  setQueryData: (queryKey: readonly unknown[], data: unknown) => void;
};

const files = new Map<string, GroupOpenFile>();
const allBalances = new Map<string, SavedAllBalances>();

export function groupOpenStorageKey(userId: string): string {
  return `sm:group-open:${userId}`;
}

export function allBalancesStorageKey(userId: string): string {
  return `sm:balances-all:${userId}`;
}

export function resetGroupOpenMemoryForTests(): void {
  files.clear();
  allBalances.clear();
}

export function readGroupOpenMemory(userId: string, groupId: string): SavedGroupOpen | null {
  return files.get(userId)?.groups[groupId] ?? null;
}

export function readAllBalancesMemory(userId: string): SavedAllBalances | null {
  return allBalances.get(userId) ?? null;
}

function emptyFile(): GroupOpenFile {
  return { order: [], groups: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseFile(raw: string | null): GroupOpenFile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.order) || !isRecord(parsed.groups)) {
      return null;
    }
    return parsed as GroupOpenFile;
  } catch {
    return null;
  }
}

function parseAllBalances(raw: string | null): SavedAllBalances | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.response)) return null;
    return parsed as SavedAllBalances;
  } catch {
    return null;
  }
}

export async function hydrateGroupOpenCache(
  userId: string,
  storage: KeyValueStorage,
): Promise<void> {
  const [groupRaw, allRaw] = await Promise.all([
    storage.getItem(groupOpenStorageKey(userId)),
    storage.getItem(allBalancesStorageKey(userId)),
  ]);
  const file = parseFile(groupRaw);
  if (file) files.set(userId, file);
  const savedAll = parseAllBalances(allRaw);
  if (savedAll) allBalances.set(userId, savedAll);
}

export async function rememberAllBalances(
  storage: KeyValueStorage,
  userId: string,
  response: BalancesResponse,
  savedAt = new Date().toISOString(),
): Promise<void> {
  const saved = { savedAt, response };
  allBalances.set(userId, saved);
  await storage.setItem(allBalancesStorageKey(userId), JSON.stringify(saved));
}

export async function rememberGroupOpen(
  storage: KeyValueStorage,
  userId: string,
  entry: SavedGroupOpen,
): Promise<void> {
  const current = files.get(userId) ?? emptyFile();
  const order = [entry.groupId, ...current.order.filter((id) => id !== entry.groupId)];
  const groups = { ...current.groups, [entry.groupId]: entry };
  while (order.length > GROUP_OPEN_CACHE_LIMIT) {
    const dropped = order.pop();
    if (dropped) delete groups[dropped];
  }
  const next = { order, groups };
  files.set(userId, next);
  await storage.setItem(groupOpenStorageKey(userId), JSON.stringify(next));
}

/** Removes every saved balance response and ledger page for this user. */
export async function clearSavedGroupMoney(
  userId: string,
  storage: KeyValueStorage,
): Promise<void> {
  files.delete(userId);
  allBalances.delete(userId);
  await Promise.all([
    storage.removeItem(groupOpenStorageKey(userId)),
    storage.removeItem(allBalancesStorageKey(userId)),
  ]);
}

export function seedAllBalancesQuery(client: QueryDataWriter, userId: string): boolean {
  const saved = readAllBalancesMemory(userId);
  if (!saved) return false;
  client.setQueryData(["balances", "all"], saved.response);
  return true;
}

export function seedGroupOpenQueries(
  client: QueryDataWriter,
  userId: string,
  groupId: string,
): boolean {
  const saved = readGroupOpenMemory(userId, groupId);
  if (!saved) return false;
  client.setQueryData(queryKeys.balances(groupId), saved.balances);
  client.setQueryData(queryKeys.transactionsFeed(groupId), {
    pages: [saved.ledger.transactions],
    pageParams: [null],
  });
  client.setQueryData(queryKeys.settlements(groupId), {
    settlements: saved.ledger.settlements,
  });
  client.setQueryData(queryKeys.participants(groupId), saved.participants);
  return true;
}
