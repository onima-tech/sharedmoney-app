/** First-ever open: nothing but the header and one number placeholder until this delay. */
export const CALM_LOADING_DELAY_MS = 800;
export const CALM_LOADING_LINE = "Loading transactions…";

export function shouldShowPositionPlaceholder(input: {
  solo: boolean;
  searchOpen: boolean;
  balancesReady: boolean;
  balancesError: boolean;
}): boolean {
  if (input.solo || input.searchOpen || input.balancesError) return false;
  return !input.balancesReady;
}

export function shouldShowCalmLoadingLine(input: {
  listPending: boolean;
  listHasRows: boolean;
  elapsedMs: number;
}): boolean {
  if (!input.listPending || input.listHasRows) return false;
  return input.elapsedMs >= CALM_LOADING_DELAY_MS;
}
