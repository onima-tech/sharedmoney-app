/**
 * PostHog events for the logged-out /app/join/:token shell.
 *
 * The static shell records a view and CTA clicks before the Expo bundle
 * loads (sessionStorage, or the capture hook once this module binds).
 * Properties stay on source + cta. The invite token is not an analytics field.
 */

import { ANALYTICS_EVENTS } from "./posthogEvents";

export const INVITE_LANDING_SOURCE = "invite_join";
export const INVITE_LANDING_QUEUE_KEY = "sharedmoney.inviteLandingQueue";
export const INVITE_LANDING_CAPTURE_KEY = "__smInviteLandingCapture";
export const INVITE_LANDING_PENDING_VIEW_ATTR = "data-sm-join-pending-view";
export const INVITE_LANDING_CTAS = ["play", "app_store", "open_app", "web_app"] as const;

export type InviteLandingCta = (typeof INVITE_LANDING_CTAS)[number];

export type InviteLandingCapture = (
  event: string,
  properties: Record<string, string>,
) => void;

export type InviteLandingEvent = {
  event: string;
  properties: Record<string, string>;
};

const QUEUE_LIMIT = 8;

export function isInviteLandingCta(value: string | null | undefined): value is InviteLandingCta {
  return (INVITE_LANDING_CTAS as readonly string[]).includes(value ?? "");
}

export function inviteLandingViewedProperties(): Record<string, string> {
  return { source: INVITE_LANDING_SOURCE };
}

export function inviteLandingCtaProperties(cta: InviteLandingCta): Record<string, string> {
  return { source: INVITE_LANDING_SOURCE, cta };
}

export function collectInviteLandingEvents(input: {
  queueRaw: string | null;
  pendingView: boolean;
}): InviteLandingEvent[] {
  const events: InviteLandingEvent[] = [];
  let sawView = false;

  for (const item of parseQueue(input.queueRaw)) {
    if (item.event === ANALYTICS_EVENTS.INVITE_LANDING_VIEWED) {
      if (sawView) continue;
      sawView = true;
      events.push({
        event: item.event,
        properties: inviteLandingViewedProperties(),
      });
      continue;
    }
    if (
      item.event === ANALYTICS_EVENTS.INVITE_LANDING_CTA_CLICKED &&
      isInviteLandingCta(item.cta)
    ) {
      events.push({
        event: item.event,
        properties: inviteLandingCtaProperties(item.cta),
      });
    }
  }

  if (input.pendingView && !sawView) {
    events.push({
      event: ANALYTICS_EVENTS.INVITE_LANDING_VIEWED,
      properties: inviteLandingViewedProperties(),
    });
  }

  return events;
}

function parseQueue(raw: string | null): Array<{ event?: string; cta?: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is { event?: string; cta?: string } => {
        return Boolean(item) && typeof item === "object";
      })
      .slice(0, QUEUE_LIMIT)
      .map((item) => ({
        event: typeof item.event === "string" ? item.event : undefined,
        cta: typeof item.cta === "string" ? item.cta : undefined,
      }));
  } catch {
    return [];
  }
}

type InviteLandingScope = {
  document?: {
    documentElement: {
      getAttribute(name: string): string | null;
      removeAttribute?(name: string): void;
    };
  };
  sessionStorage?: {
    getItem(key: string): string | null;
    removeItem(key: string): void;
  };
  [INVITE_LANDING_CAPTURE_KEY]?: InviteLandingCapture;
};

function landingScope(): InviteLandingScope | null {
  const scope = globalThis as InviteLandingScope;
  if (!scope.document || !scope.sessionStorage) return null;
  return scope;
}

/** Flush the pre-bundle queue into the app PostHog client. Idempotent. */
export function bindInviteLandingAnalytics(capture: InviteLandingCapture): void {
  const scope = landingScope();
  if (!scope?.document || !scope.sessionStorage) return;
  if (typeof scope[INVITE_LANDING_CAPTURE_KEY] === "function") return;

  scope[INVITE_LANDING_CAPTURE_KEY] = (event, properties) => {
    capture(event, properties);
  };

  let raw: string | null = null;
  try {
    raw = scope.sessionStorage.getItem(INVITE_LANDING_QUEUE_KEY);
    scope.sessionStorage.removeItem(INVITE_LANDING_QUEUE_KEY);
  } catch {
    raw = null;
  }

  const pending =
    scope.document.documentElement.getAttribute(INVITE_LANDING_PENDING_VIEW_ATTR) === "1";
  if (pending) {
    scope.document.documentElement.removeAttribute?.(INVITE_LANDING_PENDING_VIEW_ATTR);
  }

  for (const item of collectInviteLandingEvents({ queueRaw: raw, pendingView: pending })) {
    capture(item.event, item.properties);
  }
}
