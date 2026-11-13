import { assertEquals } from "jsr:@std/assert@1";
import { readGroupsPhase3Shot } from "./groupsPhase3Shots.ts";

Deno.test("phase 3 shots default to owed and read the query", () => {
  assertEquals(readGroupsPhase3Shot("?preview=groups-phase3&shot=split"), "split");
  assertEquals(readGroupsPhase3Shot("?shot=error"), "error");
  assertEquals(readGroupsPhase3Shot("?shot=nope"), "owed");
  assertEquals(readGroupsPhase3Shot(null), "owed");
});
