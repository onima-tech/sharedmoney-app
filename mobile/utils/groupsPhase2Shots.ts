/** Dev-only shot names for the phase 2 group preview. Not used in production. */

export type GroupsPhase2Shot =
  | "owed"
  | "even"
  | "settle"
  | "compact"
  | "placeholder"
  | "loading"
  | "unify"
  | "cached"
  | "balances"
  | "christophers"
  | "detail-equal"
  | "detail-unequal"
  | "detail-payment"
  | "detail-not-in-split"
  | "detail-converted";

const SHOTS: readonly GroupsPhase2Shot[] = [
  "owed",
  "even",
  "settle",
  "compact",
  "placeholder",
  "loading",
  "unify",
  "cached",
  "balances",
  "christophers",
  "detail-equal",
  "detail-unequal",
  "detail-payment",
  "detail-not-in-split",
  "detail-converted",
];

function isShot(value: string): value is GroupsPhase2Shot {
  return (SHOTS as readonly string[]).includes(value);
}

export function readGroupsPhase2Shot(url: string | null | undefined): GroupsPhase2Shot {
  if (!url) return "owed";
  const match = /[?&#]shot=([a-z0-9-]+)/i.exec(url);
  const value = match?.[1]?.toLowerCase() ?? "";
  return isShot(value) ? value : "owed";
}

export function phase2ShotIsDetail(shot: GroupsPhase2Shot): boolean {
  return shot.startsWith("detail-");
}
