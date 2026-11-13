import { assertEquals } from "jsr:@std/assert@1";
import { phase2ShotIsDetail, readGroupsPhase2Shot } from "./groupsPhase2Shots.ts";

Deno.test("phase 2 shot query falls back to the owed group", () => {
  assertEquals(readGroupsPhase2Shot("?preview=groups-phase2&shot=settle"), "settle");
  assertEquals(readGroupsPhase2Shot("?preview=groups-phase2&shot=christophers"), "christophers");
  assertEquals(readGroupsPhase2Shot("?shot=detail-equal"), "detail-equal");
  assertEquals(readGroupsPhase2Shot("?shot=nope"), "owed");
  assertEquals(readGroupsPhase2Shot(null), "owed");
  assertEquals(phase2ShotIsDetail("detail-payment"), true);
  assertEquals(phase2ShotIsDetail("owed"), false);
});
