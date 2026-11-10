/**
 * PostgREST and Postgres return plain objects, not Error instances.
 * Row-level security failures are permission denials. Leaving them as 500
 * made settle-all show "A server error occurred" when one group had been left.
 */
export function classifyDatabaseWriteError(error: unknown): {
  status: number;
  error: string;
  code: string;
} | null {
  if (!error || typeof error !== 'object' || error instanceof Error) {
    return null;
  }
  const record = error as { code?: unknown; message?: unknown; details?: unknown };
  const pgCode = typeof record.code === 'string' ? record.code : '';
  const message = [record.message, record.details]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();

  if (
    pgCode === '42501' ||
    message.includes('row-level security') ||
    message.includes('not an active group member')
  ) {
    return {
      status: 403,
      error: 'Not an active group member',
      code: 'PERMISSION_DENIED',
    };
  }
  if (pgCode === '23514' && message.includes('amount')) {
    return {
      status: 400,
      error: 'Amount must be a positive number',
      code: 'VALIDATION_ERROR',
    };
  }
  if (pgCode === '23503') {
    return {
      status: 400,
      error: 'Those people are not in this group',
      code: 'VALIDATION_ERROR',
    };
  }
  return null;
}
