import { assertEquals } from "jsr:@std/assert@1";
import { composeNotificationPush } from "./notification-push.ts";

const notification = {
  id: "a6db6310-193f-49c8-bb2f-3a54016fc02a",
  recipient_user_id: "1b71df70-4cd1-42a8-9d6d-59bdefc9b705",
  title: "Alex updated Electricity bill",
  body: "Flatmates · Your share ₹1,050",
  snapshot: { group: { name: "Flatmates" } },
  group_id: "e0a0b7cf-91f0-41db-bd96-7d06a8f0ad71",
  transaction_id: 42,
};

Deno.test("one unread notification sends detail without a financial snapshot", () => {
  assertEquals(composeNotificationPush(notification, 1), {
    sound: "default",
    title: notification.snapshot.group.name,
    body: notification.body,
    badge: 1,
    channelId: "expense_activity",
    collapseId: `sharedmoney-unread-${notification.recipient_user_id}`,
    tag: `sharedmoney-unread-${notification.recipient_user_id}`,
    data: {
      schema_version: 1,
      route: "notification-detail",
      notification_id: notification.id,
      group_id: notification.group_id,
      transaction_id: notification.transaction_id,
    },
  });
});

Deno.test("multiple unread notifications send a capped count to the inbox", () => {
  assertEquals(composeNotificationPush(notification, 137), {
    sound: "default",
    title: "ShareMoney",
    body: "99+ money changes · Open SharedMoney to review",
    badge: 99,
    channelId: "expense_activity",
    collapseId: `sharedmoney-unread-${notification.recipient_user_id}`,
    tag: `sharedmoney-unread-${notification.recipient_user_id}`,
    data: {
      schema_version: 1,
      route: "notifications",
    },
  });
});
