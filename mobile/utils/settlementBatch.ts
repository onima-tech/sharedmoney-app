/**
 * Posts settle-all rows one group at a time.
 * fetchWithAuth throws on a non-OK response, so a later failure must not hide
 * payments that already landed.
 */
export async function recordSettlementBatch<TInput, TResult>(
  settlements: readonly TInput[],
  post: (settlement: TInput) => Promise<TResult>,
): Promise<TResult[]> {
  const created: TResult[] = [];
  for (const settlement of settlements) {
    try {
      created.push(await post(settlement));
    } catch (error) {
      if (created.length === 0) throw error;
      const reason = error instanceof Error ? error.message : "one group payment failed";
      throw new Error(
        `Recorded ${created.length} of ${settlements.length} group payments, then one failed: ${reason}`,
      );
    }
  }
  return created;
}
