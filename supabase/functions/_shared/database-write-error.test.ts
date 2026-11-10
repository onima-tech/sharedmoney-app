import { assertEquals } from "jsr:@std/assert@1";
import { classifyDatabaseWriteError } from "./database-write-error.ts";

Deno.test("row-level security failures are permission errors, not 500s", () => {
  assertEquals(
    classifyDatabaseWriteError({
      code: "42501",
      message: 'new row violates row-level security policy for table "settlements"',
    }),
    {
      status: 403,
      error: "Not an active group member",
      code: "PERMISSION_DENIED",
    },
  );
});

Deno.test("amount check failures stay validation errors", () => {
  assertEquals(
    classifyDatabaseWriteError({
      code: "23514",
      message: 'new row for relation "settlements" violates check constraint "settlements_amount_check"',
    }),
    {
      status: 400,
      error: "Amount must be a positive number",
      code: "VALIDATION_ERROR",
    },
  );
});

Deno.test("unknown database errors stay unclassified", () => {
  assertEquals(classifyDatabaseWriteError({ code: "23502", message: "null value" }), null);
  assertEquals(classifyDatabaseWriteError(new Error("Internal server error")), null);
  assertEquals(classifyDatabaseWriteError(null), null);
});
