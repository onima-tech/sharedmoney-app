/**
 * Phase 1 group-details preview shots.
 * The default screen has no Transactions | Activity capsule.
 * A balances failure keeps the ledger and Add expense.
 */

export type GroupsPhase1Shot =
  | "ready"
  | "search"
  | "empty"
  | "payment"
  | "balances"
  | "offline"
  | "fab"
  | "saving"
  | "mixed";

const SHOTS: readonly GroupsPhase1Shot[] = [
  "ready",
  "search",
  "empty",
  "payment",
  "balances",
  "offline",
  "fab",
  "saving",
  "mixed",
];

function isGroupsPhase1Shot(value: string): value is GroupsPhase1Shot {
  return (SHOTS as readonly string[]).includes(value);
}

export function readGroupsPhase1Shot(url: string | null | undefined): GroupsPhase1Shot {
  const match = /[?&#]shot=([a-z0-9-]+)/i.exec(url || "");
  const value = match?.[1]?.toLowerCase() ?? "";
  if (isGroupsPhase1Shot(value)) return value;
  return "ready";
}

/** Search and the groups-list offline frame are the only shots without a ledger. */
export function phase1ShotKeepsLedger(shot: GroupsPhase1Shot): boolean {
  switch (shot) {
    case "empty":
    case "offline":
      return false;
    case "ready":
    case "search":
    case "payment":
    case "balances":
    case "fab":
    case "saving":
    case "mixed":
      return true;
    default: {
      const _exhaustive: never = shot;
      return _exhaustive;
    }
  }
}

/** Add expense stays up unless search is open or the frame is the groups list. */
export function phase1ShotShowsAddExpense(shot: GroupsPhase1Shot): boolean {
  switch (shot) {
    case "search":
    case "empty":
    case "offline":
      return false;
    case "ready":
    case "payment":
    case "balances":
    case "fab":
    case "saving":
    case "mixed":
      return true;
    default: {
      const _exhaustive: never = shot;
      return _exhaustive;
    }
  }
}
