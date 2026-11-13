import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, FAB, Text, useTheme } from "react-native-paper";
import { BottomNavBar } from "../components/BottomNavBar";
import { GroupDashboard } from "../components/GroupDashboard";
import { LedgerDateLabel, LedgerRow } from "../components/TransactionsSection";
import { TransactionSearchField } from "../components/TransactionSearchField";
import type { Balance, Participant, Settlement, Transaction } from "../types";
import { emptyRateBook } from "../utils/currencyMerge";
import { groupByLedgerDateSection } from "../utils/ledgerDateSections";
import {
  phase2ShotIsDetail,
  readGroupsPhase2Shot,
  type GroupsPhase2Shot,
} from "../utils/groupsPhase2Shots";
import { buildTransactionsLedger } from "../utils/transactionsLedger";
import { TransactionDetailView } from "./TransactionDetailScreen";
import { buildExpenseDetailModel, buildPaymentDetailModel } from "../utils/transactionDetail";

export type { GroupsPhase2Shot };
export { readGroupsPhase2Shot };

const VIEWER = "me";
const NOW = new Date(2026, 10, 12, 15, 0, 0);
const RATE_BOOK = emptyRateBook({ USD: 1, INR: 83, THB: 32 });

const participants: Participant[] = [
  { id: "p-me", group_id: "g", user_id: VIEWER, type: "member", full_name: "You" },
  { id: "p-rahul", group_id: "g", user_id: "rahul", type: "member", full_name: "Rahul" },
  { id: "p-meera", group_id: "g", user_id: "meera", type: "member", full_name: "Meera" },
  { id: "p-dev", group_id: "g", user_id: "dev", type: "member", full_name: "Dev" },
];

function expense(
  id: number,
  description: string,
  amount: number,
  payer: string,
  splits: Transaction["splits"],
  currency = "INR",
  category = "Food & drink",
): Transaction {
  return {
    id,
    description,
    date: "2026-11-12",
    amount,
    type: "expense",
    category,
    currency,
    paid_by: payer === "p-me" ? VIEWER : payer,
    paid_by_participant_id: payer,
    user_id: payer === "p-me" ? VIEWER : payer === "p-meera" ? "meera" : payer === "p-dev" ? "dev" : "rahul",
    created_at: "2026-11-11T15:44:00.000Z",
    splits,
  };
}

const dinner = expense(1, "Dinner at Thalassa", 4800, "p-rahul", [
  { participant_id: "p-dev", user_id: "dev", amount: 1200 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 1200 },
  { participant_id: "p-me", user_id: VIEWER, amount: 1200 },
  { participant_id: "p-meera", user_id: "meera", amount: 1200 },
]);
const scooter = expense(2, "Scooter rental", 2100, "p-me", [
  { participant_id: "p-rahul", user_id: "rahul", amount: 1000 },
  { participant_id: "p-me", user_id: VIEWER, amount: 700 },
  { participant_id: "p-meera", user_id: "meera", amount: 400 },
]);
const taxi = expense(3, "Taxi to airport", 900, "p-meera", [
  { participant_id: "p-meera", user_id: "meera", amount: 450 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 450 },
]);
const beach = expense(4, "Beach shack", 1200, "p-me", [
  { participant_id: "p-me", user_id: VIEWER, amount: 400 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 800 },
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
  created_at: "2026-11-11T18:00:00.000Z",
};

const owedBalances: Balance[] = [
  { user_id: VIEWER, participant_id: "p-me", full_name: "You", amount: 2400, currency: "INR" },
  { user_id: "rahul", participant_id: "p-rahul", full_name: "Rahul", amount: -1600, currency: "INR" },
  { user_id: "meera", participant_id: "p-meera", full_name: "Meera", amount: -800, currency: "INR" },
];

const mixedBalances: Balance[] = [
  { user_id: VIEWER, participant_id: "p-me", full_name: "You", amount: 50, currency: "USD" },
  { user_id: "rahul", participant_id: "p-rahul", full_name: "Rahul", amount: -50, currency: "USD" },
  { user_id: VIEWER, participant_id: "p-me", full_name: "You", amount: -30, currency: "EUR" },
  { user_id: "meera", participant_id: "p-meera", full_name: "Meera", amount: 30, currency: "EUR" },
];

function detailFor(shot: GroupsPhase2Shot) {
  const shared = {
    viewerUserId: VIEWER,
    viewerParticipantId: "p-me",
    participants,
    now: NOW,
  };
  switch (shot) {
    case "detail-equal":
      return buildExpenseDetailModel({ transaction: dinner, ...shared });
    case "detail-unequal":
      return buildExpenseDetailModel({ transaction: scooter, ...shared });
    case "detail-not-in-split":
      return buildExpenseDetailModel({ transaction: taxi, ...shared });
    case "detail-converted":
      return buildExpenseDetailModel({
        transaction: beach,
        ...shared,
        unifyEnabled: true,
        settlementCurrency: "INR",
        rateBook: RATE_BOOK,
      });
    case "detail-payment":
      return buildPaymentDetailModel({ settlement: payment, ...shared });
    default:
      return null;
  }
}

/**
 * __DEV__ fixture for phase-2 screenshots. Same position, ledger, and detail
 * components as the group screen, with dummy people and no network.
 */
export function GroupsPhase2PreviewScreen({ shot }: { shot: GroupsPhase2Shot }) {
  const theme = useTheme();
  const detail = detailFor(shot);
  if (detail && phase2ShotIsDetail(shot)) {
    return (
      <TransactionDetailView
        model={detail}
        onBack={() => {}}
        onEdit={() => {}}
        historyOpen={false}
        onToggleHistory={() => {}}
        historyLines={[]}
        historyLoading={false}
      />
    );
  }

  const even = shot === "even";
  const loading = shot === "placeholder" || shot === "loading";
  const compact = shot === "compact";
  const settle = shot === "settle";
  const balances = shot === "unify"
    ? mixedBalances
    : even
      ? [
        { user_id: VIEWER, participant_id: "p-me", full_name: "You", amount: 0, currency: "INR" },
        { user_id: "rahul", participant_id: "p-rahul", full_name: "Rahul", amount: 0, currency: "INR" },
      ]
      : owedBalances;
  const ledger = buildTransactionsLedger(
    even ? [] : [dinner, scooter, taxi, beach],
    even ? [] : [payment],
    "all",
  );
  const sections = groupByLedgerDateSection(
    ledger,
    (item) => item.kind === "expense" ? item.transaction.date : item.settlement.created_at,
    NOW,
  );
  const filledAdd = even || loading || shot === "balances";
  const compactLine = "You're owed ₹2,400";

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.background }}>
        <Appbar.BackAction />
        <Appbar.Content
          title="Goa trip"
          titleStyle={{ fontWeight: "bold" }}
        />
        <Appbar.Action icon="dots-vertical" accessibilityLabel="Group options" />
      </Appbar.Header>
      {compact ? (
        <Text
          variant="bodySmall"
          testID="group-compact-line"
          accessibilityRole="button"
          onPress={() => {}}
          style={{ color: theme.colors.onSurfaceVariant, paddingHorizontal: 16, marginTop: -4, marginBottom: 4 }}
        >
          {compactLine}
        </Text>
      ) : null}
      <ScrollView testID="group-ledger-scroll" contentContainerStyle={styles.list}>
        {compact ? null : (
          <GroupDashboard
            groupName="Goa trip"
            balances={loading ? [] : balances}
            currentUserId={VIEWER}
            currentUserParticipantId="p-me"
            loading={loading}
            loadingLine={shot === "loading" ? "Loading balances…" : null}
            balanceError={shot === "balances"}
            onBalancesRetry={() => {}}
            onOpenSettle={() => {}}
            onRemind={() => {}}
            settleListOpen={settle}
            activeMemberCount={3}
            membersKnown
            participants={participants}
            defaultCurrency="INR"
            hasNonZeroBalance={!even && !loading}
          />
        )}
        <TransactionSearchField
          query=""
          onChangeQuery={() => {}}
          filter="all"
          onChangeFilter={() => {}}
          open={false}
          onOpen={() => {}}
          onCancel={() => {}}
        />
        {loading ? null : sections.map((section) => (
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
      </ScrollView>
      {(
        <FAB
          icon="plus"
          label="Add expense"
          testID="add-expense-button"
          style={[
            styles.fab,
            {
              backgroundColor: filledAdd
                ? theme.colors.primary
                : theme.colors.secondaryContainer,
            },
          ]}
          color={filledAdd ? theme.colors.onPrimary : theme.colors.onSecondaryContainer}
          onPress={() => {}}
        />
      )}
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
  list: { paddingBottom: 220 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 96,
    borderRadius: 28,
  },
});
