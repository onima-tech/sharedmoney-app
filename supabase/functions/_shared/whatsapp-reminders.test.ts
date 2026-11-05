import { assertEquals } from 'jsr:@std/assert@1';
import {
  buildMonthlyReminderPayload,
  classifyReminderReserveError,
  DEFAULT_WHATSAPP_REMINDER_RESERVE_INR,
  firstNameForReminder,
  getPreviousIstMonthPeriodKey,
  isWhatsAppRemindersEnabled,
  maskPhone,
  normalizeIndianWhatsAppNumber,
  resolveWhatsAppReminderConfig,
  summarizeReminderActions,
} from './whatsapp-reminders.ts';
import type { ReminderAction } from './monthly-reminders.ts';

function env(entries: Record<string, string | undefined>): Deno.Env {
  return {
    get: (k: string) => entries[k],
    set() {},
    delete() {},
    has: (k: string) => entries[k] !== undefined,
    toObject: () => ({}) as Record<string, string>,
  } as unknown as Deno.Env;
}

Deno.test('reminder flag defaults off and needs exact "true"', () => {
  assertEquals(isWhatsAppRemindersEnabled(env({})), false);
  assertEquals(isWhatsAppRemindersEnabled(env({ ENABLE_WHATSAPP_MONTHLY_REMINDERS: '1' })), false);
  assertEquals(isWhatsAppRemindersEnabled(env({ ENABLE_WHATSAPP_MONTHLY_REMINDERS: 'true' })), true);
});

Deno.test('config defaults share the ₹500 budget and keep ₹100 for OTP', () => {
  const config = resolveWhatsAppReminderConfig(env({}))!;
  assertEquals(config.monthlyBudgetInr, 500);
  assertEquals(config.reserveInr, DEFAULT_WHATSAPP_REMINDER_RESERVE_INR);
  assertEquals(config.templateName, 'sharedmoney_monthly_balance');
});

Deno.test('config fails closed on invalid values', () => {
  assertEquals(resolveWhatsAppReminderConfig(env({ WHATSAPP_REMINDER_COST_INR: 'abc' })), null);
  assertEquals(resolveWhatsAppReminderConfig(env({ WHATSAPP_REMINDER_COST_INR: '0' })), null);
  assertEquals(resolveWhatsAppReminderConfig(env({ WHATSAPP_MONTHLY_BUDGET_INR: '-5' })), null);
  assertEquals(resolveWhatsAppReminderConfig(env({ WHATSAPP_REMINDER_RESERVE_INR: '500' })), null);
});

Deno.test('only +91 mobile numbers are eligible', () => {
  assertEquals(normalizeIndianWhatsAppNumber('+91 98765 43210'), '+919876543210');
  assertEquals(normalizeIndianWhatsAppNumber('0091-98765-43210'), '+919876543210');
  assertEquals(normalizeIndianWhatsAppNumber('+12025550100'), null);
  assertEquals(normalizeIndianWhatsAppNumber('9876543210'), null);
  assertEquals(normalizeIndianWhatsAppNumber('+911234567890'), null);
  assertEquals(normalizeIndianWhatsAppNumber(null), null);
});

Deno.test('previous month is computed in IST', () => {
  // 1 Dec 2026 00:10 IST is still 30 Nov UTC.
  assertEquals(getPreviousIstMonthPeriodKey(new Date('2026-11-30T18:40:00Z')), '2026-11');
  assertEquals(getPreviousIstMonthPeriodKey(new Date('2027-01-01T04:30:00Z')), '2026-12');
});

const action = (direction: 'owe' | 'owed', amount: number, currency = 'INR'): ReminderAction => ({
  direction,
  group_id: 'g',
  group_name: 'Trip',
  counterparty_name: 'A',
  counterparty_email: 'a@example.com',
  amount,
  currency,
});

Deno.test('summary totals owe and owed per currency', () => {
  assertEquals(
    summarizeReminderActions([action('owe', 100), action('owe', 50.5), action('owed', 20, 'USD')]),
    { owe: '₹150.50', owed: 'USD 20' },
  );
  assertEquals(summarizeReminderActions([action('owed', 80)]), { owe: '₹0', owed: '₹80' });
});

Deno.test('payload uses the monthly template with four body params', () => {
  const payload = buildMonthlyReminderPayload({
    to: '+919876543210',
    name: firstNameForReminder('Priya Sharma'),
    periodKey: '2026-10',
    summary: { owe: '₹1250', owed: '₹800' },
    config: { templateName: 'sharedmoney_monthly_balance', templateLang: 'en' },
  });
  assertEquals(payload.to, '919876543210');
  assertEquals(payload.template.name, 'sharedmoney_monthly_balance');
  const body = payload.template.components[0];
  assertEquals(body.parameters.map((p) => p.text), ['Priya', 'October 2026', '₹1250', '₹800']);
});

Deno.test('reserve errors: budget stops the batch, duplicate skips', () => {
  assertEquals(classifyReminderReserveError('WHATSAPP_REMINDER_BUDGET_RESERVE'), 'budget_reserve');
  assertEquals(classifyReminderReserveError('WHATSAPP_REMINDER_DUPLICATE'), 'duplicate');
  assertEquals(classifyReminderReserveError('connection reset'), 'error');
});

Deno.test('phones are masked for logs', () => {
  assertEquals(maskPhone('+919876543210'), '+91******3210');
  assertEquals(firstNameForReminder('  '), 'there');
});
