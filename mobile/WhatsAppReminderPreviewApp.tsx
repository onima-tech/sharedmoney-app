/**
 * Local design-review preview for the Profile "Monthly WhatsApp summary"
 * toggle (#419). Renders the real WhatsAppReminderToggle between the same
 * phone and UPI fields used on ProfileSetupScreen.
 *
 * Web: EXPO_PUBLIC_WA_REMINDER_UI_PREVIEW=1 npx expo start --web
 *   then ?waPreview=no-phone|off|on
 * Never set in Production store/OTA builds.
 */
import React, { useMemo, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { Icon, PaperProvider, Text, TextInput } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WhatsAppReminderToggle } from "./components/WhatsAppReminderToggle";
import { lightTheme } from "./theme";

type Kind = "no-phone" | "off" | "on";

function resolveKind(): Kind {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("waPreview");
    if (q === "no-phone" || q === "off" || q === "on") return q;
  }
  return "off";
}

export default function WhatsAppReminderPreviewApp() {
  const theme = useMemo(() => lightTheme, []);
  const kind = resolveKind();
  const [phone, setPhone] = useState(kind === "no-phone" ? "" : "98765 43210");
  const [on, setOn] = useState(kind === "on");

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
          contentContainerStyle={{ padding: 24, maxWidth: 560, width: "100%", alignSelf: "center" }}
          testID={`wa-reminder-preview-${kind}`}
        >
          <Text variant="headlineSmall" style={{ marginBottom: 16, color: theme.colors.onBackground }}>
            Profile
          </Text>
          <TextInput label="Full Name" value="Priya Sharma" mode="outlined" style={{ marginBottom: 16 }} />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 10,
                height: 56,
                marginRight: 8,
                borderWidth: 1,
                borderRadius: 4,
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surfaceVariant,
              }}
            >
              <Text>🇮🇳</Text>
              <Text variant="bodySmall" style={{ marginHorizontal: 4 }}>+91</Text>
              <Icon source="chevron-down" size={18} />
            </View>
            <TextInput
              label="Phone Number (Optional)"
              value={phone}
              onChangeText={setPhone}
              mode="outlined"
              style={{ flex: 1 }}
              keyboardType="phone-pad"
            />
          </View>
          <WhatsAppReminderToggle hasPhone={!!phone.trim()} value={on} onValueChange={setOn} />
          <TextInput
            label="UPI ID"
            value="priya@okhdfc"
            mode="outlined"
            left={<TextInput.Icon icon="bank" />}
            style={{ marginBottom: 16 }}
          />
        </ScrollView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
