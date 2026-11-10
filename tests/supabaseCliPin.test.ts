import { assert, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import deployEdge from "../.github/workflows/deploy-edge-functions.yml" with {
  type: "text",
};
import whatsappPreview from "../.github/workflows/whatsapp-preview-once.yml" with {
  type: "text",
};
import phuketSnapshot from "../.github/workflows/phuket-unify-snapshot.yml" with {
  type: "text",
};
import phuketScript from "../scripts/phuket_snapshot.py" with { type: "text" };

const CLI_PIN = "version: 3.1.0";

const workflows = [
  [".github/workflows/deploy-edge-functions.yml", deployEdge],
  [".github/workflows/whatsapp-preview-once.yml", whatsappPreview],
  [".github/workflows/phuket-unify-snapshot.yml", phuketSnapshot],
] as const;

Deno.test("Supabase workflows pin CLI 3.1.0 and drop deprecated target flags", () => {
  for (const [name, source] of workflows) {
    assert(
      source.includes("uses: supabase/setup-cli@v1"),
      `${name} should install the CLI with setup-cli`,
    );
    assertStringIncludes(source, CLI_PIN);
    assert(
      !source.includes("version: latest"),
      `${name} must not float the Supabase CLI on latest`,
    );
    assert(!source.includes("2.122.0"), `${name} must not keep the v2 pin`);
    assert(!source.includes("--linked"), `${name} must not pass --linked`);
    assert(!source.includes("--db-url"), `${name} must not pass --db-url`);
    assert(
      !/supabase link[^\n]*\s-p\b/.test(source),
      `${name} must not pass a password flag to link`,
    );
  }

  assertStringIncludes(
    deployEdge,
    "supabase db push --yes --remote",
  );
  assertStringIncludes(
    deployEdge,
    'supabase functions deploy --yes --remote="$SUPABASE_PROJECT_REF"',
  );
  assertStringIncludes(
    deployEdge,
    'supabase functions list --remote="$SUPABASE_PROJECT_REF"',
  );
  assert(
    deployEdge.includes('supabase link --project-ref $SUPABASE_PROJECT_REF'),
    "link still takes --project-ref",
  );

  assertStringIncludes(
    whatsappPreview,
    'supabase secrets set --env-file "$ENV_FILE" --yes --remote="$SUPABASE_PROJECT_REF"',
  );

  assertStringIncludes(
    phuketSnapshot,
    'supabase link --project-ref "$SUPABASE_PROJECT_REF" --yes',
  );
});

Deno.test("Phuket snapshot queries use CLI 3 remote read-only flags", () => {
  assertStringIncludes(
    phuketScript,
    '["db", "query", "--read-only", "-o", "json", sql, "--remote"]',
  );
  assert(
    phuketScript.includes('f"--remote={db_url}"'),
    "database URL target must use --remote=<url>",
  );
  assert(!phuketScript.includes("--linked"), "snapshot script must not pass --linked");
  assert(!phuketScript.includes("--db-url"), "snapshot script must not pass --db-url");
  assert(!phuketScript.includes('"--local"'), "snapshot script must not pass --local");
});
