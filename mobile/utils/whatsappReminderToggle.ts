/** Copy and enabled-state rules for the Profile WhatsApp summary toggle (#419). */
export const WHATSAPP_REMINDER_TITLE = "Monthly WhatsApp summary";
export const WHATSAPP_REMINDER_HELPER = "What you owe and are owed, once a month.";
export const WHATSAPP_REMINDER_NEEDS_PHONE = "Add a phone number to turn this on.";
export const WHATSAPP_REMINDER_NOT_INDIA = "Only for +91 numbers for now.";
export const WHATSAPP_REMINDER_SAVING = "Saving...";
export const WHATSAPP_REMINDER_SAVED_ON = "Saved. You will get a summary each month.";
export const WHATSAPP_REMINDER_SAVED_OFF = "Saved. Monthly summary is off.";
export const WHATSAPP_REMINDER_SAVE_FAILED = "Could not save. Check your connection and try again.";

export type WhatsAppReminderSaveState = "idle" | "saving" | "saved" | "failed";

export interface WhatsAppReminderToggleProps {
  hasPhone: boolean;
  isIndiaNumber: boolean;
  value: boolean;
  saveState?: WhatsAppReminderSaveState;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}

/** Pure copy/enabled resolution so it can be unit tested. */
export function resolveWhatsAppReminderToggleState(
  props: Pick<WhatsAppReminderToggleProps, "hasPhone" | "isIndiaNumber" | "value" | "saveState">,
): { enabled: boolean; helper: string; status: string | null; statusIsError: boolean } {
  const enabled = props.hasPhone && props.isIndiaNumber;
  const helper = !props.hasPhone
    ? WHATSAPP_REMINDER_NEEDS_PHONE
    : !props.isIndiaNumber
      ? WHATSAPP_REMINDER_NOT_INDIA
      : WHATSAPP_REMINDER_HELPER;
  let status: string | null = null;
  if (enabled && props.saveState === "saving") status = WHATSAPP_REMINDER_SAVING;
  if (enabled && props.saveState === "saved") {
    status = props.value ? WHATSAPP_REMINDER_SAVED_ON : WHATSAPP_REMINDER_SAVED_OFF;
  }
  if (props.saveState === "failed") status = WHATSAPP_REMINDER_SAVE_FAILED;
  return { enabled, helper, status, statusIsError: props.saveState === "failed" };
}

