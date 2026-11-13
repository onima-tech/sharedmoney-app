/**
 * Phase 2 preview shots. Dummy people only (Rahul, Meera, Dev).
 * The default group screen has no Activity toggle.
 */

export type GroupsPhase2Shot =
  | "owed"
  | "even"
  | "compact"
  | "balances"
  | "placeholder"
  | "cached"
  | "detail-equal"
  | "detail-unequal"
  | "detail-payment"
  | "detail-not-in-split"
  | "detail-converted";

const SHOTS: readonly GroupsPhase2Shot[] = [
  "owed",
  "even",
  "compact",
  "balances",
  "placeholder",
  "cached",
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
  const match = /[?&#]shot=([a-z0-9-]+)/i.exec(url || "");
  const value = match?.[1]?.toLowerCase() ?? "";
  if (isShot(value)) return value;
  return "owed";
}

export function phase2ShotIsDetail(shot: GroupsPhase2Shot): boolean {
  switch (shot) {
    case "detail-equal":
    case "detail-unequal":
    case "detail-payment":
    case "detail-not-in-split":
    case "detail-converted":
      return true;
    case "owed":
    case "even":
    case "compact":
    case "balances":
    case "placeholder":
    case "cached":
      return false;
    default: {
      const _exhaustive: never = shot;
      return _exhaustive;
    }
  }
}
