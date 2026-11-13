/**
 * Group open fetches balances before the first ledger page.
 * Stats and history stay off this path; they start only when those screens open.
 */
export function shouldFetchGroupLedger(input: {
  balancesFetching: boolean;
  balancesFetched: boolean;
  balancesError: boolean;
}): boolean {
  if (input.balancesFetching) return false;
  return input.balancesFetched || input.balancesError;
}
