import { assertEquals } from "jsr:@std/assert@1";
import { readDefaultSplitShot } from "./defaultSplitShots.ts";

Deno.test("default split preview reads its shot names", () => {
  assertEquals(readDefaultSplitShot("?preview=default-split&shot=settings-equal"), "settings-equal");
  assertEquals(readDefaultSplitShot("?shot=settings-weights"), "settings-weights");
  assertEquals(readDefaultSplitShot("?shot=expense-prefill"), "expense-prefill");
  assertEquals(readDefaultSplitShot("?shot=expense-changed"), "expense-changed");
  assertEquals(readDefaultSplitShot("?shot=expense-unchanged"), "expense-unchanged");
  assertEquals(readDefaultSplitShot("?shot=menu"), "menu");
  assertEquals(readDefaultSplitShot("?shot=search"), "settings-equal");
  assertEquals(readDefaultSplitShot(null), "settings-equal");
});
