import { isValidUUID } from './validation.ts';

export const MAX_DEFAULT_SPLIT_WEIGHT = 99;
export const MAX_DEFAULT_SPLIT_PEOPLE = 100;

export type GroupDefaultSplitMode = 'equal' | 'weights';

export interface ParsedGroupDefaultSplit {
  mode: GroupDefaultSplitMode;
  weights: Record<string, number>;
}

export type GroupDefaultSplitParseResult =
  | { ok: true; value: ParsedGroupDefaultSplit }
  | { ok: false; error: string };

/**
 * Strict write-path parser. Reading a saved expense does not go through here,
 * so a new default cannot rewrite splits already stored on a transaction.
 */
export function parseGroupDefaultSplitUpdate(input: {
  default_split_mode?: unknown;
  default_split_weights?: unknown;
}): GroupDefaultSplitParseResult {
  const mode = input.default_split_mode;
  if (mode !== 'equal' && mode !== 'weights') {
    return { ok: false, error: 'default_split_mode must be equal or weights' };
  }

  if (input.default_split_weights === undefined) {
    return { ok: true, value: { mode, weights: {} } };
  }

  const raw = input.default_split_weights;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'default_split_weights must be an object' };
  }

  const entries = Object.entries(raw);
  if (entries.length > MAX_DEFAULT_SPLIT_PEOPLE) {
    return { ok: false, error: 'default_split_weights has too many people' };
  }

  const weights: Record<string, number> = {};
  for (const [id, value] of entries) {
    if (!isValidUUID(id)) {
      return { ok: false, error: 'Each weight must name a person in this group' };
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_DEFAULT_SPLIT_WEIGHT) {
      return { ok: false, error: 'Each weight must be an integer from 1 to 99' };
    }
    weights[id] = value;
  }

  return { ok: true, value: { mode, weights } };
}
