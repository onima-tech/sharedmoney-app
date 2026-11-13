import {
  canRemovePerson,
  type ExistingPerson,
  filterAndSortExistingPeople,
  memberRowShowsMenu,
} from "../mobile/utils/peoplePicker.ts";

const people: ExistingPerson[] = [
  {
    id: "p-3",
    full_name: "Arya",
    email: "arya@example.com",
  },
  {
    id: "p-1",
    full_name: "Anuj",
    email: "anuj@example.com",
    user_id: "u-anuj",
  },
  {
    id: "p-2",
    full_name: "Anuj",
    email: "anuj@example.com",
    user_id: "u-anuj",
  },
  {
    id: "p-4",
    full_name: "Sam",
  },
];

Deno.test("filters people by name or email and drops repeats", () => {
  const result = filterAndSortExistingPeople(people, "anuj");

  if (result.length !== 1) throw new Error("expected one unique Anuj");
  if (result[0].email !== "anuj@example.com") {
    throw new Error("expected email on the unique match");
  }
});

Deno.test("finds a person with no stored name by email", () => {
  const result = filterAndSortExistingPeople(
    [{
      id: "p-alex",
      full_name: "",
      email: "alex.doe@example.com",
      user_id: "u-alex",
    }],
    "alex.doe",
  );

  if (result.length !== 1) throw new Error("expected the email-only person");
  if (result[0].email !== "alex.doe@example.com") {
    throw new Error("expected alex.doe@example.com");
  }
});

Deno.test("matches the directory by email as well as name", () => {
  const result = filterAndSortExistingPeople(people, "arya@");

  if (result.length !== 1 || result[0].full_name !== "Arya") {
    throw new Error("expected Arya to match by email");
  }
});

Deno.test("sorts the unique directory by person name then email", () => {
  const result = filterAndSortExistingPeople(people, "");

  const labels = result.map((person) =>
    `${person.full_name}:${person.email ?? ""}`
  );
  const expected = ["Anuj:anuj@example.com", "Arya:arya@example.com", "Sam:"];
  if (labels.join("|") !== expected.join("|")) {
    throw new Error(`unexpected sort order: ${labels.join("|")}`);
  }
});

Deno.test("allows a group manager to remove an unlinked active person", () => {
  const canRemove = canRemovePerson(
    { id: "p-1", type: "member", user_id: null },
    { canManageMembers: true, currentUserId: "owner-id" },
  );

  if (!canRemove) {
    throw new Error("expected an unlinked active person to be removable");
  }
});

Deno.test("does not allow removal of a former person", () => {
  const canRemove = canRemovePerson(
    { id: "p-1", type: "former", user_id: null },
    { canManageMembers: true, currentUserId: "owner-id" },
  );

  if (canRemove) {
    throw new Error("former people should not have a removal action");
  }
});

Deno.test("menu column stays off for you and on for someone else or an unlinked email", () => {
  const you = memberRowShowsMenu(
    { type: "member", user_id: "me", email: "you@example.com" },
    { canManageMembers: true, currentUserId: "me", canBlock: true },
  );
  const other = memberRowShowsMenu(
    { type: "member", user_id: "rahul", email: "rahul@example.com" },
    { canManageMembers: true, currentUserId: "me", canBlock: true },
  );
  const unlinked = memberRowShowsMenu(
    { type: "member", user_id: null, email: "sam@example.com" },
    { canManageMembers: true, currentUserId: "me", canBlock: true },
  );
  const former = memberRowShowsMenu(
    { type: "former", user_id: null, email: "dev@example.com" },
    { canManageMembers: true, currentUserId: "me", canBlock: true },
  );
  if (you || !other || !unlinked || former) {
    throw new Error("menu column did not match the people-row actions");
  }
});

Deno.test("does not offer removal for an invited person", () => {
  const canRemove = canRemovePerson(
    { id: "p-1", type: "invited", user_id: null },
    { canManageMembers: true, currentUserId: "owner-id" },
  );

  if (canRemove) {
    throw new Error("invited people should be cancelled through their invitation");
  }
});
