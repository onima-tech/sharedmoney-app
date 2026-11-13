import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Appbar, FAB, Text, useTheme } from "react-native-paper";
import { BottomNavBar } from "../components/BottomNavBar";
import { GroupPositionBlock } from "../components/GroupPositionBlock";
import { TransactionDetailView } from "../components/TransactionDetailView";
import { LedgerDateLabel, LedgerRow } from "../components/TransactionsSection";
import { TransactionSearchField } from "../components/TransactionSearchField";
import type { Balance, Participant, Settlement, Transaction } from "../types";
import { CALM_LOADING_LINE } from "../utils/calmGroupLoading";
import { emptyRateBook, withOverrides } from "../utils/currencyMerge";
import { buildGroupPosition } from "../utils/groupPosition";
import {
  phase2ShotIsDetail,
  readGroupsPhase2Shot,
  type GroupsPhase2Shot,
} from "../utils/groupsPhase2Shots";
import { groupByLedgerDateSection } from "../utils/ledgerDateSections";
import { buildExpenseDetail, buildPaymentDetail } from "../utils/transactionDetail";
import { buildTransactionsLedger, type LedgerItem } from "../utils/transactionsLedger";

export type { GroupsPhase2Shot };
export { readGroupsPhase2Shot };

const VIEWER = "me";
const NOW = new Date(2026, 10, 12, 21, 14, 0);
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
  category?: string,
): Transaction {
  return {
    id,
    description,
    date: "2026-11-12",
    amount,
    type: "expense",
    currency,
    category,
    paid_by: payer === "p-me" ? VIEWER : payer.replace("p-", ""),
    paid_by_participant_id: payer,
    splits,
    created_at: "2026-11-11T15:44:00",
  };
}

const equalDinner = expense(1, "Dinner at Thalassa", 4800, "p-rahul", [
  { participant_id: "p-me", user_id: VIEWER, amount: 1200 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 1200 },
  { participant_id: "p-meera", user_id: "meera", amount: 1200 },
  { participant_id: "p-dev", user_id: "dev", amount: 1200 },
], "INR", "Food");

const unequalDinner = expense(2, "Dinner at Thalassa", 4800, "p-rahul", [
  { participant_id: "p-me", user_id: VIEWER, amount: 1200 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 2400 },
  { participant_id: "p-meera", user_id: "meera", amount: 1200 },
], "INR", "Food");

const scooter = expense(3, "Scooter rental", 2100, "p-me", [
  { participant_id: "p-me", user_id: VIEWER, amount: 700 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 700 },
  { participant_id: "p-meera", user_id: "meera", amount: 700 },
], "INR", "Transport");

const taxi = expense(4, "Taxi to airport", 900, "p-meera", [
  { participant_id: "p-meera", user_id: "meera", amount: 450 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 450 },
], "INR", "Transport");

const beach = expense(5, "Beach shack", 1200, "p-me", [
  { participant_id: "p-me", user_id: VIEWER, amount: 400 },
  { participant_id: "p-rahul", user_id: "rahul", amount: 800 },
], "THB", "Food");

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

const owedBalances: Balance[] = [
  { user_id: VIEWER, participant_id: "p-me", full_name: "You", amount: 2400, currency: "INR" },
  { user_id: "rahul", participant_id: "p-rahul", full_name: "Rahul", amount: -1600, currency: "INR" },
  { user_id: "meera", participant_id: "p-meera", full_name: "Meera", amount: -800, currency: "INR" },
];

function ledger(): LedgerItem[] {
  return buildTransactionsLedger([unequalDinner, scooter, taxi], [payment], "all");
}

/**
 * __DEV__ fixture for phase-2 screenshots. Same position, row, and detail
 * components as the group screen, with dummy data and no network.
 */
export function GroupsPhase2PreviewScreen({ shot }: { shot: GroupsPhase2Shot }) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const viewer = { userId: VIEWER, participantId: "p-me" };
  const rateBook = withOverrides(emptyRateBook({ USD: 1, INR: 83, THB: 34.58 }), { "THB:INR": 2.4 }, "group");

  if (phase2ShotIsDetail(shot)) {
    const model = shot === "detail-payment"
      ? buildPaymentDetail({ settlement: payment, viewer, participants, now: NOW })
      : buildExpenseDetail({
        transaction: shot === "detail-equal"
          ? equalDinner
          : shot === "detail-unequal"
            ? unequalDinner
            : shot === "detail-converted"
              ? beach
              : taxi,
        viewer,
        participants,
        now: NOW,
        settlementCurrency: shot === "detail-converted" ? "INR" : null,
        rateBook: shot === "detail-converted" ? rateBook : null,
      });
    return (
      <TransactionDetailView
        model={model}
        canEdit
        onBack={() => {}}
        onEdit={() => {}}
        historyOpen={false}
        historyLoading={false}
        historyLines={[]}
        onToggleHistory={() => {}}
      />
    );
  }

  const position = shot === "even"
    ? buildGroupPosition({
      balances: [],
      currentUserId: VIEWER,
      currentParticipantId: "p-me",
      unify: false,
      settlementCurrency: "INR",
      rateBook,
      defaultCurrency: "INR",
    })
    : buildGroupPosition({
      balances: owedBalances,
      currentUserId: VIEWER,
      currentParticipantId: "p-me",
      unify: false,
      settlementCurrency: "INR",
      rateBook,
      defaultCurrency: "INR",
    });
  const compact = shot === "compact";
  const showError = shot === "balances";
  const showPlaceholder = shot === "placeholder";
  const settleVisible = !showError && !showPlaceholder && shot !== "even" && position.showSettle;
  const items = showPlaceholder || shot === "even" ? [] : ledger();
  const sections = groupByLedgerDateSection(
    items,
    (item) => item.kind === "expense" ? item.transaction.date : item.settlement.created_at,
    NOW,
  );

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      testID={shot === "cached" ? "group-cached-paint" : `group-shot-${shot}`}
    >
      <Appbar.Header style={{ backgroundColor: theme.colors.background }}>
        <Appbar.BackAction />
        {compact ? (
          <View style={{ flex: 1 }} testID="group-compact-position">
            <Text numberOfLines={1} style={{ fontWeight: "700", color: theme.colors.onSurface }}>Goa trip</Text>
            <Text numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>
              {position.compactLine}
            </Text>
          </View>
        ) : (
          <Appbar.Content title="Goa trip" titleStyle={{ fontWeight: "700" }} />
        )}
        <Appbar.Action icon="dots-vertical" accessibilityLabel="Group options" />
      </Appbar.Header>
      {compact ? null : showPlaceholder ? (
        <GroupPositionBlock state="placeholder" />
      ) : showError ? (
        <GroupPositionBlock state="error" onRetry={() => {}} />
      ) : (
        <GroupPositionBlock state={position} onSentencePress={() => {}} onSettle={() => {}} onRemind={() => {}} />
      )}
      <TransactionSearchField
        query={query}
        onChangeQuery={setQuery}
        filter="all"
        onChangeFilter={() => {}}
        open={false}
        onOpen={() => {}}
        onCancel={() => setQuery("")}
      />
      {showPlaceholder ? (
        <Text
          variant="bodyMedium"
          testID="group-calm-loading"
          style={{ color: theme.colors.onSurfaceVariant, paddingHorizontal: 16, paddingVertical: 20 }}
        >
          {CALM_LOADING_LINE}
        </Text>
      ) : (
        sections.map((section) => (
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
                onOpenDetail={() => {}}
              />
            ))}
          </View>
        ))
      )}
      <View style={{ flex: 1 }} />
      <FAB
        icon="plus"
        label="Add expense"
        testID="add-expense-button"
        style={[
          styles.fab,
          {
            backgroundColor: settleVisible
              ? theme.colors.secondaryContainer
              : theme.colors.primary,
          },
        ]}
        color={settleVisible ? theme.colors.onSecondaryContainer : theme.colors.onPrimary}
        onPress={() => {}}
      />
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
  fab: {
    position: "absolute",
    right: 16,
    bottom: 96,
    borderRadius: 28,
  },
});
