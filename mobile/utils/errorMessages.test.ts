import { assertEquals } from "jsr:@std/assert@1";
import { getUserFriendlyErrorMessage } from "./errorMessages.ts";

Deno.test("former-member settlement errors stay specific", () => {
  assertEquals(
    getUserFriendlyErrorMessage(new Error("Not an active group member")),
    "You are not an active member of that group, so the payment was not recorded.",
  );
});

Deno.test("partial settle-all copy is not rewritten as a generic server error", () => {
  const message = "Recorded 1 of 2 group payments, then one failed: Internal server error";
  assertEquals(getUserFriendlyErrorMessage(new Error(message)), message);
});
