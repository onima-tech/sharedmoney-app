import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Dialog, Portal, Text, TouchableRipple, useTheme } from "react-native-paper";

type ExportKind = "csv" | "pdf";

type GroupExportSheetProps = {
  visible: boolean;
  groupName: string;
  pdfAvailable: boolean;
  busy: ExportKind | null;
  onDismiss: () => void;
  onExport: (kind: ExportKind) => void;
};

export function GroupExportSheet({
  visible,
  groupName,
  pdfAvailable,
  busy,
  onDismiss,
  onExport,
}: GroupExportSheetProps) {
  const theme = useTheme();
  const name = groupName.trim() || "This group";
  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={busy ? () => undefined : onDismiss}
        testID="group-export-dialog"
        style={styles.dialog}
      >
        <Dialog.Title>Export</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {name}
          </Text>
          <ExportChoice
            icon="file-delimited-outline"
            title="CSV"
            subtitle="Every expense and settlement"
            testID="export-csv"
            disabled={busy != null}
            loading={busy === "csv"}
            onPress={() => onExport("csv")}
          />
          {pdfAvailable ? (
            <ExportChoice
              icon="file-pdf-box"
              title="PDF"
              subtitle="Totals, balances, and settle-up"
              testID="export-pdf"
              disabled={busy != null}
              loading={busy === "pdf"}
              onPress={() => onExport("pdf")}
            />
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <TouchableRipple
            onPress={onDismiss}
            disabled={busy != null}
            accessibilityRole="button"
            accessibilityLabel="Close export"
            testID="export-close"
            style={styles.close}
          >
            <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Close</Text>
          </TouchableRipple>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function ExportChoice({
  icon,
  title,
  subtitle,
  testID,
  disabled,
  loading,
  onPress,
}: {
  icon: "file-delimited-outline" | "file-pdf-box";
  title: string;
  subtitle: string;
  testID: string;
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <TouchableRipple
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Export ${title}`}
      testID={testID}
      style={[styles.choice, { borderColor: theme.colors.outlineVariant }]}
    >
      <View style={styles.choiceRow}>
        <MaterialCommunityIcons name={icon} size={22} color={theme.colors.primary} />
        <View style={styles.choiceCopy}>
          <Text variant="titleMedium">{title}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{subtitle}</Text>
        </View>
        {loading ? <ActivityIndicator size={18} /> : null}
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 360,
    alignSelf: "center",
    width: "100%",
  },
  choice: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  choiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  choiceCopy: {
    flex: 1,
  },
  close: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
