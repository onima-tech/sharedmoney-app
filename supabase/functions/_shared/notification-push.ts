export interface PushNotificationSource {
  id: string;
  recipient_user_id: string;
  snapshot: {
    group?: {
      name?: string;
    };
  };
  title: string;
  body: string;
  group_id: string | null;
  transaction_id: number | null;
}

export interface NotificationPushContent {
  sound: "default";
  title: string;
  body: string;
  badge: number;
  channelId: "expense_activity";
  collapseId: string;
  tag: string;
  data: Record<string, string | number | null>;
}

export function composeNotificationPush(
  notification: PushNotificationSource,
  unreadCount: number,
): NotificationPushContent {
  const normalizedCount = Math.max(1, Math.floor(unreadCount));
  const isDigest = normalizedCount > 1;
  const groupName = notification.snapshot?.group?.name?.trim() || notification.title;
  const replacementKey = `sharedmoney-unread-${notification.recipient_user_id}`;
  const displayCount = normalizedCount > 99 ? "99+" : String(normalizedCount);

  return {
    sound: "default",
    title: isDigest ? "ShareMoney" : groupName,
    body: isDigest
      ? `${displayCount} money changes · Open SharedMoney to review`
      : notification.body,
    badge: Math.min(normalizedCount, 99),
    channelId: "expense_activity",
    collapseId: replacementKey,
    tag: replacementKey,
    data: isDigest ? { schema_version: 1, route: "notifications" } : {
      schema_version: 1,
      route: "notification-detail",
      notification_id: notification.id,
      group_id: notification.group_id,
      transaction_id: notification.transaction_id,
    },
  };
}
