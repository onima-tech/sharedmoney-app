import { assertEquals } from "jsr:@std/assert@1";
import { disambiguatedShortNames } from "./disambiguatedShortNames.ts";

Deno.test("unique names stay unchanged", () => {
  const labels = disambiguatedShortNames([
    { id: "maya", full_name: "Maya Kapoor" },
    { id: "raj", full_name: "Raj Patel" },
    { id: "chris", full_name: "Christopher Fernandez" },
    { id: "sheeba", full_name: "Sheeba" },
    { id: "mail", full_name: null, email: "diana@test.com" },
  ]);
  assertEquals(labels.get("maya"), "Maya");
  assertEquals(labels.get("raj"), "Raj");
  assertEquals(labels.get("chris"), "Christopher");
  assertEquals(labels.get("sheeba"), "Sheeba");
  assertEquals(labels.get("mail"), "diana");
});

Deno.test("two Christophers get F. and M.", () => {
  const labels = disambiguatedShortNames([
    { id: "f", full_name: "Christopher Fernandez" },
    { id: "m", full_name: "Christopher Mills" },
    { id: "maya", full_name: "Maya Kapoor" },
  ]);
  assertEquals(labels.get("f"), "Christopher F.");
  assertEquals(labels.get("m"), "Christopher M.");
  assertEquals(labels.get("maya"), "Maya");
});

Deno.test("a shared last initial falls back to the full name", () => {
  const labels = disambiguatedShortNames([
    { id: "a", full_name: "Christopher Fernandez" },
    { id: "b", full_name: "Christopher Flores" },
  ]);
  assertEquals(labels.get("a"), "Christopher Fernandez");
  assertEquals(labels.get("b"), "Christopher Flores");

  const mixed = disambiguatedShortNames([
    { id: "a", full_name: "Christopher Fernandez" },
    { id: "b", full_name: "Christopher Flores" },
    { id: "m", full_name: "Christopher Mills" },
  ]);
  assertEquals(mixed.get("a"), "Christopher Fernandez");
  assertEquals(mixed.get("b"), "Christopher Flores");
  assertEquals(mixed.get("m"), "Christopher M.");
});

Deno.test("a duplicate with only a single name uses the email local part", () => {
  const withLastName = disambiguatedShortNames([
    { id: "solo", full_name: "Christopher", email: "christopher.f@example.com" },
    { id: "mills", full_name: "Christopher Mills", email: "mills@example.com" },
  ]);
  assertEquals(withLastName.get("solo"), "christopher.f");
  assertEquals(withLastName.get("mills"), "Christopher M.");

  const bothSingle = disambiguatedShortNames([
    { id: "a", full_name: "Alex", email: "alex1@example.com" },
    { id: "b", full_name: "Alex", email: "alex2@example.com" },
  ]);
  assertEquals(bothSingle.get("a"), "alex1");
  assertEquals(bothSingle.get("b"), "alex2");

  const noEmail = disambiguatedShortNames([
    { id: "a", full_name: "Alex" },
    { id: "b", full_name: "Alex" },
  ]);
  assertEquals(noEmail.get("a"), "Alex");
  assertEquals(noEmail.get("b"), "Alex");
});

Deno.test("You is untouched", () => {
  const pronoun = disambiguatedShortNames([
    { id: "me", user_id: "me", full_name: "You" },
    { id: "maya", full_name: "Maya Kapoor" },
  ], "me");
  assertEquals(pronoun.get("me"), "You");
  assertEquals(pronoun.get("maya"), "Maya");

  const named = disambiguatedShortNames([
    {
      id: "me",
      user_id: "me",
      full_name: "Christopher Fernandez",
      email: "me@example.com",
    },
    { id: "mills", user_id: "mills", full_name: "Christopher Mills" },
  ], "me");
  assertEquals(named.get("me"), "You");
  assertEquals(named.get("mills"), "Christopher M.");
});
