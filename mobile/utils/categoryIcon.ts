/** Neutral glyph for an expense with no category. Not a question mark. */
export const UNCATEGORISED_CATEGORY_ICON = "tag-outline";

/**
 * Ledger category glyph. Empty / missing category uses the same neutral tag
 * as an unrecognized label. `help-circle-outline` is a "?" and reads as a
 * broken icon on the first uncategorised expense.
 */
export function getCategoryIcon(category: string | null | undefined): string {
  const lowerCat = category?.toLowerCase() || "";
  if (!lowerCat.trim()) return UNCATEGORISED_CATEGORY_ICON;
  if (lowerCat.includes("food") || lowerCat.includes("restaurant")) return "silverware-fork-knife";
  if (lowerCat.includes("transport") || lowerCat.includes("taxi") || lowerCat.includes("uber")) return "taxi";
  if (lowerCat.includes("grocery") || lowerCat.includes("market")) return "cart-outline";
  if (lowerCat.includes("entertainment") || lowerCat.includes("movie")) return "movie-open-outline";
  if (lowerCat.includes("travel") || lowerCat.includes("flight")) return "airplane";
  if (lowerCat.includes("shopping")) return "shopping-outline";
  if (lowerCat.includes("rent")) return "home-outline";
  if (lowerCat.includes("utilities") || lowerCat.includes("utility")) return "lightning-bolt-outline";
  if (lowerCat.includes("health") || lowerCat.includes("medical")) return "medical-bag";
  return UNCATEGORISED_CATEGORY_ICON;
}
