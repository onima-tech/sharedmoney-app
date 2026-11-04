/**
 * WhatsApp monthly balance reminders (#419): pure helpers.
 *
 * Reminders share the WhatsApp monthly INR budget with OTP sign-in
 * (`whatsapp_otp_sends` ledger). OTP has priority: reminders stop once the
 * remaining budget would drop below WHATSAPP_REMINDER_RESERVE_INR.
 */
import type { ReminderAction } from './monthly-reminders.ts';
import { getPeriodLabel } from './monthly-reminders.ts';
import {
  DEFAULT_WHATSAPP_MONTHLY_BUDGET_INR,
  WHATSAPP_MONTHLY_BUDGET_INR_ENV,
} from './whatsapp-otp.ts';
import { toWhatsAppRecipient, type WhatsAppTemplateMessagePayload } from './whatsapp.ts';

export const WHATSAPP_REMINDERS_FEATURE_ENV = 'ENABLE_WHATSAPP_MONTHLY_REMINDERS';
export const WHATSAPP_REMINDER_COST_INR_ENV = 'WHATSAPP_REMINDER_COST_INR';
export const WHATSAPP_REMINDER_RESERVE_INR_ENV = 'WHATSAPP_REMINDER_RESERVE_INR';
export const WHATSAPP_MONTHLY_REMINDER_TEMPLATE_ENV = 'WHATSAPP_MONTHLY_REMINDER_TEMPLATE_NAME';

export const DEFAULT_MONTHLY_REMINDER_TEMPLATE_NAME = 'sharedmoney_monthly_balance';
export const DEFAULT_MONTHLY_REMINDER_TEMPLATE_LANG = 'en';
/** Meta India utility template estimate incl. GST, rounded up. */
export const DEFAULT_WHATSAPP_REMINDER_COST_INR = 0.16;
/** Budget kept free for OTP sign-in. */
export const DEFAULT_WHATSAPP_REMINDER_RESERVE_INR = 100;

export const REMINDER_BUDGET_RESERVE_ERROR = 'WHATSAPP_REMINDER_BUDGET_RESERVE';
export const REMINDER_DUPLICATE_ERROR = 'WHATSAPP_REMINDER_DUPLICATE';

export interface WhatsAppReminderConfig {
  monthlyBudgetInr: number;
  costInr: number;
  reserveInr: number;
  templateName: string;
  templateLang: string;
}

export interface ReminderBalanceSummary {
  owe: string;
  owed: string;
}

/** Flag defaults OFF. Only the exact string "true" turns live sends on. */
export function isWhatsAppRemindersEnabled(env: Deno.Env = Deno.env): boolean {
  return env.get(WHATSAPP_REMINDERS_FEATURE_ENV)?.trim() === 'true';
}

function parseNonNegative(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === '') return fallback;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Invalid explicit values fail closed (null: caller must not send). */
export function resolveWhatsAppReminderConfig(
  env: Deno.Env = Deno.env,
): WhatsAppReminderConfig | null {
  const budget = parseNonNegative(
    env.get(WHATSAPP_MONTHLY_BUDGET_INR_ENV),
    DEFAULT_WHATSAPP_MONTHLY_BUDGET_INR,
  );
  const cost = parseNonNegative(
    env.get(WHATSAPP_REMINDER_COST_INR_ENV),
    DEFAULT_WHATSAPP_REMINDER_COST_INR,
  );
  const reserve = parseNonNegative(
    env.get(WHATSAPP_REMINDER_RESERVE_INR_ENV),
    DEFAULT_WHATSAPP_REMINDER_RESERVE_INR,
  );
  if (budget === null || cost === null || reserve === null) return null;
  if (budget <= 0 || cost <= 0 || reserve >= budget) return null;
  return {
    monthlyBudgetInr: budget,
    costInr: cost,
    reserveInr: reserve,
    templateName: env.get(WHATSAPP_MONTHLY_REMINDER_TEMPLATE_ENV)?.trim() ||
      DEFAULT_MONTHLY_REMINDER_TEMPLATE_NAME,
    templateLang: DEFAULT_MONTHLY_REMINDER_TEMPLATE_LANG,
  };
}

/** Normalise a stored profile phone to +91 E.164, or null if not an Indian mobile. */
export function normalizeIndianWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw.replace(/[\s\-().]/g, '');
  const withPlus = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  return /^\+91[6-9]\d{9}$/.test(withPlus) ? withPlus : null;
}

/** Previous calendar month in IST, as YYYY-MM. */
export function getPreviousIstMonthPeriodKey(now = new Date()): string {
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  const prev = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatAmount(amount: number, currency: string): string {
  const fixed = amount.toFixed(2).replace(/\.00$/, '');
  return currency.toUpperCase() === 'INR' ? `₹${fixed}` : `${currency.toUpperCase()} ${fixed}`;
}

function sumByCurrency(actions: ReminderAction[], direction: 'owe' | 'owed'): string {
  const totals = new Map<string, number>();
  for (const action of actions) {
    if (action.direction !== direction) continue;
    totals.set(action.currency, (totals.get(action.currency) || 0) + action.amount);
  }
  if (totals.size === 0) return formatAmount(0, 'INR');
  return [...totals.entries()]
    .sort(([a], [b]) => (a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b)))
    .map(([currency, amount]) => formatAmount(Math.round(amount * 100) / 100, currency))
    .join(' + ');
}

export function summarizeReminderActions(actions: ReminderAction[]): ReminderBalanceSummary {
  return { owe: sumByCurrency(actions, 'owe'), owed: sumByCurrency(actions, 'owed') };
}

export function firstNameForReminder(fullName: string | null | undefined): string {
  const first = (fullName || '').trim().split(/\s+/)[0];
  return first ? first.slice(0, 40) : 'there';
}

export function buildMonthlyReminderPayload(input: {
  to: string;
  name: string;
  periodKey: string;
  summary: ReminderBalanceSummary;
  config: Pick<WhatsAppReminderConfig, 'templateName' | 'templateLang'>;
}): WhatsAppTemplateMessagePayload {
  const text = (value: string) => ({ type: 'text' as const, text: value });
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWhatsAppRecipient(input.to),
    type: 'template',
    template: {
      name: input.config.templateName,
      language: { code: input.config.templateLang },
      components: [
        {
          type: 'body',
          parameters: [
            text(input.name),
            text(getPeriodLabel(input.periodKey)),
            text(input.summary.owe),
            text(input.summary.owed),
          ],
        },
      ],
    },
  };
}

export type ReserveOutcome = 'reserved' | 'budget_reserve' | 'duplicate' | 'error';

export function classifyReminderReserveError(message: string): ReserveOutcome {
  const text = message.toUpperCase();
  if (text.includes(REMINDER_BUDGET_RESERVE_ERROR) || text.includes('WHATSAPP_BUDGET_EXHAUSTED')) {
    return 'budget_reserve';
  }
  if (text.includes(REMINDER_DUPLICATE_ERROR)) return 'duplicate';
  return 'error';
}

/** Mask a phone for logs: +91******1234. */
export function maskPhone(e164: string): string {
  return e164.length > 7 ? `${e164.slice(0, 3)}${'*'.repeat(e164.length - 7)}${e164.slice(-4)}` : '***';
}
