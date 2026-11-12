export type GroupsListStatus =
  | { kind: "offline"; text: "Offline · showing saved groups" }
  | { kind: "refresh-error"; text: "Couldn’t refresh · Retry" };

/**
 * Groups home status under the header.
 * Offline with a saved list wins over a refresh error. A connectivity failure
 * with nothing saved stays a refresh line — the offline sentence would claim
 * saved groups that are not there.
 */
export function groupsListStatusLine(input: {
  offline: boolean;
  hasSavedGroups: boolean;
  hasError: boolean;
}): GroupsListStatus | null {
  if (input.offline && input.hasSavedGroups) {
    return { kind: "offline", text: "Offline · showing saved groups" };
  }
  if (input.hasError) {
    return { kind: "refresh-error", text: "Couldn’t refresh · Retry" };
  }
  return null;
}
