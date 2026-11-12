import type { Participant } from "../types";

export interface LedgerNameMember {
  participant_id?: string | null;
  id?: string | null;
  user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  status?: string | null;
}

export function resolveLedgerParticipantName(input: {
  participantId?: string | null;
  userId?: string | null;
  currentUserId?: string | null;
  participants?: Participant[] | null;
  members?: LedgerNameMember[] | null;
}): string {
  const participants = input.participants ?? [];
  const members = input.members ?? [];
  const { participantId, userId, currentUserId } = input;

  if (participantId) {
    const participant = participants.find((person) => person.id === participantId);
    if (participant) {
      const baseName = participant.user_id === currentUserId
        ? "You"
        : participant.full_name
          || participant.email?.split("@")[0]
          || participant.email
          || "Unknown";
      return participant.type === "former" ? `${baseName} (Former)` : baseName;
    }

    const member = members.find((person) =>
      person.participant_id === participantId || person.id === participantId
    );
    if (member) {
      const baseName = member.user_id === currentUserId
        ? "You"
        : member.full_name || member.email?.split("@")[0] || member.email || "Unknown";
      return member.status === "left" ? `${baseName} (Former)` : baseName;
    }
  }

  if (userId) {
    if (userId === currentUserId) return "You";
    const payer = members.find((person) => person.user_id === userId);
    if (payer) {
      return payer.full_name || payer.email?.split("@")[0] || payer.email || "Unknown";
    }
  }

  return "Unknown";
}
