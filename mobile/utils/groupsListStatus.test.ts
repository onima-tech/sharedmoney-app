import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { groupsListStatusLine } from "./groupsListStatus.ts";

Deno.test("saved groups stay up: offline line, or a muted refresh retry", () => {
  assertEquals(groupsListStatusLine({
    offline: true,
    hasSavedGroups: true,
    hasError: true,
  }), { kind: "offline", text: "Offline · showing saved groups" });

  assertEquals(groupsListStatusLine({
    offline: false,
    hasSavedGroups: true,
    hasError: true,
  }), { kind: "refresh-error", text: "Couldn’t refresh · Retry" });

  assertEquals(groupsListStatusLine({
    offline: false,
    hasSavedGroups: false,
    hasError: false,
  }), null);
});

Deno.test("offline with nothing saved does not claim saved groups", () => {
  assertEquals(groupsListStatusLine({
    offline: true,
    hasSavedGroups: false,
    hasError: true,
  }), { kind: "refresh-error", text: "Couldn’t refresh · Retry" });
});
