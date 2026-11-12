import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  Text,
  TouchableRipple,
  useTheme
} from "react-native-paper";
import { Skeleton, SkeletonGroup } from "./Skeleton";
import { resolveGroupDashboardSlots } from "../utils/groupDashboardReservation";
import { Balance, GroupStatsResponse, Participant } from "../types";
import { UnifyPromptCard } from "./UnifyPromptCard";
import { useCurrencyPreferences } from "../hooks/useCurrencyPreferences";
import { getDefaultCurrency } from "../utils/currency";
import {
  collectCurrencies,
  isMultiCurrency,
  unifyBalances,
  simplifyUnifiedDebts,
} from "../utils/currencyMerge";
import { simplifyDebts } from "../utils/debt";
import { currenciesFromGroupStats } from "../utils/groupDashboardStats";
import {
  buildSettleSummaryMessage,
  formatShareCurrency,
  settleSharePersonName,
  type SettleSummaryEdge,
} from "../utils/settleShareMessage";
import {
  findParticipantForBalance,
  resolveSettlementPresence,
  settlementCounterpartyShortName,
  settlementPresenceCaption,
  type SettlementPresence,
} from "../utils/settlementPresence";

export type GroupShareSummaryPayload = {
  message: string;
};

interface GroupDashboardProps {
  groupId?: string;
  groupName?: string;
  /** Canonical web group URL appended to the share-summary message. */
  groupLink?: string;
  /**
   * Chat-safe label for the current user in share-summary text (never "You").
   * Prefer profile first name; email local-part is fine as fallback.
   */
  viewerShareName?: string;
  balances: Balance[];
  /** Full-set backend stats — never derive spending totals from paginated transactions. */
  groupStats?: GroupStatsResponse | null;
  currentUserId?: string;
  currentUserParticipantId?: string;
  loading: boolean;
  statsLoading?: boolean;
  balanceError?: boolean;
  defaultCurrency?: string;
  /** Opens SettlementFormScreen for a viewer-involved settlement edge. Does not mutate data. */
  onSettlePress?: (balance: Balance) => void;
  /** Reports whether a non-empty group settle-up summary can be shared. */
  onShareSummaryChange?: (payload: GroupShareSummaryPayload | null) => void;
  onOpenCurrencySettings?: () => void;
  /** Retries the balances request from the number area. */
  onBalancesRetry?: () => void;
  /**
   * Non-former participant count (incl. people without accounts / pending invites).
   * Used for calm solo chrome vs settle slot visibility.
   */
  activeMemberCount?: number;
  /** False for navigation/list data without a complete member/participant list. */
  membersKnown?: boolean;
  /** Viewer has any non-zero balance (keeps settle visible vs former members). */
  hasNonZeroBalance?: boolean;
  /** Participants for presence captions (Invited / Not on SharedMoney) and names. */
  participants?: Participant[];
  /** Synchronous fallback when effective cached currency settings are absent. */
  unifyBalances?: boolean;
}

function presenceForBalance(
  balance: Balance,
  participants: Participant[],
): SettlementPresence {
  const match = findParticipantForBalance(balance, participants);
  if (match) return resolveSettlementPresence(match);
  // Balance rows for people without accounts often lack user_id.
  if (!balance.user_id) return "no_account";
  return "app_member";
}

export const GroupDashboard: React.FC<GroupDashboardProps> = ({
  groupId,
  groupName,
  groupLink,
  viewerShareName,
  balances,
  groupStats,
  currentUserId,
  currentUserParticipantId,
  loading,
  statsLoading = false,
  balanceError = false,
  defaultCurrency = getDefaultCurrency(),
  onSettlePress,
  onShareSummaryChange,
  onOpenCurrencySettings,
  onBalancesRetry,
  activeMemberCount = 2,
  membersKnown = true,
  hasNonZeroBalance = false,
  participants = [],
  unifyBalances: groupUnifyBalances,
}) => {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const {
    preferredCurrency,
    groupSettings,
    rateBook,
    setGroupSettings,
  } = useCurrencyPreferences(groupId);
  // Freeze the first-paint prediction: hydration must not resize the skeleton.
  // GroupDetails keys this component by group ID so another group gets a fresh prediction.
  const [reservation] = useState(() => resolveGroupDashboardSlots({
    activeMemberCount: membersKnown ? activeMemberCount : undefined,
    hasNonZeroBalance: membersKnown ? hasNonZeroBalance : false,
    // Cached effective preferences must agree with the loaded renderer, even
    // when navigation metadata still contains an older unify flag.
    unifyEnabled: groupSettings
      ? groupSettings.enabled && !!groupSettings.settlementCurrency
      : groupUnifyBalances,
  }));
  const dashboardLoading = loading || statsLoading;
  // Height the loading reservation actually painted; loaded content keeps it
  // as a floor for this mount so a short "All settled" line cannot pull the ledger up.
  const [reservedSettlementHeight, setReservedSettlementHeight] = useState(0);
  // These minimums size visible content only. Frozen loading reservations must
  // not leave blank slots when authoritative membership/preferences arrive.
  const currencyHeaderStyle = [styles.unifiedSubhead, {
    minHeight: theme.fonts.labelLarge.lineHeight * fontScale,
  }];
  const settlementSlotStyle = {
    minHeight: Math.max(16, theme.fonts.bodySmall.lineHeight * fontScale) + 4,
  };

  const usedCurrencies = useMemo(
    () => collectCurrencies([...balances, ...currenciesFromGroupStats(groupStats)]),
    [balances, groupStats]
  );
  const hasMultipleCurrencies = isMultiCurrency(usedCurrencies);
  const unifyEnabled = groupSettings?.enabled === true && !!groupSettings.settlementCurrency;
  const contentSlots = resolveGroupDashboardSlots({
    activeMemberCount,
    unifyEnabled,
    balanceError,
    hasNonZeroBalance,
  });
  const showSettleChrome = contentSlots.settlement;
  const settlementCurrency = groupSettings?.settlementCurrency || preferredCurrency || defaultCurrency;

  const debts = useMemo(() => {
    if (!currentUserId) return [];
    if (unifyEnabled) {
      return simplifyUnifiedDebts(
        balances,
        settlementCurrency,
        rateBook,
        currentUserId,
        currentUserParticipantId
      );
    }
    return simplifyDebts(balances, currentUserId, defaultCurrency, currentUserParticipantId);
  }, [balances, currentUserId, currentUserParticipantId, defaultCurrency, unifyEnabled, settlementCurrency, rateBook]);

  const myDebts = useMemo(() => {
    if (!currentUserId) return [];
    const filtered = debts.filter(
      (d) =>
        d.fromUser.user_id === currentUserId || d.toUser.user_id === currentUserId
        || (currentUserParticipantId && (
          d.fromUser.participant_id === currentUserParticipantId
          || d.toUser.participant_id === currentUserParticipantId
        ))
    );
    return [...filtered].sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      const aOtherId = a.fromUser.user_id === currentUserId ? a.toUser.user_id : a.fromUser.user_id;
      const bOtherId = b.fromUser.user_id === currentUserId ? b.toUser.user_id : b.fromUser.user_id;
      return (aOtherId || "").localeCompare(bOtherId || "");
    });
  }, [debts, currentUserId, currentUserParticipantId]);

  const myUnified = useMemo(() => {
    if (!currentUserId || !unifyEnabled) return null;
    const mine = balances.filter((balance) => (
      balance.user_id === currentUserId
      || (currentUserParticipantId && balance.participant_id === currentUserParticipantId)
    ));
    return unifyBalances(mine.length > 0 ? mine : myDebts.map((edge) => ({
      user_id: currentUserId,
      amount: edge.toUser.user_id === currentUserId ? edge.amount : -edge.amount,
      currency: edge.currency,
    })), settlementCurrency, rateBook);
  }, [balances, currentUserId, currentUserParticipantId, myDebts, unifyEnabled, settlementCurrency, rateBook]);

  // Group net balances are not debts to the viewer. Use the same viewer-involved
  // settlement edges as the unified view, retaining each edge's currency/amount.
  const viewerBalances = useMemo(() => myDebts.map((edge): Balance => {
    const isOwed = edge.toUser.user_id === currentUserId
      || (!!currentUserParticipantId && edge.toUser.participant_id === currentUserParticipantId);
    return {
      ...(isOwed ? edge.fromUser : edge.toUser),
      amount: isOwed ? edge.amount : -edge.amount,
      currency: edge.currency,
    };
  }), [myDebts, currentUserId, currentUserParticipantId]);

  const settlementRows = useMemo(
    () => viewerBalances.filter((balance) => Math.abs(balance.amount) >= 0.005),
    [viewerBalances],
  );


  const formatSignedBalance = (amount: number, currency: string, isOwed: boolean) => {
    const bare = formatShareCurrency(Math.abs(amount), currency);
    return isOwed ? `+${bare}` : `-${bare}`;
  };

  const isSettled = !balanceError && !dashboardLoading && Boolean(currentUserId)
    && settlementRows.length === 0
    && !(unifyEnabled && myUnified && myUnified.missing.length > 0);

  const summaryEdges = useMemo((): SettleSummaryEdge[] => {
    if (!currentUserId || dashboardLoading || balanceError) return [];
    // Mixed-currency without unification cannot form one coherent settle-up list.
    if (hasMultipleCurrencies && !unifyEnabled) return [];

    const isViewer = (person: Balance) =>
      person.user_id === currentUserId
      || (!!currentUserParticipantId && person.participant_id === currentUserParticipantId)
      || person.full_name === "You";

    const viewerLabel = settleSharePersonName({
      full_name: viewerShareName || null,
      email: null,
    });

    const labelFor = (person: Balance) => {
      if (isViewer(person)) {
        // Synthetic debt "You" nodes have no profile — use the viewer label.
        if (person.full_name === "You" || !person.full_name?.trim()) {
          return viewerLabel;
        }
      }
      return settleSharePersonName(person);
    };

    return debts
      .filter((edge) => Math.abs(edge.amount) >= 0.005)
      .map((edge) => ({
        fromName: labelFor(edge.fromUser),
        toName: labelFor(edge.toUser),
        amount: edge.amount,
        currency: edge.currency,
      }));
  }, [
    balanceError,
    currentUserId,
    currentUserParticipantId,
    dashboardLoading,
    debts,
    hasMultipleCurrencies,
    unifyEnabled,
    viewerShareName,
  ]);

  const shareSummaryMessage = useMemo(() => {
    if (isSettled || summaryEdges.length === 0) return null;
    const message = buildSettleSummaryMessage({
      groupName: groupName?.trim() || "Group",
      edges: summaryEdges,
      groupLink: groupLink?.trim() || "",
    });
    return message.trim() ? message : null;
  }, [groupLink, groupName, isSettled, summaryEdges]);

  useEffect(() => {
    if (!onShareSummaryChange) return;
    onShareSummaryChange(
      shareSummaryMessage ? { message: shareSummaryMessage } : null,
    );
  }, [onShareSummaryChange, shareSummaryMessage]);

  const renderSettlementRows = () => {
    if (balanceError) {
      return (
        <View style={styles.settlementStatus} testID="balances-error-line">
          <Text accessibilityLiveRegion="polite" variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Couldn’t load balances
            {" · "}
            <Text
              variant="bodySmall"
              onPress={onBalancesRetry}
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

    if (settlementRows.length === 0) {
      if (unifyEnabled && myUnified && myUnified.missing.length > 0) {
        return (
          <View style={styles.settlementStatus}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
              {`No ${myUnified.missing.join(", ")} → ${settlementCurrency} rate. Original balances remain; this group is not all settled.`}
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.settledInline} testID="group-settled-inline">
          <MaterialCommunityIcons name="check-circle-outline" size={16} color={theme.colors.onSurfaceVariant} accessible={false} />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            All settled
          </Text>
        </View>
      );
    }

    return settlementRows.map((balance, index) => {
      const isOwed = balance.amount > 0;
      const name = settlementCounterpartyShortName(balance, participants);
      const presence = presenceForBalance(balance, participants);
      const presenceCaption = settlementPresenceCaption(presence);
      const isFormer = presence === "former";
      const rowKey =
        balance.participant_id || balance.user_id || `${name}-${balance.currency}`;
      const currency = balance.currency || defaultCurrency;
      const amountColor = isOwed
        ? theme.colors.onTertiaryContainer
        : theme.colors.onSecondaryContainer;
      const isConverted = !unifyEnabled || balance.currency.toUpperCase() === settlementCurrency.toUpperCase();
      const Row = onSettlePress ? TouchableRipple : View;
      const a11yName = isFormer ? `${name} (Former)` : name;
      const a11yPresence = presenceCaption ? `, ${presenceCaption}` : "";
      const a11yOwes = isOwed
        ? `${a11yName} owes you${a11yPresence}`
        : `You owe ${a11yName}${a11yPresence}`;
      const signedAmount = formatSignedBalance(balance.amount, currency, isOwed);
      const nameColor = isFormer
        ? theme.colors.onSurfaceVariant
        : theme.colors.onSurface;
      return (
        <View
          key={`${rowKey}-${currency}-${index}`}
          style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.outlineVariant }}
        >
          <Row
            testID={`settlement-row-${rowKey}-${currency}`}
            onPress={onSettlePress ? () => onSettlePress(balance) : undefined}
            accessible
            accessibilityRole={onSettlePress ? "button" : undefined}
            accessibilityLabel={`${a11yOwes}, ${signedAmount}`}
            accessibilityHint={onSettlePress ? "Opens the payment record form. No payment is recorded until confirmed." : undefined}
            style={styles.settlementRow}
          >
            {/* Avatar + chevron centre on the full (1- or 2-line) block. */}
            <View style={styles.settlementRowContent}>
              {/*
                Line 1: name (only shrink) + owes you + amount (flexShrink 0).
                Line 2 (no-account / invited only): muted caption.
                Amount top-aligns with line 1 so mixed rows keep a straight column.
              */}
              <View style={styles.settlementDetails}>
                <View style={styles.settlementLabelColumn} testID="settlement-label-column">
                  <View style={styles.settlementNameRow} testID="settlement-row-line1">
                    {!isOwed ? (
                      <Text
                        variant="bodyMedium"
                        style={{ flexShrink: 0, color: nameColor }}
                      >
                        {"You owe "}
                      </Text>
                    ) : null}
                    <Text
                      variant="bodyMedium"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      testID="settlement-row-name"
                      style={{
                        flexShrink: 1,
                        flexGrow: 0,
                        minWidth: 0,
                        color: nameColor,
                      }}
                    >
                      {name}
                    </Text>
                    {isOwed ? (
                      <Text
                        variant="bodyMedium"
                        style={{ flexShrink: 0, color: nameColor }}
                      >
                        {" owes you"}
                      </Text>
                    ) : null}
                    {isFormer ? (
                      <Text
                        variant="bodyMedium"
                        numberOfLines={1}
                        style={{
                          flexShrink: 0,
                          color: theme.colors.onSurfaceVariant,
                        }}
                      >
                        {" (Former)"}
                      </Text>
                    ) : null}
                  </View>
                  {presenceCaption ? (
                    <Text
                      variant="labelMedium"
                      numberOfLines={1}
                      testID="settlement-row-presence"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        fontSize: 13,
                        lineHeight: 16,
                        marginTop: 2,
                      }}
                    >
                      {presenceCaption}
                    </Text>
                  ) : null}
                  {!isConverted ? (
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                    >
                      Not converted · {balance.currency}
                    </Text>
                  ) : null}
                </View>
                <Text
                  variant="titleSmall"
                  testID="settlement-row-amount"
                  style={{
                    flexShrink: 0,
                    color: amountColor,
                    fontWeight: "700",
                    // Align with line-1 body text, not the vertical centre of a 2-line block.
                    lineHeight: theme.fonts.bodyMedium?.lineHeight ?? 20,
                  }}
                >
                  {signedAmount}
                </Text>
              </View>
              {onSettlePress ? <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={theme.colors.onSurfaceVariant}
              /> : null}
            </View>
          </Row>
        </View>
      );
    });
  };

  if ((dashboardLoading || !currentUserId) && !balanceError) {
    return (
      <SkeletonGroup style={styles.container} testID="group-dashboard-skeleton">
        {reservation.currencyHeader ? <View style={currencyHeaderStyle}>
          <Skeleton width="48%" height={12} />
          <Skeleton width={48} height={14} />
        </View> : null}
        {reservation.settlement ? <View style={settlementSlotStyle}
          onLayout={(e) => setReservedSettlementHeight(e.nativeEvent.layout.height)}>
          {/* Mirrors the outstanding-balance card so loaded debts do not push the ledger. */}
          <View testID="group-settlement-skeleton" style={styles.settlementList}>
            <View style={[styles.settlementRow, { borderBottomColor: theme.colors.outlineVariant }]}>
              <View style={styles.settlementRowContent}>
                <View style={[styles.settlementDetails, { justifyContent: "space-between" }]}>
                  <Skeleton width={104} height={14} />
                  <Skeleton width={72} height={16} />
                </View>
              </View>
            </View>
          </View>
        </View> : null}
      </SkeletonGroup>
    );
  }

  return (
    <View style={styles.container}>
      {hasMultipleCurrencies && !unifyEnabled && !balanceError && !dashboardLoading ? (
        <UnifyPromptCard
          currencies={usedCurrencies}
          suggestedCurrency={settlementCurrency}
          onEnable={() => {
            if (!groupId) {
              onOpenCurrencySettings?.();
              return;
            }
            void setGroupSettings(groupId, {
              enabled: true,
              settlementCurrency,
            });
          }}
          onChooseCurrency={onOpenCurrencySettings}
        />
      ) : null}

      {contentSlots.currencyHeader ? <View style={currencyHeaderStyle}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {`In one currency · ${settlementCurrency}`}
        </Text>
      </View> : null}

      {contentSlots.settlement ? <View style={[settlementSlotStyle,
        reservedSettlementHeight > 0 ? { minHeight: reservedSettlementHeight } : null]}>
        {isSettled ? (
          <View testID="group-settlement-rows">{renderSettlementRows()}</View>
        ) : (
          <View style={styles.settlementList} testID="group-settlement-rows">
            {renderSettlementRows()}
          </View>
        )}
      </View> : null}

      {unifyEnabled && !balanceError && !dashboardLoading && showSettleChrome && myUnified && myUnified.missing.length > 0 && settlementRows.length > 0 ? (
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.error, marginTop: -8, marginHorizontal: 4 }}
          testID="group-missing-rates-notice"
        >
          {settlementRows.every((r) => r.currency.toUpperCase() !== settlementCurrency.toUpperCase())
            ? `No ${myUnified.missing.join(", ")} → ${settlementCurrency} rate. Original balances remain; this group is not all settled.`
            : `No ${myUnified.missing.join(", ")} → ${settlementCurrency} rate. Original balances remain below the converted rows.`}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 8,
  },
  unifiedSubhead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: -4,
  },
  settlementList: {
    overflow: "hidden",
  },
  settlementRow: {
    minHeight: 48,
  },
  settlementNameRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    width: "100%",
  },
  settlementLabelColumn: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  settlementRowContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 60,
  },
  settlementDetails: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    // Top-align amount with line 1 (not centred on a 2-line label block).
    alignItems: "flex-start",
    marginRight: 4,
  },
  settlementAvatar: {
    minWidth: 36,
    minHeight: 36,
    padding: 8,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settledInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  settlementStatus: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    alignItems: "flex-start",
  },

  compactStatsRow: {
      flexDirection: 'row',
      gap: 12,
  },
  stackedStats: {
      flexDirection: 'column',
  },
  compactStat: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
  },
  compactStatContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
  },
  miniIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
  }
});
