/**
 * Disk cache for the last all-balances response and the last ~10 opened
 * groups (balances, first ledger page, settlements, participants).
 * Sign-out clears every saved balance and ledger page.
 */
import type { BalancesResponse, Participant, Settlement, Transaction } from "../types";

export interface CachedLedgerPage {
  items: Transaction[];
  has_more: boolean;
  next_cursor: { date: string; id: number } | null;
}

export const ALL_BALANCES_KEY_PREFIX = "sm:rq-balances-all:";
export const GROUP_OPEN_KEY_PREFIX = "sm:rq-group-open:";
export const GROUP_OPEN_LIMIT = 10;

export interface GroupOpenStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export interface GroupOpenSnapshot {
  balances?: BalancesResponse;
  ledgerPage?: CachedLedgerPage;
  settlements?: Settlement[];
  participants?: Participant[];
  savedAt: number;
}

interface GroupOpenStore {
  order: string[];
  groups: Record<string, GroupOpenSnapshot>;
}

const memory = new Map<string, GroupOpenStore>();
const allBalancesMemory = new Map<string, BalancesResponse>();

function allBalancesKey(userId: string): string {
  return `${ALL_BALANCES_KEY_PREFIX}${userId}`;
}

function groupOpenKey(userId: string): string {
  return `${GROUP_OPEN_KEY_PREFIX}${userId}`;
}

function emptyStore(): GroupOpenStore {
  return { order: [], groups: {} };
}

function readStore(userId: string): GroupOpenStore {
  return memory.get(userId) ?? emptyStore();
}

export function resetGroupOpenMemory(): void {
  memory.clear();
  allBalancesMemory.clear();
}

export function peekGroupSnapshot(userId: string, groupId: string): GroupOpenSnapshot | null {
  return memory.get(userId)?.groups[groupId] ?? null;
}

export function peekAllBalances(userId: string): BalancesResponse | null {
  return allBalancesMemory.get(userId) ?? null;
}

export function peekGroupOpenOrder(userId: string): string[] {
  return [...(memory.get(userId)?.order ?? [])];
}

function parseStore(raw: string | null): GroupOpenStore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GroupOpenStore>;
    if (!parsed || !Array.isArray(parsed.order) || typeof parsed.groups !== "object" || !parsed.groups) {
      return null;
    }
    return { order: parsed.order.filter((id) => typeof id === "string"), groups: parsed.groups };
  } catch {
    return null;
  }
}

export async function hydrateGroupOpenCache(
  userId: string,
  storage: GroupOpenStorage,
): Promise<void> {
  if (memory.has(userId)) return;
  const [groupRaw, balancesRaw] = await Promise.all([
    storage.getItem(groupOpenKey(userId)),
    storage.getItem(allBalancesKey(userId)),
  ]);
  if (!memory.has(userId)) {
    memory.set(userId, parseStore(groupRaw) ?? emptyStore());
  }
  if (!allBalancesMemory.has(userId) && balancesRaw) {
    try {
      const parsed = JSON.parse(balancesRaw) as BalancesResponse;
      if (parsed && Array.isArray(parsed.group_balances) && Array.isArray(parsed.overall_balances)) {
        allBalancesMemory.set(userId, parsed);
      }
    } catch {
      // Ignore a corrupt all-balances payload.
    }
  }
}

function rememberGroup(userId: string, groupId: string, patch: Partial<GroupOpenSnapshot>): GroupOpenStore {
  const current = readStore(userId);
  const previous = current.groups[groupId];
  const nextGroups = { ...current.groups };
  nextGroups[groupId] = {
    ...previous,
    ...patch,
    savedAt: Date.now(),
  };
  const order = [groupId, ...current.order.filter((id) => id !== groupId)];
  while (order.length > GROUP_OPEN_LIMIT) {
    const dropped = order.pop();
    if (dropped) delete nextGroups[dropped];
  }
  const store = { order, groups: nextGroups };
  memory.set(userId, store);
  return store;
}

export async function saveGroupOpenPart(
  userId: string,
  groupId: string,
  patch: Partial<Omit<GroupOpenSnapshot, "savedAt">>,
  storage: GroupOpenStorage,
): Promise<void> {
  const store = rememberGroup(userId, groupId, patch);
  await storage.setItem(groupOpenKey(userId), JSON.stringify(store));
}

export async function saveAllBalances(
  userId: string,
  data: BalancesResponse,
  storage: GroupOpenStorage,
): Promise<void> {
  allBalancesMemory.set(userId, data);
  await storage.setItem(allBalancesKey(userId), JSON.stringify(data));
}

export function isSavedBalanceOrLedgerKey(key: string): boolean {
  return key.startsWith(ALL_BALANCES_KEY_PREFIX) || key.startsWith(GROUP_OPEN_KEY_PREFIX);
}

/** Removes every saved balance response and ledger page. Leaves other keys. */
export async function clearSavedBalancesAndLedgers(storage: GroupOpenStorage): Promise<string[]> {
  resetGroupOpenMemory();
  const keys = await storage.getAllKeys();
  const removed = keys.filter(isSavedBalanceOrLedgerKey);
  await Promise.all(removed.map((key) => storage.removeItem(key)));
  return removed;
}
