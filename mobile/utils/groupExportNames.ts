/** Display name for an export column or PDF row. Keeps the typed name, never "You". */
export function exportPersonName(person: {
  full_name?: string | null;
  email?: string | null;
} | null | undefined): string {
  const full = person?.full_name?.trim() ?? "";
  if (full && full.toLowerCase() !== "you") return full;
  const email = person?.email?.trim() ?? "";
  if (email.includes("@")) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }
  return full || "Member";
}
