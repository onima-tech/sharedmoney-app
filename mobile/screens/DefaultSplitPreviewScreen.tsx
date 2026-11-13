import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { GroupDefaultSplitSheet } from "../components/GroupDefaultSplitSheet";
import { SplitAmongEditor } from "../components/SplitAmongEditor";
import { Participant } from "../types";
import { getCurrencySymbol } from "../utils/currency";
import {
  readDefaultSplitShot,
  type DefaultSplitShot,
} from "../utils/defaultSplitShots";
import {
  newExpenseSplitFromGroupDefault,
  storedExpenseSplitState,
} from "../utils/groupSplit";

export type { DefaultSplitShot };
export { readDefaultSplitShot };

const YOU = "you";
const AISHA = "aisha";
const DEV = "dev";
const GROUP = "flat-4b";

const PEOPLE: Participant[] = [
  { id: AISHA, group_id: GROUP, type: "member", full_name: "Aisha", email: "aisha@example.com" },
  { id: DEV, group_id: GROUP, type: "member", full_name: "Dev", email: "dev@example.com" },
  { id: YOU, group_id: GROUP, type: "member", full_name: "You", email: "you@example.com" },
];

const WEIGHTS = { [AISHA]: 2, [DEV]: 1, [YOU]: 1 };

const FRIDAY_DINNER = {
  id: 42,
  amount: 900,
  description: "Friday dinner",
  splits: [
    { participant_id: AISHA, amount: 300 },
    { participant_id: DEV, amount: 300 },
    { participant_id: YOU, amount: 300 },
  ],
};

export function DefaultSplitPreviewScreen({ shot }: { shot: DefaultSplitShot }) {
  if (shot === "settings-equal" || shot === "settings-weights") {
    return (
      <GroupDefaultSplitSheet
        visible
        embedded
        groupName="Flat 4B"
        participants={PEOPLE}
        mode={shot === "settings-weights" ? "weights" : "equal"}
        weights={shot === "settings-weights" ? WEIGHTS : {}}
        onDismiss={() => {}}
        onSave={() => {}}
      />
    );
  }

  return <ExpensePreview shot={shot} />;
}

function ExpensePreview({ shot }: { shot: DefaultSplitShot }) {
  const theme = useTheme();
  const currency = "INR";
  const prefill = newExpenseSplitFromGroupDefault({
    groupDefault: { mode: "weights", weights: WEIGHTS },
    availableParticipantIds: PEOPLE.map((person) => person.id),
  });
  const stored = storedExpenseSplitState(FRIDAY_DINNER);
  const editing = shot === "expense-unchanged";
  const initial = editing
    ? stored
    : shot === "expense-changed"
      ? {
          mode: "unequal" as const,
          selectedIds: prefill.selectedIds,
          shares: prefill.shares,
          amounts: {
            [AISHA]: "500.00",
            [DEV]: "250.00",
            [YOU]: "150.00",
          },
        }
      : {
          mode: prefill.mode,
          selectedIds: prefill.selectedIds,
          shares: prefill.shares,
          amounts: {} as Record<string, string>,
        };

  const [mode, setMode] = useState(initial.mode);
  const [selectedIds, setSelectedIds] = useState(initial.selectedIds);
  const [shares, setShares] = useState(initial.shares);
  const [amounts, setAmounts] = useState(initial.amounts);
  const description = editing ? FRIDAY_DINNER.description : "Groceries";
  const amount = "900";
  const areAllSelected = PEOPLE.every((person) => selectedIds.includes(person.id));

  const split = useMemo(() => ({ mode, selectedIds, shares, amounts }), [amounts, mode, selectedIds, shares]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]} edges={["top", "left", "right"]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.background }} elevated={false}>
        <IconButton icon="arrow-left" iconColor={theme.colors.onSurface} accessibilityLabel="Navigate back" />
        <Appbar.Content title={editing ? "Edit Expense" : "Add Expense"} titleStyle={{ fontWeight: "600" }} />
        {editing ? (
          <Appbar.Action icon="delete-outline" iconColor={theme.colors.error} accessibilityLabel="Delete expense" />
        ) : null}
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text variant="displayMedium" style={{ color: theme.colors.onSurface, fontWeight: "300" }}>
            {getCurrencySymbol(currency)}{amount}
          </Text>
          <Chip mode="outlined" style={{ marginTop: 12 }}>{currency}</Chip>
        </View>

        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <TextInput
              label="Description"
              value={description}
              mode="flat"
              onChangeText={() => {}}
              left={<TextInput.Icon icon="pencil-outline" />}
            />
            <Divider style={styles.divider} />
            <View style={styles.row}>
              <IconButton icon="calendar-outline" size={24} />
              <View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Date</Text>
                <Text variant="bodyLarge">Fri, Nov 13</Text>
              </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.row}>
              <IconButton icon="tag-outline" size={24} />
              <View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Category</Text>
                <Text variant="bodyLarge">{editing ? "Food" : "Groceries"}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
              Paid by
            </Text>
            <View style={styles.chips}>
              {PEOPLE.map((person) => (
                <Chip key={person.id} selected={person.id === YOU} showSelectedCheck>
                  {person.full_name}
                </Chip>
              ))}
            </View>
            <Divider style={styles.divider} />
            <SplitAmongEditor
              participants={PEOPLE}
              selectedIds={split.selectedIds}
              amounts={split.amounts}
              shares={split.shares}
              mode={split.mode}
              totalAmount={900}
              currency={currency}
              areAllSelected={areAllSelected}
              onToggleMember={(participantId) => {
                setSelectedIds((current) => current.includes(participantId)
                  ? current.filter((id) => id !== participantId)
                  : [...current, participantId]);
              }}
              onToggleAll={() => setSelectedIds(PEOPLE.map((person) => person.id))}
              onModeChange={setMode}
              onAmountChange={(participantId, text) => {
                setAmounts((current) => ({ ...current, [participantId]: text }));
              }}
              onShareChange={(participantId, next) => {
                setShares((current) => ({ ...current, [participantId]: next }));
              }}
              onSplitRemaining={() => {}}
            />
          </Card.Content>
        </Card>
      </ScrollView>
      <Surface style={[styles.footer, { backgroundColor: theme.colors.elevation.level2 }]} elevation={2}>
        <Button mode="contained" testID="save-expense-button">
          {editing ? "Update" : "Save expense"}
        </Button>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 24,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
  },
  divider: {
    marginVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});
