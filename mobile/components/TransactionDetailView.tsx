import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Button, Text, useTheme } from "react-native-paper";
import type { TransactionDetailModel } from "../utils/transactionDetail";

interface TransactionDetailViewProps {
  model: TransactionDetailModel;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
  historyOpen: boolean;
  historyLoading: boolean;
  historyLines: string[];
  onToggleHistory: () => void;
}

export function TransactionDetailView({
  model,
  canEdit,
  onBack,
  onEdit,
  historyOpen,
  historyLoading,
  historyLines,
  onToggleHistory,
}: TransactionDetailViewProps) {
  const theme = useTheme();
  const muted = { color: theme.colors.onSurfaceVariant };
  const hairline = {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.outlineVariant,
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]} testID="transaction-detail">
      <Appbar.Header style={{ backgroundColor: theme.colors.background }}>
        <Appbar.BackAction onPress={onBack} accessibilityLabel="Navigate back" testID="detail-back" />
        <View style={{ flex: 1 }} />
        {canEdit ? (
          <Button
            mode="text"
            onPress={onEdit}
            testID="detail-edit"
            accessibilityLabel="Edit"
          >
            Edit
          </Button>
        ) : null}
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleMedium" style={{ fontWeight: "600", color: theme.colors.onSurface }}>
          {model.title}
        </Text>
        <Text
          testID="detail-amount"
          style={[styles.amount, { color: theme.colors.onSurface }]}
        >
          {model.amountText}
        </Text>
        <Text variant="bodySmall" testID="detail-meta" style={muted}>
          {model.meta}
        </Text>
        {model.rateLine ? (
          <Text variant="bodySmall" testID="detail-rate" style={[muted, { marginTop: 4 }]}>
            {model.rateLine}
          </Text>
        ) : null}
        <Text
          variant="titleMedium"
          testID="detail-your-line"
          style={{ marginTop: 28, fontWeight: "500", color: theme.colors.onSurface }}
        >
          {model.yourLine}
        </Text>
        <View style={[styles.pair, hairline]}>
          <Text variant="bodyMedium" style={muted}>Paid by</Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>{model.paidByName}</Text>
        </View>
        {model.paidToName ? (
          <View style={[styles.pair, hairline]}>
            <Text variant="bodyMedium" style={muted}>Paid to</Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>{model.paidToName}</Text>
          </View>
        ) : null}
        {model.split?.kind === "equal" ? (
          <View style={styles.split}>
            <Text variant="bodyMedium" testID="detail-split-line" style={muted}>
              {model.split.line}
            </Text>
            {model.split.names.map((name, index) => (
              <Text
                key={`${name}-${index}`}
                variant="bodyLarge"
                style={{ color: theme.colors.onSurface, marginTop: 10 }}
              >
                {name}
              </Text>
            ))}
          </View>
        ) : null}
        {model.split?.kind === "people" ? (
          <View style={styles.split}>
            <Text variant="bodyMedium" style={muted}>{model.split.label}</Text>
            {model.split.rows.map((row) => (
              <View key={row.key} style={styles.person}>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, flex: 1 }}>{row.name}</Text>
                {row.amountText ? (
                  <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>{row.amountText}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.history}>
          <Text
            variant="bodySmall"
            onPress={onToggleHistory}
            accessibilityRole="button"
            testID="detail-history"
            style={muted}
          >
            {historyOpen ? "History" : model.historySeed}
          </Text>
          {historyOpen && historyLoading ? (
            <Text variant="bodySmall" style={[muted, { marginTop: 8 }]}>Loading history…</Text>
          ) : null}
          {historyOpen && !historyLoading
            ? historyLines.map((line, index) => (
              <Text key={`${index}-${line}`} variant="bodySmall" style={[muted, { marginTop: 8 }]}>{line}</Text>
            ))
            : null}
          {historyOpen && !historyLoading && historyLines.length === 0 ? (
            <Text variant="bodySmall" style={[muted, { marginTop: 8 }]}>No edits yet</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  amount: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: "600",
    marginTop: 8,
  },
  pair: {
    marginTop: 28,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  split: {
    marginTop: 20,
  },
  person: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 12,
  },
  history: {
    marginTop: 36,
  },
});
