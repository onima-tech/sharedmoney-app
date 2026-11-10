import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { recordSettlementBatch } from "./settlementBatch.ts";

Deno.test("recordSettlementBatch returns every successful post", async () => {
  const posted: string[] = [];
  const created = await recordSettlementBatch(["a", "b"], async (id) => {
    posted.push(id);
    return { id };
  });
  assertEquals(posted, ["a", "b"]);
  assertEquals(created, [{ id: "a" }, { id: "b" }]);
});

Deno.test("recordSettlementBatch keeps the first failure when nothing was saved", async () => {
  await assertRejects(
    () => recordSettlementBatch(["a"], async () => {
      throw new Error("Not an active group member");
    }),
    Error,
    "Not an active group member",
  );
});

Deno.test("recordSettlementBatch reports payments already recorded", async () => {
  await assertRejects(
    () => recordSettlementBatch(["a", "b"], async (id) => {
      if (id === "b") throw new Error("Not an active group member");
      return id;
    }),
    Error,
    "Recorded 1 of 2 group payments, then one failed: Not an active group member",
  );
});
