import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  groupByLedgerDateSection,
  ledgerDateSectionLabel,
} from "./ledgerDateSections.ts";

/** Thursday 12 Nov 2026, local. */
const NOW = new Date(2026, 10, 12, 15, 0, 0);

Deno.test("ledger date labels: today, yesterday, this week, earlier this month, then month names", () => {
  assertEquals(ledgerDateSectionLabel("2026-11-12", NOW), "Today");
  assertEquals(ledgerDateSectionLabel("2026-11-11", NOW), "Yesterday");
  // Monday of this ISO week, after yesterday.
  assertEquals(ledgerDateSectionLabel("2026-11-09", NOW), "This week");
  // Sunday sits in the previous ISO week, still this month.
  assertEquals(ledgerDateSectionLabel("2026-11-08", NOW), "Earlier this month");
  assertEquals(ledgerDateSectionLabel("2026-11-01", NOW), "Earlier this month");
  assertEquals(ledgerDateSectionLabel("2026-10-15", NOW), "October 2026");
  assertEquals(ledgerDateSectionLabel("2025-11-12", NOW), "November 2025");
});

Deno.test("yesterday wins when it falls in the previous ISO week", () => {
  const monday = new Date(2026, 10, 9, 9, 0, 0);
  assertEquals(ledgerDateSectionLabel("2026-11-09", monday), "Today");
  assertEquals(ledgerDateSectionLabel("2026-11-08", monday), "Yesterday");
  assertEquals(ledgerDateSectionLabel("2026-11-07", monday), "Earlier this month");
});

Deno.test("date-only strings do not shift a day, timestamps use the local calendar day", () => {
  assertEquals(ledgerDateSectionLabel("2026-11-12T23:30:00", NOW), "Today");
  assertEquals(ledgerDateSectionLabel("not-a-date", NOW), "Earlier");
  assertEquals(ledgerDateSectionLabel("", NOW), "Earlier");
});

Deno.test("groupByLedgerDateSection keeps order and merges only consecutive labels", () => {
  const sections = groupByLedgerDateSection(
    [
      { id: "a", date: "2026-11-12" },
      { id: "b", date: "2026-11-12" },
      { id: "c", date: "2026-11-09" },
      { id: "d", date: "2026-10-02" },
    ],
    (item) => item.date,
    NOW,
  );
  assertEquals(sections.map((section) => section.label), [
    "Today",
    "This week",
    "October 2026",
  ]);
  assertEquals(sections[0].items.map((item) => item.id), ["a", "b"]);
  assertEquals(sections[1].items.map((item) => item.id), ["c"]);
});
