import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Button, Text, useTheme } from "react-native-paper";
import { BottomNavBar } from "../components/BottomNavBar";
import { GroupBalanceBadge } from "../components/GroupBalanceBadge";
import { NotificationBell } from "../components/NotificationBell";
import type { Balance, Group } from "../types";
import { groupRecencyLine, type GroupLastActivity } from "../utils/groupRecency";
import { homePosition } from "../utils/homePosition";
import {
  readGroupsPhase3Shot,
  type GroupsPhase3Shot,
} from "../utils/groupsPhase3Shots";
import { HomePositionView } from "./GroupsListScreen";

export type { GroupsPhase3Shot };
export { readGroupsPhase3Shot };

const VIEWER = "me";
const NOW = new Date("2026-11-13T04:00:00.000Z");

function activity(
  actor: string,
  action: GroupLastActivity["action"],
  subject: string,
  at: string,
): GroupLastActivity {
  return { actor, action, subject, at };
}

const owedOverall: Balance[] = [
  { user_id: VIEWER, amount: 4210, currency: "INR" },
];

const splitOverall: Balance[] = [
  { user_id: VIEWER, amount: 4210, currency: "INR" },
  { user_id: VIEWER, amount: -88.15, currency: "USD" },
];

type PreviewGroup = Group & {
  balances: Balance[];
  unread?: boolean;
};

function group(
  id: string,
  name: string,
  balances: Balance[],
  last: GroupLastActivity | null | undefined,
  unread = false,
): PreviewGroup {
  return {
    id,
    name,
    created_by: VIEWER,
    created_at: "2026-10-08T00:00:00.000Z",
    updated_at: "2026-11-13T02:00:00.000Z",
    user_status: "active",
    ...(last === undefined ? {} : { last_activity: last }),
    balances,
    unread,
  };
}

const combiningGroups: PreviewGroup[] = [
  group(
    "goa",
    "Goa trip",
    [{ user_id: VIEWER, amount: 2400, currency: "INR" }],
    activity("Aisha", "added", "Dinner", "2026-11-13T02:00:00.000Z"),
    true,
  ),
  group(
    "flat",
    "Flat 4B",
    [{ user_id: VIEWER, amount: -1050, currency: "INR" }],
    activity("You", "added", "Rent", "2026-11-09T04:00:00.000Z"),
  ),
  group(
    "office",
    "Office lunch",
    [{ user_id: VIEWER, amount: 2860, currency: "INR" }],
    activity("You", "settled", "Dev", "2026-11-10T04:00:00.000Z"),
  ),
  group("weekend", "Weekend Pune", [], null),
];

function groupsFor(shot: GroupsPhase3Shot): PreviewGroup[] {
  if (shot === "empty") return [];
  if (shot === "even") {
    return [
      group("goa", "Goa trip", [], null),
      group("flat", "Flat 4B", [], null),
    ];
  }
  if (shot === "split") {
    return [
      group(
        "goa",
        "Goa trip",
        [{ user_id: VIEWER, amount: 2400, currency: "INR" }],
        activity("Aisha", "added", "Dinner", "2026-11-13T02:00:00.000Z"),
      ),
      group(
        "flat",
        "Flat 4B",
        [{ user_id: VIEWER, amount: -88.15, currency: "USD" }],
        activity("Dev", "added", "Taxi", "2026-11-12T04:00:00.000Z"),
      ),
    ];
  }
  if (shot === "cached" || shot === "error") {
    return combiningGroups.map((entry) => {
      const { last_activity: _activity, ...rest } = entry;
      return { ...rest, balances: entry.balances, unread: entry.unread };
    });
  }
  return combiningGroups;
}

function overallFor(shot: GroupsPhase3Shot): Balance[] {
  if (shot === "split") return splitOverall;
  if (shot === "even" || shot === "empty") return [];
  return owedOverall;
}

export function GroupsPhase3PreviewScreen({ shot }: { shot: GroupsPhase3Shot }) {
  const theme = useTheme();
  const groups = groupsFor(shot);
  const withBalance = groups.filter((entry) =>
    entry.balances.some((row) => Math.abs(row.amount) >= 0.01)
  ).length;
  const position = homePosition({
    hasBalances: shot !== "empty",
    overallBalances: overallFor(shot),
    groupsWithBalance: withBalance,
    activeGroupCount: groups.length,
  });
  const showList = shot !== "empty";

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.background }}>
        <Appbar.Content title="Groups" titleStyle={{ fontWeight: "bold" }} />
        <NotificationBell unreadCount={shot === "owed" ? 1 : 0} onPress={() => {}} />
      </Appbar.Header>
      {shot === "error" ? (
        <Text
          variant="bodySmall"
          testID="groups-refresh-error"
          style={{ color: theme.colors.onSurfaceVariant, paddingHorizontal: 16, paddingTop: 8 }}
        >
          Couldn’t refresh · Retry
        </Text>
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>
        {shot === "empty" ? (
          <View style={styles.empty} testID="groups-empty-state">
            <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginBottom: 20 }}>
              Create a group for shared expenses.
            </Text>
            <Button mode="contained" testID="groups-empty-create" onPress={() => {}}>
              Create a group
            </Button>
            <Text
              testID="home-empty-one-time-split"
              style={{ marginTop: 16, color: theme.colors.onSurfaceVariant, fontSize: 15 }}
            >
              Split one bill
            </Text>
          </View>
        ) : null}
        {showList ? (
          <>
            <HomePositionView position={position} />
            {groups.map((entry) => {
              const recency = groupRecencyLine(entry, NOW);
              return (
                <View
                  key={entry.id}
                  style={[styles.row, { borderBottomColor: theme.colors.outlineVariant }]}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {entry.name}
                      </Text>
                      {entry.unread ? (
                        <View
                          testID={`notification-dot-${entry.id}`}
                          style={[styles.dot, { backgroundColor: theme.colors.primary }]}
                        />
                      ) : null}
                    </View>
                    {recency ? (
                      <Text
                        testID={`group-recency-${entry.id}`}
                        style={{ color: theme.colors.onSurfaceVariant, marginTop: 2, fontSize: 12 }}
                        numberOfLines={1}
                      >
                        {recency}
                      </Text>
                    ) : null}
                  </View>
                  <GroupBalanceBadge
                    balanceData={{ group_id: entry.id, balances: entry.balances }}
                    currentUserId={VIEWER}
                    previewSettings={{ enabled: false, settlementCurrency: "INR", customRates: {} }}
                    loading={false}
                  />
                </View>
              );
            })}
            {shot === "owed" ? (
              <>
                <Text testID="one-time-bills-row" style={[styles.line, { color: theme.colors.onSurface }]}>
                  One-time bills · 1 open
                </Text>
                <View style={styles.footer}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>Archived 2 · Former 1</Text>
                  <Text testID="new-group-action" style={{ color: theme.colors.primary }}>New group</Text>
                </View>
                <View testID="notifications-primer" style={styles.primer}>
                  <Text style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
                    Know when an expense affects you
                  </Text>
                  <Text style={{ color: theme.colors.primary }}>Turn on</Text>
                  <Text testID="notifications-primer-dismiss" style={{ color: theme.colors.onSurfaceVariant }}>
                    Not now
                  </Text>
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { paddingVertical: 64, alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowMain: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { fontSize: 15, fontWeight: "500", paddingVertical: 14 },
  footer: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primer: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
});
