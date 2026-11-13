/** Dev-only shot names for the phase 3 Home preview. Not used in production. */

export type GroupsPhase3Shot =
  | "owed"
  | "even"
  | "split"
  | "empty"
  | "cached"
  | "error";

const SHOTS: readonly GroupsPhase3Shot[] = [
  "owed",
  "even",
  "split",
  "empty",
  "cached",
  "error",
];

function isShot(value: string): value is GroupsPhase3Shot {
  return (SHOTS as readonly string[]).includes(value);
}

export function readGroupsPhase3Shot(url: string | null | undefined): GroupsPhase3Shot {
  if (!url) return "owed";
  const match = /[?&#]shot=([a-z0-9-]+)/i.exec(url);
  const value = match?.[1]?.toLowerCase() ?? "";
  return isShot(value) ? value : "owed";
}
