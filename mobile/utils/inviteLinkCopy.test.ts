import { assertEquals } from "jsr:@std/assert@1";
import { DEAD_END_INVITE_LINK_MESSAGE } from "./inviteLinkCopy.ts";

Deno.test("dead-end invite banner asks for a new link", () => {
  assertEquals(
    DEAD_END_INVITE_LINK_MESSAGE,
    "This invite link isn't working anymore. Ask whoever invited you for a new link.",
  );
});
