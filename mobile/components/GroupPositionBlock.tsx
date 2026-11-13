import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import type { GroupPosition } from "../utils/groupPosition";

interface GroupPositionBlockProps {
  state: "placeholder" | "error" | GroupPosition;
  onSentencePress?: () => void;
  onSettle?: () => void;
  onRemind?: () => void;
  onRetry?: () => void;
  onShowOneCurrency?: () => void;
}

export function GroupPositionBlock({
  state,
  onSentencePress,
  onSettle,
  onRemind,
  onRetry,
  onShowOneCurrency,
}: GroupPositionBlockProps) {
  const theme = useTheme();
  const muted = { color: theme.colors.onSurfaceVariant };

  if (state === "placeholder") {
    return (
      <View style={styles.block} testID="group-position-block">
        <View
          testID="group-position-placeholder"
          style={[styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}
        />
      </View>
    );
  }

  if (state === "error") {
    return (
      <View style={styles.block} testID="group-position-block">
        <Text
          variant="bodyMedium"
          accessibilityLiveRegion="polite"
          testID="balances-error-line"
          style={muted}
        >
          Couldn’t load balances
          {" · "}
          <Text
            variant="bodyMedium"
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading balances"
            testID="balances-error-retry"
            style={{ color: theme.colors.primary, fontWeight: "600" }}
          >
            Retry
          </Text>
        </Text>
      </View>
    );
  }

  if (state.kind === "uncombined") {
    return (
      <View style={styles.block} testID="group-position-block">
        <Text
          variant="bodyMedium"
          onPress={onShowOneCurrency}
          accessibilityRole="button"
          testID="group-position-uncombined"
          style={muted}
        >
          {state.prompt}
        </Text>
        {state.showSettle ? (
          <SettleActions showRemind={state.showRemind} onSettle={onSettle} onRemind={onRemind} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.block} testID="group-position-block">
      <Text variant="bodyMedium" testID="group-position-label" style={muted}>
        {state.label}
      </Text>
      <Text
        testID="group-position-amount"
        accessibilityLabel={`${state.label} ${state.amountText}`}
        style={[styles.amount, { color: theme.colors.onSurface }]}
      >
        {state.amountText}
      </Text>
      {state.sentence ? (
        <Text
          variant="bodyMedium"
          onPress={onSentencePress}
          accessibilityRole="button"
          accessibilityHint="Opens settle"
          testID="group-position-sentence"
          style={[styles.sentence, muted]}
        >
          {state.sentence}
        </Text>
      ) : null}
      {state.showSettle ? (
        <SettleActions showRemind={state.showRemind} onSettle={onSettle} onRemind={onRemind} />
      ) : null}
    </View>
  );
}

function SettleActions({
  showRemind,
  onSettle,
  onRemind,
}: {
  showRemind: boolean;
  onSettle?: () => void;
  onRemind?: () => void;
}) {
  return (
    <View style={styles.actions}>
      <Button
        mode="contained"
        onPress={onSettle}
        testID="settle-up-button"
        accessibilityLabel="Settle up"
        style={styles.settle}
        contentStyle={styles.settleContent}
      >
        Settle up
      </Button>
      {showRemind ? (
        <Button
          mode="text"
          onPress={onRemind}
          testID="remind-button"
          accessibilityLabel="Remind"
        >
          Remind
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  placeholder: {
    width: 148,
    height: 40,
    borderRadius: 8,
    opacity: 0.55,
  },
  amount: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  sentence: {
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 4,
  },
  settle: {
    borderRadius: 22,
  },
  settleContent: {
    paddingHorizontal: 8,
    height: 40,
  },
});
