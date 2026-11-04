import React from "react";
import { StyleSheet, View } from "react-native";
import { Switch, Text, useTheme } from "react-native-paper";

import {
  resolveWhatsAppReminderToggleState,
  WHATSAPP_REMINDER_TITLE,
  type WhatsAppReminderToggleProps,
} from "../utils/whatsappReminderToggle";

export type { WhatsAppReminderSaveState } from "../utils/whatsappReminderToggle";

/** Owner-only opt-in for monthly WhatsApp balance reminders (#419). Saves on flip. */
export function WhatsAppReminderToggle(props: WhatsAppReminderToggleProps) {
  const theme = useTheme();
  const { enabled, helper, status, statusIsError } = resolveWhatsAppReminderToggleState(props);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
            {WHATSAPP_REMINDER_TITLE}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {helper}
          </Text>
        </View>
        <Switch
          value={props.value && enabled}
          disabled={props.disabled || !enabled || props.saveState === "saving"}
          onValueChange={props.onValueChange}
          testID="profile-whatsapp-reminders-switch"
          accessibilityLabel={WHATSAPP_REMINDER_TITLE}
        />
      </View>
      {status ? (
        <Text
          variant="bodySmall"
          accessibilityLiveRegion="polite"
          testID="profile-whatsapp-reminders-status"
          style={{ color: statusIsError ? theme.colors.error : theme.colors.primary, marginTop: 4 }}
        >
          {status}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center" },
  copy: { flex: 1, paddingRight: 12, justifyContent: "center" },
});
