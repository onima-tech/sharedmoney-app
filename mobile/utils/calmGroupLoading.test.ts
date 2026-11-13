import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  CALM_LOADING_DELAY_MS,
  shouldShowCalmLoadingLine,
  shouldShowPositionPlaceholder,
} from "./calmGroupLoading.ts";

Deno.test("a first open shows one number placeholder and no Even claim", () => {
  assertEquals(shouldShowPositionPlaceholder({
    solo: false,
    searchOpen: false,
    balancesReady: false,
    balancesError: false,
  }), true);
  assertEquals(shouldShowPositionPlaceholder({
    solo: false,
    searchOpen: false,
    balancesReady: true,
    balancesError: false,
  }), false);
  assertEquals(shouldShowPositionPlaceholder({
    solo: true,
    searchOpen: false,
    balancesReady: false,
    balancesError: false,
  }), false);
});

Deno.test("the muted loading line waits 800ms and stays off once rows exist", () => {
  assertEquals(shouldShowCalmLoadingLine({
    listPending: true,
    listHasRows: false,
    elapsedMs: CALM_LOADING_DELAY_MS - 1,
  }), false);
  assertEquals(shouldShowCalmLoadingLine({
    listPending: true,
    listHasRows: false,
    elapsedMs: CALM_LOADING_DELAY_MS,
  }), true);
  assertEquals(shouldShowCalmLoadingLine({
    listPending: true,
    listHasRows: true,
    elapsedMs: CALM_LOADING_DELAY_MS,
  }), false);
});
