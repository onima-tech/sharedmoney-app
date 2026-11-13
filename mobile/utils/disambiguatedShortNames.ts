/**
 * First-name labels for settle and balance rows.
 * A shared first name gains a last initial. A shared initial uses the full
 * name. A shared first name with no last name uses the email local part.
 */
export type ShortNameParticipant = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  user_id?: string | null;
};

function tokens(value: string): string[] {
  return value.trim().split(/\s+/).filter((part) => part.length > 0);
}

function emailLocalPart(email?: string | null): string | null {
  const trimmed = email?.trim() ?? "";
  if (!trimmed.includes("@")) return null;
  const local = trimmed.split("@")[0]?.trim() ?? "";
  return local.length > 0 ? local : null;
}

function isPronounYou(fullName: string): boolean {
  return fullName.trim().toLowerCase() === "you";
}

function showsAsYou(
  person: ShortNameParticipant,
  currentUserId?: string | null,
): boolean {
  if (currentUserId && person.user_id && person.user_id === currentUserId) {
    return true;
  }
  if (!currentUserId && isPronounYou(person.full_name ?? "")) return true;
  return false;
}

/** Today's short name: first token, else email local-part, else Someone. */
function baseShortName(person: ShortNameParticipant): string {
  const full = person.full_name?.trim() ?? "";
  if (full && !isPronounYou(full)) {
    return tokens(full)[0] || full;
  }
  return emailLocalPart(person.email) ?? "Someone";
}

function realFirstName(person: ShortNameParticipant): string | null {
  const full = person.full_name?.trim() ?? "";
  if (!full || isPronounYou(full)) return null;
  return tokens(full)[0] ?? null;
}

function lastName(person: ShortNameParticipant): string | null {
  const full = person.full_name?.trim() ?? "";
  if (!full || isPronounYou(full)) return null;
  const parts = tokens(full);
  if (parts.length < 2) return null;
  return parts[parts.length - 1] ?? null;
}

/** First letter of the last name, or null when there is nothing to take. */
function lastInitial(last: string): string | null {
  const first = Array.from(last)[0];
  if (!first) return null;
  if (first.toLocaleLowerCase() === first.toLocaleUpperCase()) return null;
  return `${first.toLocaleUpperCase()}.`;
}

function fullNameLabel(person: ShortNameParticipant): string {
  const full = person.full_name?.trim() ?? "";
  if (full && !isPronounYou(full)) return full;
  return baseShortName(person);
}

export function disambiguatedShortNames(
  participants: readonly ShortNameParticipant[],
  currentUserId?: string | null,
): Map<string, string> {
  const labels = new Map<string, string>();
  const seen = new Set<string>();
  const people: ShortNameParticipant[] = [];
  for (const person of participants) {
    if (!person.id || seen.has(person.id)) continue;
    seen.add(person.id);
    people.push(person);
  }

  const groups = new Map<string, ShortNameParticipant[]>();
  for (const person of people) {
    const you = showsAsYou(person, currentUserId);
    const first = realFirstName(person);
    if (you && !first) {
      labels.set(person.id, "You");
      continue;
    }
    const key = (first ?? baseShortName(person)).toLocaleLowerCase();
    const group = groups.get(key);
    if (group) group.push(person);
    else groups.set(key, [person]);
  }

  for (const group of groups.values()) {
    if (group.length === 1) {
      const only = group[0];
      labels.set(
        only.id,
        showsAsYou(only, currentUserId) ? "You" : baseShortName(only),
      );
      continue;
    }

    const byInitial = new Map<string, ShortNameParticipant[]>();
    const noLastName: ShortNameParticipant[] = [];
    for (const person of group) {
      const last = lastName(person);
      const initial = last ? lastInitial(last) : null;
      if (!initial) {
        noLastName.push(person);
        continue;
      }
      const same = byInitial.get(initial);
      if (same) same.push(person);
      else byInitial.set(initial, [person]);
    }

    for (const [initial, same] of byInitial) {
      for (const person of same) {
        const label = same.length === 1
          ? `${realFirstName(person) ?? baseShortName(person)} ${initial}`
          : fullNameLabel(person);
        labels.set(person.id, showsAsYou(person, currentUserId) ? "You" : label);
      }
    }

    for (const person of noLastName) {
      const local = emailLocalPart(person.email);
      const label = local ?? (realFirstName(person) ?? baseShortName(person));
      labels.set(person.id, showsAsYou(person, currentUserId) ? "You" : label);
    }
  }

  return labels;
}
