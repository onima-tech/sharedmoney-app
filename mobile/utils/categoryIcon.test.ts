import { assertEquals } from "jsr:@std/assert@1";
import { getCategoryIcon, UNCATEGORISED_CATEGORY_ICON } from "./categoryIcon.ts";

Deno.test("empty category uses the neutral tag, not a question mark", () => {
  for (const category of ["", "   ", null, undefined]) {
    assertEquals(getCategoryIcon(category), UNCATEGORISED_CATEGORY_ICON);
    assertEquals(getCategoryIcon(category) === "help-circle-outline", false);
  }
});

Deno.test("known categories keep their glyphs", () => {
  assertEquals(getCategoryIcon("Food"), "silverware-fork-knife");
  assertEquals(getCategoryIcon("Uber"), "taxi");
  assertEquals(getCategoryIcon("grocery"), "cart-outline");
  assertEquals(getCategoryIcon("supermarket"), "cart-outline");
  assertEquals(getCategoryIcon("Movies"), "movie-open-outline");
  assertEquals(getCategoryIcon("Flight"), "airplane");
  assertEquals(getCategoryIcon("Shopping"), "shopping-outline");
  assertEquals(getCategoryIcon("Rent"), "home-outline");
  assertEquals(getCategoryIcon("Utilities"), "lightning-bolt-outline");
  assertEquals(getCategoryIcon("Health"), "medical-bag");
});

Deno.test("unrecognized categories use the same neutral tag", () => {
  assertEquals(getCategoryIcon("Other"), UNCATEGORISED_CATEGORY_ICON);
  assertEquals(getCategoryIcon("Custom thing"), UNCATEGORISED_CATEGORY_ICON);
});
