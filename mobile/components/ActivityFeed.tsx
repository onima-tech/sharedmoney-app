import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Pressable, View } from "react-native";
import {
  IconButton,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";
import { ACTIVITY_ICONS } from "../constants/activityFeed";
import { useAuth } from "../contexts/AuthContext";
import { ActivityItem, Settlement } from "../types";
import {
  formatActivityTime,
  getUserDisplayName,
} from "../utils/activityDescriptions";
import { styles } from "./ActivityFeed.styles";

export function ActivityDateHeader({
  title,
  isFirst,
}: {
  title: string;
  isFirst?: boolean;
}) {
  const theme = useTheme();
  return (
    <View>
      {!isFirst ? <View style={{ height: 16 }} /> : null}
      <View style={[styles.dateHeaderContainer, isFirst && { marginTop: 0 }]}>
        <Text
          variant="labelMedium"
          style={[styles.dateHeaderText, { color: theme.colors.primary }]}
        >
          {title}
        </Text>
        <View
          style={[
            styles.dateHeaderLine,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />
      </View>
    </View>
  );
}

export interface ActivityFeedRowProps {
  activity: ActivityItem;
  onReport?: (activity: ActivityItem) => void;
  onBlock?: (activity: ActivityItem) => void;
  onPressSettlement?: (settlement: Settlement, activity: ActivityItem) => void;
}

export const ActivityFeedRow: React.FC<ActivityFeedRowProps> = ({
  activity,
  onReport,
  onBlock,
  onPressSettlement,
}) => {
  const theme = useTheme();
  const { session } = useAuth();
  const currentUserId = session?.user?.id;
  const [menuOpen, setMenuOpen] = React.useState(false);

  const userDisplayName = getUserDisplayName(
    activity.changed_by.id,
    activity.changed_by.email,
    currentUserId,
    activity.changed_by.full_name,
  );
  const isCreated = activity.type.endsWith("_created");
  const isDeleted = activity.type.endsWith("_deleted");
  const activityColor = isDeleted
    ? theme.colors.error
    : isCreated
      ? theme.colors.tertiary
      : theme.colors.primary;
  const activityContainerColor = isDeleted
    ? theme.colors.errorContainer
    : isCreated
      ? theme.colors.tertiaryContainer
      : theme.colors.primaryContainer;

  const getActivityIcon = (
    type: ActivityItem["type"],
  ): keyof typeof MaterialCommunityIcons.glyphMap => {
    if (type.startsWith("settlement")) return ACTIVITY_ICONS.SETTLEMENT;
    return ACTIVITY_ICONS.TRANSACTION;
  };

  const activityIcon = getActivityIcon(activity.type);
  const isEditableSettlement =
    !!onPressSettlement &&
    activity.type.startsWith("settlement") &&
    activity.type !== "settlement_deleted" &&
    !!(activity.details?.settlement || activity.settlement_id);

  const openSettlement = () => {
    if (!onPressSettlement || !isEditableSettlement) return;
    const snapshot = activity.details?.settlement;
    const settlementId = activity.settlement_id || snapshot?.id || "";
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!settlementId || !uuidPattern.test(settlementId)) {
      return;
    }
    const settlement: Settlement = {
      id: settlementId,
      group_id: activity.group_id || snapshot?.group_id || "",
      from_user_id: snapshot?.from_user_id || "",
      to_user_id: snapshot?.to_user_id || "",
      from_participant_id: snapshot?.from_participant_id,
      to_participant_id: snapshot?.to_participant_id,
      amount: snapshot?.amount ?? 0,
      currency: snapshot?.currency || "USD",
      notes: snapshot?.notes,
      created_by: snapshot?.created_by || activity.changed_by.id,
      created_at: snapshot?.created_at || activity.changed_at,
      from_user_email: snapshot?.from_user_email,
      to_user_email: snapshot?.to_user_email,
    };
    onPressSettlement(settlement, activity);
  };

  const rowContent = (
    <>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: activityContainerColor },
        ]}
      >
        <MaterialCommunityIcons
          name={activityIcon}
          size={20}
          color={activityColor}
        />
      </View>

      <View style={styles.activityContent}>
        <View style={styles.activityHeader}>
          <Text
            variant="bodyLarge"
            style={[styles.activityUser, { color: theme.colors.onSurface }]}
          >
            {userDisplayName}
          </Text>
          <View style={styles.activityMeta}>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {formatActivityTime(activity.changed_at)}
            </Text>
            {activity.changed_by.id !== currentUserId && (onReport || onBlock) ? (
              <Menu
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    size={20}
                    accessibilityLabel={`Safety options for ${userDisplayName}`}
                    onPress={() => setMenuOpen(true)}
                    style={styles.safetyMenuButton}
                  />
                }
              >
                {onReport ? (
                  <Menu.Item
                    title="Report this activity"
                    leadingIcon="flag-outline"
                    onPress={() => {
                      setMenuOpen(false);
                      onReport(activity);
                    }}
                  />
                ) : null}
                {onBlock ? (
                  <Menu.Item
                    title={`Block ${userDisplayName} everywhere`}
                    leadingIcon="account-cancel-outline"
                    onPress={() => {
                      setMenuOpen(false);
                      onBlock(activity);
                    }}
                  />
                ) : null}
              </Menu>
            ) : null}
          </View>
        </View>

        <Text
          variant="bodyMedium"
          style={[
            styles.activityDescription,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {activity.description}
        </Text>
        {isEditableSettlement ? (
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.primary, marginTop: 4 }}
          >
            Tap to edit
          </Text>
        ) : null}
      </View>
    </>
  );

  if (isEditableSettlement) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.activityItem,
          pressed ? { opacity: 0.7 } : null,
        ]}
        onPress={openSettlement}
        accessibilityRole="button"
        accessibilityLabel="Edit settlement"
        testID={`edit-settlement-activity-${activity.id}`}
      >
        {rowContent}
      </Pressable>
    );
  }

  return <View style={styles.activityItem}>{rowContent}</View>;
};

export function ActivityFeedEmptyState({ isFiltered }: { isFiltered?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.emptyStateContent} testID="activity-empty-state">
      <Text
        variant="bodyLarge"
        style={[styles.emptyStateMessage, { color: theme.colors.onSurfaceVariant }]}
      >
        {isFiltered
          ? "No matching activity for these filters."
          : "Activity will show expense and payment changes here."}
      </Text>
    </View>
  );
}
