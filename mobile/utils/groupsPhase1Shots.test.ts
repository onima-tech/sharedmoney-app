import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  phase1ShotKeepsLedger,
  phase1ShotShowsAddExpense,
  readGroupsPhase1Shot,
} from "./groupsPhase1Shots.ts";

Deno.test("balances failure keeps the ledger and Add expense", () => {
  assertEquals(phase1ShotKeepsLedger("balances"), true);
  assertEquals(phase1ShotShowsAddExpense("balances"), true);
});

Deno.test("search hides Add expense; empty and offline have no ledger", () => {
  assertEquals(phase1ShotShowsAddExpense("search"), false);
  assertEquals(phase1ShotShowsAddExpense("empty"), false);
  assertEquals(phase1ShotKeepsLedger("empty"), false);
  assertEquals(phase1ShotKeepsLedger("search"), true);
  assertEquals(phase1ShotKeepsLedger("offline"), false);
  assertEquals(phase1ShotShowsAddExpense("offline"), false);
});

Deno.test("saving and mixed-currency shots keep rows and the pill", () => {
  assertEquals(phase1ShotKeepsLedger("saving"), true);
  assertEquals(phase1ShotKeepsLedger("mixed"), true);
  assertEquals(phase1ShotShowsAddExpense("saving"), true);
  assertEquals(phase1ShotShowsAddExpense("mixed"), true);
  assertEquals(phase1ShotShowsAddExpense("ready"), true);
  assertEquals(phase1ShotShowsAddExpense("payment"), true);
});

Deno.test("shot query reads saving and mixed, and unknown values stay ready", () => {
  assertEquals(readGroupsPhase1Shot("?preview=groups-phase1&shot=saving"), "saving");
  assertEquals(readGroupsPhase1Shot("?shot=mixed"), "mixed");
  assertEquals(readGroupsPhase1Shot("?shot=balances"), "balances");
  assertEquals(readGroupsPhase1Shot("?shot=nope"), "ready");
  assertEquals(readGroupsPhase1Shot(null), "ready");
});
