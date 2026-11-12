import { assertEquals } from "jsr:@std/assert@1";
import { ANALYTICS_EVENTS } from "./posthogEvents.ts";
import {
  bindInviteLandingAnalytics,
  collectInviteLandingEvents,
  INVITE_LANDING_CAPTURE_KEY,
  INVITE_LANDING_PENDING_VIEW_ATTR,
  INVITE_LANDING_QUEUE_KEY,
  INVITE_LANDING_SOURCE,
  inviteLandingCtaProperties,
  inviteLandingViewedProperties,
} from "./inviteLandingAnalytics.ts";

const TOKEN = "ab".repeat(32);

Deno.test("invite landing properties are source and cta only", () => {
  assertEquals(inviteLandingViewedProperties(), { source: INVITE_LANDING_SOURCE });
  assertEquals(inviteLandingCtaProperties("play"), {
    source: INVITE_LANDING_SOURCE,
    cta: "play",
  });
  assertEquals(INVITE_LANDING_SOURCE, "invite_join");
});

Deno.test("queued invite events drop tokens and unknown ctas", () => {
  const raw = JSON.stringify([
    { event: ANALYTICS_EVENTS.INVITE_LANDING_VIEWED, token: TOKEN, path: `/app/join/${TOKEN}` },
    { event: ANALYTICS_EVENTS.INVITE_LANDING_VIEWED },
    {
      event: ANALYTICS_EVENTS.INVITE_LANDING_CTA_CLICKED,
      cta: "play",
      token: TOKEN,
    },
    { event: ANALYTICS_EVENTS.INVITE_LANDING_CTA_CLICKED, cta: "email" },
    { event: "group_joined", cta: "play" },
    { event: ANALYTICS_EVENTS.INVITE_LANDING_CTA_CLICKED, cta: "web_app" },
  ]);

  assertEquals(collectInviteLandingEvents({ queueRaw: raw, pendingView: true }), [
    {
      event: ANALYTICS_EVENTS.INVITE_LANDING_VIEWED,
      properties: { source: "invite_join" },
    },
    {
      event: ANALYTICS_EVENTS.INVITE_LANDING_CTA_CLICKED,
      properties: { source: "invite_join", cta: "play" },
    },
    {
      event: ANALYTICS_EVENTS.INVITE_LANDING_CTA_CLICKED,
      properties: { source: "invite_join", cta: "web_app" },
    },
  ]);
  assertEquals(
    JSON.stringify(collectInviteLandingEvents({ queueRaw: raw, pendingView: false })).includes(TOKEN),
    false,
  );
});

Deno.test("a pending view is counted once when the queue could not be written", () => {
  assertEquals(collectInviteLandingEvents({ queueRaw: null, pendingView: true }), [
    {
      event: ANALYTICS_EVENTS.INVITE_LANDING_VIEWED,
      properties: { source: "invite_join" },
    },
  ]);
  assertEquals(collectInviteLandingEvents({ queueRaw: "not-json", pendingView: false }), []);
});

Deno.test("bind flushes the pre-bundle queue into the app client", () => {
  const scope = globalThis as Record<string, unknown>;
  const store = new Map<string, string>([
    [
      INVITE_LANDING_QUEUE_KEY,
      JSON.stringify([
        { event: ANALYTICS_EVENTS.INVITE_LANDING_VIEWED },
        { event: ANALYTICS_EVENTS.INVITE_LANDING_CTA_CLICKED, cta: "app_store" },
      ]),
    ],
  ]);
  const attrs = new Map<string, string>([[INVITE_LANDING_PENDING_VIEW_ATTR, "1"]]);
  const captured: Array<{ event: string; properties: Record<string, string> }> = [];
  const previousDocument = Object.getOwnPropertyDescriptor(scope, "document");
  const previousSession = Object.getOwnPropertyDescriptor(scope, "sessionStorage");
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => store.delete(key),
  };
  Object.defineProperty(scope, "document", {
    configurable: true,
    value: {
      documentElement: {
        getAttribute: (name: string) => attrs.get(name) ?? null,
        removeAttribute: (name: string) => attrs.delete(name),
      },
    },
  });
  Object.defineProperty(scope, "sessionStorage", {
    configurable: true,
    value: storage,
  });
  delete scope[INVITE_LANDING_CAPTURE_KEY];

  const restore = (name: string, descriptor: PropertyDescriptor | undefined) => {
    if (descriptor) Object.defineProperty(scope, name, descriptor);
    else delete scope[name];
  };

  try {
    bindInviteLandingAnalytics((event, properties) => {
      captured.push({ event, properties });
    });
    assertEquals(captured, [
      {
        event: ANALYTICS_EVENTS.INVITE_LANDING_VIEWED,
        properties: { source: "invite_join" },
      },
      {
        event: ANALYTICS_EVENTS.INVITE_LANDING_CTA_CLICKED,
        properties: { source: "invite_join", cta: "app_store" },
      },
    ]);
    assertEquals(store.has(INVITE_LANDING_QUEUE_KEY), false);
    assertEquals(attrs.has(INVITE_LANDING_PENDING_VIEW_ATTR), false);

    const late = scope[INVITE_LANDING_CAPTURE_KEY] as (
      event: string,
      properties: Record<string, string>,
    ) => void;
    late(ANALYTICS_EVENTS.INVITE_LANDING_CTA_CLICKED, {
      source: "invite_join",
      cta: "open_app",
    });
    assertEquals(captured[2]?.properties.cta, "open_app");
    bindInviteLandingAnalytics(() => {
      captured.push({ event: "again", properties: {} });
    });
    assertEquals(captured.length, 3);
  } finally {
    restore("document", previousDocument);
    restore("sessionStorage", previousSession);
    delete scope[INVITE_LANDING_CAPTURE_KEY];
  }
});
