import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  resolveWhatsAppReminderToggleState as resolve,
  WHATSAPP_REMINDER_HELPER,
  WHATSAPP_REMINDER_NEEDS_PHONE,
  WHATSAPP_REMINDER_NOT_INDIA,
  WHATSAPP_REMINDER_SAVE_FAILED,
  WHATSAPP_REMINDER_SAVED_ON,
  WHATSAPP_REMINDER_SAVING,
} from "./whatsappReminderToggle.ts";

Deno.test("no phone: disabled with add-phone helper", () => {
  const s = resolve({ hasPhone: false, isIndiaNumber: true, value: false });
  assertEquals([s.enabled, s.helper], [false, WHATSAPP_REMINDER_NEEDS_PHONE]);
});

Deno.test("non +91 country: disabled with +91 helper", () => {
  const s = resolve({ hasPhone: true, isIndiaNumber: false, value: true });
  assertEquals([s.enabled, s.helper], [false, WHATSAPP_REMINDER_NOT_INDIA]);
});

Deno.test("+91 phone: enabled with default helper", () => {
  const s = resolve({ hasPhone: true, isIndiaNumber: true, value: false });
  assertEquals([s.enabled, s.helper, s.status], [true, WHATSAPP_REMINDER_HELPER, null]);
});

Deno.test("save feedback states", () => {
  const base = { hasPhone: true, isIndiaNumber: true, value: true };
  assertEquals(resolve({ ...base, saveState: "saving" }).status, WHATSAPP_REMINDER_SAVING);
  assertEquals(resolve({ ...base, saveState: "saved" }).status, WHATSAPP_REMINDER_SAVED_ON);
  const failed = resolve({ ...base, value: false, saveState: "failed" });
  assertEquals([failed.status, failed.statusIsError], [WHATSAPP_REMINDER_SAVE_FAILED, true]);
});

Deno.test("copy has no em dashes or beta", () => {
  for (const text of [WHATSAPP_REMINDER_HELPER, WHATSAPP_REMINDER_NEEDS_PHONE, WHATSAPP_REMINDER_NOT_INDIA, WHATSAPP_REMINDER_SAVE_FAILED]) {
    assertEquals(/\u2014|beta/i.test(text), false);
  }
});
