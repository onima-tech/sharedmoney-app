import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  WEB_PROFILE_LABEL_KEY,
  WEB_PROFILE_SHELL_ATTR,
  WEB_PROFILE_SHELL_FALLBACK_NAME,
  WEB_PROFILE_SHELL_HERO_BLOCK_PX,
  WEB_PROFILE_SHELL_HERO_ID,
  WEB_PROFILE_SHELL_HERO_LINE_PX,
  WEB_PROFILE_SHELL_ID,
  WEB_PROFILE_SHELL_SUBTITLE,
  WEB_PROFILE_SHELL_TOP_PX,
  injectWebProfileShell,
  normalizeProfileLabel,
  readProfileLabelFromStorage,
  shouldPaintWebProfileShell,
  webProfileShellHeadScript,
  webProfileShellNameScript,
} from "./webProfileShell.ts";

const EXPO_INDEX = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>SharedMoney</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

const SESSION = {
  key: "sb-example-auth-token",
  value: JSON.stringify({
    access_token: "secret",
    user: { user_metadata: { full_name: "Ada Lovelace" } },
  }),
};

Deno.test("profile hero paints only for a signed-in profile URL", () => {
  assertEquals(
    shouldPaintWebProfileShell({
      pathname: "/app/profile",
      search: "",
      hash: "",
      storageEntries: [SESSION],
    }),
    true,
  );
  assertEquals(
    shouldPaintWebProfileShell({
      pathname: "/profile",
      search: "",
      hash: "",
      storageEntries: [SESSION],
    }),
    true,
  );
  assertEquals(
    shouldPaintWebProfileShell({
      pathname: "/app",
      search: "",
      hash: "",
      storageEntries: [SESSION],
    }),
    false,
  );
  assertEquals(
    shouldPaintWebProfileShell({
      pathname: "/app/profile",
      search: "",
      hash: "",
      storageEntries: [],
    }),
    false,
  );
  assertEquals(
    shouldPaintWebProfileShell({
      pathname: "/app/profile",
      search: "?code=pkce",
      hash: "",
      storageEntries: [SESSION],
    }),
    false,
  );
});

Deno.test("profile label prefers the saved name over the auth metadata", () => {
  assertEquals(normalizeProfileLabel("  Ada   Lovelace  "), "Ada Lovelace");
  assertEquals(normalizeProfileLabel("   "), WEB_PROFILE_SHELL_FALLBACK_NAME);
  assertEquals(
    readProfileLabelFromStorage([
      { key: WEB_PROFILE_LABEL_KEY, value: "Grace Hopper" },
      SESSION,
    ]),
    "Grace Hopper",
  );
  assertEquals(readProfileLabelFromStorage([SESSION]), "Ada Lovelace");
  assertEquals(
    readProfileLabelFromStorage([{ key: WEB_PROFILE_LABEL_KEY, value: "" }, SESSION]),
    WEB_PROFILE_SHELL_FALLBACK_NAME,
  );
  assertEquals(readProfileLabelFromStorage([]), WEB_PROFILE_SHELL_FALLBACK_NAME);
});

Deno.test("exported index.html gains one profile hero and leaves the login shell alone", () => {
  const html = injectWebProfileShell(EXPO_INDEX);
  assertEquals(html.includes(`id="${WEB_PROFILE_SHELL_ID}"`), true);
  assertEquals(html.includes(`id="${WEB_PROFILE_SHELL_HERO_ID}"`), true);
  assertEquals(
    html.includes(`${WEB_PROFILE_SHELL_FALLBACK_NAME}<br>${WEB_PROFILE_SHELL_SUBTITLE}`),
    true,
  );
  assertEquals(html.includes(`top:${WEB_PROFILE_SHELL_TOP_PX}px`), true);
  assertEquals(html.includes(`line-height:${WEB_PROFILE_SHELL_HERO_LINE_PX}px`), true);
  assertEquals(html.includes(`max-height:${WEB_PROFILE_SHELL_HERO_BLOCK_PX}px`), true);
  assertEquals(html.includes("Log in to SharedMoney"), false);
  assertEquals(html.indexOf(`id="${WEB_PROFILE_SHELL_ID}"`) < html.indexOf('id="root"'), true);
  assertEquals(injectWebProfileShell(html), html);
  assertEquals(
    WEB_PROFILE_SHELL_HERO_BLOCK_PX,
    WEB_PROFILE_SHELL_HERO_LINE_PX * 2,
  );
});

Deno.test("injection fails closed when the Expo document shape changes", () => {
  assertThrows(() => injectWebProfileShell("<html><body></body></html>"));
});

Deno.test("head script paints the profile hero only for a signed-in profile path", () => {
  const script = webProfileShellHeadScript();
  const paint = (page: {
    pathname?: string;
    search?: string;
    hash?: string;
    entries?: Array<[string, string]>;
    sessionTheme?: string | null;
    preference?: string | null;
  }) => {
    const attrs = new Map<string, string>();
    const classes: string[] = [];
    const store = new Map(page.entries ?? []);
    const documentElement = {
      setAttribute: (name: string, value: string) => attrs.set(name, value),
      classList: { add: (name: string) => classes.push(name) },
    };
    const fn = new Function(
      "document",
      "localStorage",
      "sessionStorage",
      "location",
      script,
    );
    fn(
      { documentElement },
      {
        length: store.size,
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        getItem: (key: string) => store.get(key) ?? null,
      },
      { getItem: (key: string) => (key === "theme" ? page.sessionTheme ?? null : null) },
      {
        pathname: page.pathname ?? "/app/profile",
        search: page.search ?? "",
        hash: page.hash ?? "",
      },
    );
    return { attr: attrs.get(WEB_PROFILE_SHELL_ATTR), classes };
  };

  assertEquals(paint({ entries: [[SESSION.key, SESSION.value]] }).attr, "1");
  assertEquals(paint({ pathname: "/app", entries: [[SESSION.key, SESSION.value]] }).attr, "0");
  assertEquals(paint({}).attr, "0");
  assertEquals(
    paint({ entries: [[SESSION.key, SESSION.value]], search: "?code=abc" }).attr,
    "0",
  );
  assertEquals(
    paint({
      entries: [
        [SESSION.key, SESSION.value],
        ["sharedmoney.themePreference", "dark"],
      ],
    }).classes,
    ["sm-profile-dark"],
  );
  assertEquals(
    paint({
      entries: [[SESSION.key, SESSION.value]],
      sessionTheme: "light",
    }).classes,
    ["sm-profile-light"],
  );
});

Deno.test("name script fills the hero from the saved label without touching other routes", () => {
  const script = webProfileShellNameScript();
  const run = (page: {
    paint: boolean;
    entries?: Array<[string, string]>;
  }) => {
    const children: Array<{ text?: string; tag?: string }> = [];
    const hero = {
      textContent: "",
      appendChild(node: { text?: string; tag?: string }) {
        children.push(node);
      },
    };
    const store = new Map(page.entries ?? []);
    const fn = new Function("document", "localStorage", script);
    fn(
      {
        documentElement: {
          getAttribute: () => (page.paint ? "1" : "0"),
        },
        getElementById: () => hero,
        createElement: (tag: string) => ({ tag }),
        createTextNode: (text: string) => ({ text }),
      },
      {
        length: store.size,
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        getItem: (key: string) => store.get(key) ?? null,
      },
    );
    return children;
  };

  assertEquals(run({ paint: false, entries: [[WEB_PROFILE_LABEL_KEY, "Grace Hopper"]] }), []);
  assertEquals(run({ paint: true }), [
    { text: WEB_PROFILE_SHELL_FALLBACK_NAME },
    { tag: "br" },
    { text: WEB_PROFILE_SHELL_SUBTITLE },
  ]);
  assertEquals(
    run({
      paint: true,
      entries: [[WEB_PROFILE_LABEL_KEY, "Grace Hopper"], [SESSION.key, SESSION.value]],
    }),
    [
      { text: "Grace Hopper" },
      { tag: "br" },
      { text: WEB_PROFILE_SHELL_SUBTITLE },
    ],
  );
  assertEquals(run({ paint: true, entries: [[SESSION.key, SESSION.value]] }), [
    { text: "Ada Lovelace" },
    { tag: "br" },
    { text: WEB_PROFILE_SHELL_SUBTITLE },
  ]);
});
