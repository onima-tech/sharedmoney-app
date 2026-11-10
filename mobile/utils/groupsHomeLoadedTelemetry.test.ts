import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  createGroupsHomeLoadClock,
  resolveGroupsHomeLoadedTiming,
  updateGroupsHomeLoadClock,
} from "./groupsHomeLoadedTelemetry.ts";

const APP_START = 1_000;

function coldClock() {
  return createGroupsHomeLoadClock(APP_START, "groups");
}

Deno.test("signed-in cold start keeps the app-start stamp", () => {
  const restored = updateGroupsHomeLoadClock(coldClock(), {
    nowMs: 1_800,
    userId: "user-1",
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  assertEquals(restored.startedAtMs, APP_START);
  assertEquals(restored.userId, "user-1");
});

Deno.test("later ticks while Home stays up do not restart the clock", () => {
  const restored = updateGroupsHomeLoadClock(coldClock(), {
    nowMs: 1_800,
    userId: "user-1",
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  const stillHome = updateGroupsHomeLoadClock(restored, {
    nowMs: 4_000,
    userId: "user-1",
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  assertEquals(stillHome, restored);
  assertEquals(stillHome.startedAtMs, APP_START);
});

Deno.test("sign-in after a logged-out screen starts at sign-in, not app open", () => {
  const loggedOut = updateGroupsHomeLoadClock(coldClock(), {
    nowMs: 1_200,
    userId: null,
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  const signedIn = updateGroupsHomeLoadClock(loggedOut, {
    nowMs: 9_000,
    userId: "user-1",
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  assertEquals(loggedOut.startedAtMs, APP_START);
  assertEquals(loggedOut.sawLoggedOut, true);
  assertEquals(signedIn.startedAtMs, 9_000);
  assertEquals(signedIn.sawLoggedOut, false);
});

Deno.test("returning to Home restarts the clock for the same user", () => {
  const home = updateGroupsHomeLoadClock(coldClock(), {
    nowMs: 1_500,
    userId: "user-1",
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  const details = updateGroupsHomeLoadClock(home, {
    nowMs: 2_000,
    userId: "user-1",
    authLoading: false,
    route: "group-details",
    termsBlocking: false,
  });
  const back = updateGroupsHomeLoadClock(details, {
    nowMs: 2_400,
    userId: "user-1",
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  assertEquals(details.startedAtMs, APP_START);
  assertEquals(back.startedAtMs, 2_400);
});

Deno.test("finishing terms starts the home visit when the list can show", () => {
  const signedIn = updateGroupsHomeLoadClock(coldClock(), {
    nowMs: 1_400,
    userId: "user-1",
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  const onTerms = updateGroupsHomeLoadClock(signedIn, {
    nowMs: 1_500,
    userId: "user-1",
    authLoading: false,
    route: "groups",
    termsBlocking: true,
  });
  const accepted = updateGroupsHomeLoadClock(onTerms, {
    nowMs: 8_000,
    userId: "user-1",
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  assertEquals(onTerms.startedAtMs, APP_START);
  assertEquals(accepted.startedAtMs, 8_000);
});

Deno.test("account switch restarts the clock", () => {
  const first = updateGroupsHomeLoadClock(coldClock(), {
    nowMs: 1_500,
    userId: "user-1",
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  const second = updateGroupsHomeLoadClock(first, {
    nowMs: 3_000,
    userId: "user-2",
    authLoading: false,
    route: "groups",
    termsBlocking: false,
  });
  assertEquals(second.startedAtMs, 3_000);
  assertEquals(second.userId, "user-2");
});

Deno.test("warm cache reports the visit wait, not a zeroed ready effect", () => {
  const timing = resolveGroupsHomeLoadedTiming({
    startedAtMs: APP_START,
    renderedAtMs: 1_840,
    sawInitialLoading: false,
  });
  assertEquals(timing.duration_ms, 840);
  assertEquals(timing.from_cache, true);
});

Deno.test("cold fetch is not labeled from_cache", () => {
  const timing = resolveGroupsHomeLoadedTiming({
    startedAtMs: APP_START,
    renderedAtMs: 2_650,
    sawInitialLoading: true,
  });
  assertEquals(timing.duration_ms, 1_650);
  assertEquals(timing.from_cache, false);
});

Deno.test("never emits negative duration_ms", () => {
  const timing = resolveGroupsHomeLoadedTiming({
    startedAtMs: 2_000,
    renderedAtMs: 1_999,
    sawInitialLoading: false,
  });
  assertEquals(timing.duration_ms, 0);
});
