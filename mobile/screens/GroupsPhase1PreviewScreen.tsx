import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Appbar, FAB, Text, useTheme } from "react-native-paper";
import { BottomNavBar } from "../components/BottomNavBar";
import { GroupBalanceBadge } from "../components/GroupBalanceBadge";
import { GroupDashboard } from "../components/GroupDashboard";
import { LedgerDateLabel, LedgerRow } from "../components/TransactionsSection";
import { TransactionSearchField } from "../components/TransactionSearchField";
import type { Participant, Settlement, Transaction } from "../types";
import {
  phase1ShotKeepsLedger,
  phase1ShotShowsAddExpense,
  readGroupsPhase1Shot,
  type GroupsPhase1Shot,
} from "../utils/groupsPhase1Shots";
import { groupByLedgerDateSection } from "../utils/ledgerDateSections";
import { OPTIMISTIC_TRANSACTION_ID_MIN } from "../utils/transactionOptimisticCache";
import { buildTransactionsLedger, type LedgerItem } from "../utils/transactionsLedger";
import {
  LOADED_ROWS_SEARCH_NOTE,
  SEARCHING_TRANSACTIONS_LINE,
  transactionSearchEmptyMessage,
  type TransactionSearchFilter,
} from "../utils/transactionSearch";

export type { GroupsPhase1Shot };
export { readGroupsPhase1Shot };

const VIEWER = "me";

const participants: Participant[] = [
  { id: "p-me", group_id: "g", user_id: VIEWER, type: "member", full_name: "You" },
  { id: "p-rahul", group_id: "g", user_id: "rahul", type: "member", full_name: "Rahul" },
  { id: "p-meera", group_id: "g", user_id: "meera", type: "member", full_name: "Meera" },
];

function expense(
  id: number,
  description: string,
  date: string,
  amount: number,
  payer: string,
  splits: Transaction["splits"],
  currency = "INR",
): Transaction {
  return {
    id,
    description,
    date,
    amount,
    type: "expense",
    currency,
    paid_by: payer === "p-me" ? VIEWER : payer,
    paid_by_participant_id: payer,
    splits,
  };
}

const dinner = expense(1, "Dinner at Thalassa", "2026-11-12", 4800, "p-rahul", [
  { participant_id: "p-me", user_id: VIEWER, amount: 1200 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 2400 },
  { participant_id: "p-meera", user_id: "meera", amount: 1200 },
]);
const scooter = expense(2, "Scooter rental", "2026-11-12", 2100, "p-me", [
  { participant_id: "p-me", user_id: VIEWER, amount: 700 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 700 },
  { participant_id: "p-meera", user_id: "meera", amount: 700 },
]);
const taxi = expense(3, "Taxi to airport", "2026-11-11", 900, "p-meera", [
  { participant_id: "p-meera", user_id: "meera", amount: 450 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 450 },
]);

const groceries = expense(
  OPTIMISTIC_TRANSACTION_ID_MIN,
  "Groceries",
  "2026-11-12",
  600,
  "p-me",
  [{ participant_id: "p-me", user_id: VIEWER, amount: 0 }],
);
const beach = expense(50, "Beach shack", "2026-11-12", 1200, "p-me", [
  { participant_id: "p-me", user_id: VIEWER, amount: 400 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 400 },
  { participant_id: "p-meera", user_id: "meera", amount: 400 },
], "THB");

const payment: Settlement = {
  id: "pay-1",
  group_id: "g",
  from_user_id: "rahul",
  to_user_id: VIEWER,
  from_participant_id: "p-rahul",
  to_participant_id: "p-me",
  amount: 1000,
  currency: "INR",
  created_by: "rahul",
  created_at: "2026-11-11T18:00:00",
};

function expensesFor(shot: GroupsPhase1Shot): Transaction[] {
  switch (shot) {
    case "empty":
    case "offline":
      return [];
    case "search":
      return [taxi];
    case "payment":
      return [dinner, scooter];
    case "saving":
      return [groceries, dinner, scooter];
    case "mixed":
      return [beach, dinner, scooter];
    case "ready":
    case "fab":
    case "balances":
      return [dinner, scooter, taxi];
    default: {
      const _exhaustive: never = shot;
      return _exhaustive;
    }
  }
}

function paymentsFor(shot: GroupsPhase1Shot): Settlement[] {
  switch (shot) {
    case "empty":
    case "offline":
    case "search":
    case "saving":
    case "mixed":
      return [];
    case "ready":
    case "fab":
    case "payment":
    case "balances":
      return [payment];
    default: {
      const _exhaustive: never = shot;
      return _exhaustive;
    }
  }
}

function ledgerFor(shot: GroupsPhase1Shot): LedgerItem[] {
  if (!phase1ShotKeepsLedger(shot)) return [];
  return buildTransactionsLedger(expensesFor(shot), paymentsFor(shot), "all");
}

/**
 * __DEV__ fixture for phase-1 screenshots. Renders the same row, search, and
 * dashboard components as the group screen, with no network.
 */
export function GroupsPhase1PreviewScreen({ shot }: { shot: GroupsPhase1Shot }) {
  const theme = useTheme();
  const searching = shot === "search" || shot === "empty";
  const [query, setQuery] = useState(searching ? "taxi" : "");
  const [filter, setFilter] = useState<TransactionSearchFilter>("all");
  const [open, setOpen] = useState(searching);
  const items = ledgerFor(shot);
  const showFab = phase1ShotShowsAddExpense(shot);
  const showBalancesError = shot === "balances";

  if (shot === "offline") {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header style={{ backgroundColor: theme.colors.background }}>
          <Appbar.Content title="Your Groups" titleStyle={{ fontWeight: "bold" }} />
        </Appbar.Header>
        <Text
          variant="bodySmall"
          testID="groups-offline-line"
          style={{ color: theme.colors.onSurfaceVariant, paddingHorizontal: 16, paddingTop: 8 }}
        >
          Offline · showing saved groups
        </Text>
        <View style={[styles.groupRow, { borderBottomColor: theme.colors.outlineVariant }]}>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: "700" }}>Goa trip</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Beach week</Text>
          </View>
          <GroupBalanceBadge
            currentUserId={VIEWER}
            loading={false}
            balanceData={{
              group_id: "g",
              balances: [{ user_id: VIEWER, amount: 2400, currency: "INR" }],
            }}
          />
        </View>
        <View style={{ flex: 1 }} />
        <BottomNavBar
          currentRoute="groups"
          onGroupsPress={() => {}}
          onSettlementsPress={() => {}}
          onProfilePress={() => {}}
          onLogoutPress={() => {}}
        />
      </View>
    );
  }

  const sections = groupByLedgerDateSection(
    items,
    (item) => item.kind === "expense" ? item.transaction.date : item.settlement.created_at,
    new Date(2026, 10, 12, 15, 0, 0),
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.background }}>
        <Appbar.BackAction />
        <Appbar.Content title="Goa trip" titleStyle={{ fontWeight: "bold" }} />
        <Appbar.Action icon="dots-vertical" accessibilityLabel="Group options" />
      </Appbar.Header>
      {searching ? null : (
        <GroupDashboard
          groupName="Goa trip"
          balances={[]}
          currentUserId={VIEWER}
          loading={false}
          balanceError={showBalancesError}
          onBalancesRetry={() => {}}
          activeMemberCount={3}
          membersKnown
          participants={participants}
          defaultCurrency="INR"
        />
      )}
      <TransactionSearchField
        query={query}
        onChangeQuery={setQuery}
        filter={filter}
        onChangeFilter={setFilter}
        open={open || searching}
        onOpen={() => setOpen(true)}
        onCancel={() => {
          setQuery("");
          setFilter("all");
          setOpen(false);
        }}
        scopeNote={shot === "search" ? LOADED_ROWS_SEARCH_NOTE : null}
        autoFocus={shot === "search"}
      />
      {shot === "empty" ? (
        <View style={styles.emptyRow}>
          <Text variant="bodyMedium">{transactionSearchEmptyMessage("taxi")}</Text>
          <Pressable accessibilityRole="button">
            <Text style={{ color: theme.colors.primary, fontWeight: "600" }}>Clear</Text>
          </Pressable>
        </View>
      ) : shot === "search" && items.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, padding: 16 }}>
          {SEARCHING_TRANSACTIONS_LINE}
        </Text>
      ) : (
        <View>
          {sections.map((section) => (
            <View key={section.label}>
              <LedgerDateLabel label={section.label} />
              {section.items.map((item) => (
                <LedgerRow
                  key={item.key}
                  item={item}
                  participants={participants}
                  viewerUserId={VIEWER}
                  onEditExpense={() => {}}
                  onEditPayment={() => {}}
                />
              ))}
            </View>
          ))}
        </View>
      )}
      <View style={{ flex: 1 }} />
      {showFab ? (
        <FAB
          icon="plus"
          label="Add expense"
          testID="add-expense-button"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => {}}
        />
      ) : null}
      <BottomNavBar
        currentRoute="group-details"
        onGroupsPress={() => {}}
        onSettlementsPress={() => {}}
        onProfilePress={() => {}}
        onLogoutPress={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 96,
    borderRadius: 28,
  },
});
