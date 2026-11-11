import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  type NotificationCursor,
  type NotificationPreference,
  type NotificationsResponse,
  type TransactionNotification,
} from "../types/notifications";
import { fetchWithAuth } from "../utils/api";
import {
  clearNotificationReadQueue,
  enqueueNotificationRead,
  enqueueNotificationReads,
  flushNotificationReadQueue,
} from "../utils/notificationReadQueue";
import {
  flattenNotificationPages,
  markAllNotificationsReadInCache,
  markNotificationReadInCache,
  markNotificationsReadInCache,
  restoreOfflineNotificationCache,
  setNotificationPreferenceInData,
  type NotificationInfiniteData,
} from "../utils/notificationState";
import { queryKeys } from "./queryKeys";

const cacheKey = (userId: string) => `notifications-cache:${userId}`;

type NotificationsView = InfiniteData<NotificationsResponse, NotificationCursor | null> & NotificationsResponse;

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Notification request failed");
  }
  return response.json() as Promise<T>;
}

async function fetchNotificationsPage(
  userId: string,
  cursor: NotificationCursor | null,
): Promise<NotificationsResponse> {
  try {
    const queueFlushed = await flushNotificationReadQueue(userId);
    if (!queueFlushed) throw new Error("Notification reads are waiting for a connection");
    const cursorQuery = cursor
      ? `&cursor_created_at=${encodeURIComponent(cursor.created_at)}&cursor_id=${encodeURIComponent(cursor.id)}`
      : "";
    const response = await fetchWithAuth(`/notifications?limit=40${cursorQuery}`);
    return await readJson<NotificationsResponse>(response);
  } catch (error) {
    if (cursor) throw error;
    const cached = await AsyncStorage.getItem(cacheKey(userId)).catch(() => null);
    if (!cached) throw error;
    try {
      return restoreOfflineNotificationCache(
        JSON.parse(cached) as NotificationsResponse,
      );
    } catch {
      throw error;
    }
  }
}

export async function refreshNotificationReads(userId: string): Promise<boolean> {
  return flushNotificationReadQueue(userId);
}

export async function clearNotificationLocalState(userId: string): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(cacheKey(userId)),
    clearNotificationReadQueue(userId),
  ]);
}

export function setCachedNotificationPreference(
  queryClient: QueryClient,
  userId: string,
  preference: NotificationPreference,
): void {
  queryClient.setQueryData<NotificationInfiniteData>(
    queryKeys.notifications(userId),
    (previous) => setNotificationPreferenceInData(previous, preference),
  );
}

export function useNotifications(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const enabled = !!userId && options?.enabled !== false;
  const query = useInfiniteQuery({
    queryKey: queryKeys.notifications(userId),
    queryFn: ({ pageParam }) => fetchNotificationsPage(userId!, pageParam),
    initialPageParam: null as NotificationCursor | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : null,
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    select: (data): NotificationsView => ({
      ...data,
      ...flattenNotificationPages(data)!,
    }),
  });

  React.useEffect(() => {
    if (!userId || !query.data || query.data.is_offline_cache) return;
    const snapshot = flattenNotificationPages(query.data);
    if (snapshot) {
      AsyncStorage.setItem(cacheKey(userId), JSON.stringify(snapshot)).catch(() => {});
    }
  }, [query.data, userId]);

  return query;
}

export function useNotification(notificationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  return useQuery({
    queryKey: queryKeys.notification(userId, notificationId ?? ""),
    queryFn: async () => {
      const response = await fetchWithAuth(`/notifications?id=${notificationId}`);
      return readJson<TransactionNotification>(response);
    },
    enabled: !!userId && !!notificationId,
    initialData: () => flattenNotificationPages(
      queryClient.getQueryData<NotificationInfiniteData>(queryKeys.notifications(userId)),
    )?.items.find((item) => item.id === notificationId),
  });
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = queryKeys.notifications(userId);
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("Sign in to update notifications");
      const target = flattenNotificationPages(
        queryClient.getQueryData<NotificationInfiniteData>(queryKey),
      )?.items.find((item) => item.id === id);
      await enqueueNotificationRead(userId, {
        kind: "read",
        id,
        created_at: target?.created_at ?? new Date().toISOString(),
        queued_at: new Date().toISOString(),
      });
      return { flushed: await flushNotificationReadQueue(userId) };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationInfiniteData>(queryKey);
      queryClient.setQueryData<NotificationInfiniteData>(
        queryKey,
        (current) => markNotificationReadInCache(current, id, new Date().toISOString()),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: ({ flushed }) => {
      if (flushed) queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useMarkNotificationsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = queryKeys.notifications(userId);
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!userId) throw new Error("Sign in to update notifications");
      const now = new Date().toISOString();
      const cachedItems = flattenNotificationPages(
        queryClient.getQueryData<NotificationInfiniteData>(queryKey),
      )?.items ?? [];
      const createdAtById = new Map(cachedItems.map((item) => [item.id, item.created_at]));
      await enqueueNotificationReads(userId, ids.map((id) => ({
        kind: "read" as const,
        id,
        created_at: createdAtById.get(id) ?? now,
        queued_at: now,
      })));
      return { flushed: await flushNotificationReadQueue(userId) };
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationInfiniteData>(queryKey);
      queryClient.setQueryData<NotificationInfiniteData>(
        queryKey,
        (current) => markNotificationsReadInCache(current, ids, new Date().toISOString()),
      );
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: ({ flushed }) => {
      if (flushed) queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = queryKeys.notifications(userId);
  return useMutation({
    mutationFn: async (through: string) => {
      if (!userId) throw new Error("Sign in to update notifications");
      await enqueueNotificationRead(userId, {
        kind: "read_all",
        through,
        queued_at: through,
      });
      return { flushed: await flushNotificationReadQueue(userId) };
    },
    onMutate: async (through) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationInfiniteData>(queryKey);
      queryClient.setQueryData<NotificationInfiniteData>(
        queryKey,
        (current) => markAllNotificationsReadInCache(current, through, through),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: ({ flushed }) => {
      if (flushed) queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useUpdateNotificationPreference() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  return useMutation({
    mutationFn: async (input:
      | { action: "preference"; push_enabled: boolean; permission_status: NotificationPreference["permission_status"] }
      | { action: "dismiss_nudge" }
    ) => {
      const response = await fetchWithAuth("/notifications", {
        method: "PUT",
        body: JSON.stringify(input),
      });
      return readJson<NotificationPreference>(response);
    },
    onSuccess: (preference) => {
      if (userId) setCachedNotificationPreference(queryClient, userId, preference);
    },
  });
}
