import { assertEquals } from 'jsr:@std/assert@1';
import { parseGroupDefaultSplitUpdate } from './groupDefaultSplit.ts';

const AISHA = '11111111-1111-4111-8111-111111111111';
const DEV = '22222222-2222-4222-8222-222222222222';

Deno.test('parseGroupDefaultSplitUpdate accepts equal and integer weights', () => {
  assertEquals(
    parseGroupDefaultSplitUpdate({ default_split_mode: 'equal' }),
    { ok: true, value: { mode: 'equal', weights: {} } },
  );
  assertEquals(
    parseGroupDefaultSplitUpdate({
      default_split_mode: 'weights',
      default_split_weights: { [AISHA]: 2, [DEV]: 1 },
    }),
    { ok: true, value: { mode: 'weights', weights: { [AISHA]: 2, [DEV]: 1 } } },
  );
});

Deno.test('parseGroupDefaultSplitUpdate rejects unknown modes and malformed weights', () => {
  const rejected = [
    { default_split_weights: { [AISHA]: 2 } },
    { default_split_mode: 'percent' },
    { default_split_mode: 'weights', default_split_weights: [] },
    { default_split_mode: 'weights', default_split_weights: { [AISHA]: 1.5 } },
    { default_split_mode: 'weights', default_split_weights: { [AISHA]: 0 } },
    { default_split_mode: 'weights', default_split_weights: { [AISHA]: 100 } },
    { default_split_mode: 'weights', default_split_weights: { notAPerson: 2 } },
    { default_split_mode: 'weights', default_split_weights: null },
  ];

  for (const input of rejected) {
    const result = parseGroupDefaultSplitUpdate(input);
    assertEquals(result.ok, false);
  }
});
