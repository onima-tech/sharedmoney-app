import React from "react";
import { StyleSheet, View } from "react-native";
import { Switch, Text, useTheme } from "react-native-paper";

export const WHATSAPP_REMINDER_TITLE = "Monthly WhatsApp summary";
export const WHATSAPP_REMINDER_HELPER =
  "One message a month on WhatsApp with what you owe and what you are owed. Indian (+91) numbers only.";
export const WHATSAPP_REMINDER_NEEDS_PHONE =
  "Add your phone number to get a monthly summary on WhatsApp.";

interface Props {
  hasPhone: boolean;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}

/** Owner-only opt-in for monthly WhatsApp balance reminders (#419). */
export function WhatsAppReminderToggle({ hasPhone, value, disabled, onValueChange }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
          {WHATSAPP_REMINDER_TITLE}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {hasPhone ? WHATSAPP_REMINDER_HELPER : WHATSAPP_REMINDER_NEEDS_PHONE}
        </Text>
      </View>
      <Switch
        value={value && hasPhone}
        disabled={disabled || !hasPhone}
        onValueChange={onValueChange}
        testID="profile-whatsapp-reminders-switch"
        accessibilityLabel={WHATSAPP_REMINDER_TITLE}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  copy: { flex: 1, paddingRight: 12 },
});
