import { assertEquals } from "jsr:@std/assert@1";
import { exportPersonName, resolveSettlementPerson } from "./groupExportNames.ts";

const invited = { id: "invited", user_id: null, full_name: "Invited" };
const dev = { id: "payer", user_id: "user-dev", full_name: "Dev" };
const aisha = { id: "aisha", user_id: "user-aisha", full_name: "Aisha" };

Deno.test("resolveSettlementPerson uses the participant id when an earlier invite has a null user id", () => {
  const person = resolveSettlementPerson([invited, dev], "payer", null);
  assertEquals(exportPersonName(person), "Dev");
});

Deno.test("resolveSettlementPerson matches a user id when the settlement has no participant id", () => {
  const person = resolveSettlementPerson([invited, aisha], undefined, "user-aisha");
  assertEquals(exportPersonName(person), "Aisha");
});

Deno.test("resolveSettlementPerson names an unmatched party Member", () => {
  const person = resolveSettlementPerson([invited], "missing", null);
  assertEquals(exportPersonName(person), "Member");
});
