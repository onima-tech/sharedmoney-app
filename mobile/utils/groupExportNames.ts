export type SettlementPersonRef = {
  id?: string;
  user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
};

/**
 * Who paid or received a recorded settlement.
 * Participant id wins. A missing user id must not match an invite whose
 * user_id is also missing (`null === null`).
 */
export function resolveSettlementPerson(
  participants: readonly SettlementPersonRef[],
  participantId: string | null | undefined,
  userId: string | null | undefined,
): SettlementPersonRef {
  if (typeof participantId === "string" && participantId.length > 0) {
    const byParticipant = participants.find((person) => person.id === participantId);
    if (byParticipant) return byParticipant;
  }
  if (typeof userId === "string" && userId.length > 0) {
    const byUser = participants.find((person) => person.user_id === userId);
    if (byUser) return byUser;
  }
  return {};
}

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
