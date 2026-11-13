/** Dev-only shot names for the default-split preview. Not used in production. */

export type DefaultSplitShot =
  | "settings-equal"
  | "settings-weights"
  | "expense-prefill"
  | "expense-changed"
  | "expense-unchanged";

const SHOTS: readonly DefaultSplitShot[] = [
  "settings-equal",
  "settings-weights",
  "expense-prefill",
  "expense-changed",
  "expense-unchanged",
];

function isShot(value: string): value is DefaultSplitShot {
  return (SHOTS as readonly string[]).includes(value);
}

export function readDefaultSplitShot(url: string | null | undefined): DefaultSplitShot {
  if (!url) return "settings-equal";
  const match = /[?&#]shot=([a-z0-9-]+)/i.exec(url);
  const value = match?.[1]?.toLowerCase() ?? "";
  return isShot(value) ? value : "settings-equal";
}
