import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  WEB_AUTH_SHELL_ATTR,
  WEB_AUTH_SHELL_COLUMN_PX,
  WEB_AUTH_SHELL_DESKTOP_MIN_PX,
  WEB_AUTH_SHELL_HEADER_HEIGHT,
  WEB_AUTH_SHELL_ID,
  WEB_AUTH_SHELL_LOGO_GAP_PX,
  WEB_AUTH_SHELL_LOGO_PX,
  WEB_AUTH_SHELL_TITLE,
  WEB_AUTH_SHELL_TITLE_LINE_PX,
  WEB_AUTH_SHELL_TITLE_SIZE_PX,
  WEB_AUTH_SHELL_TOP_PX,
  injectWebAuthShell,
  shouldPaintWebAuthShell,
  webAuthShellBootstrapScript,
} from "./webAuthShell.ts";

const EXPO_INDEX = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>SharedMoney</title>
  </head>
  <body>
    <div id="root"></div>
  <script src="/app/_expo/static/js/web/index.js" defer></script>
</body>
</html>
`;

Deno.test("logged-out mobile visits paint the login shell", () => {
  assertEquals(
    shouldPaintWebAuthShell({ search: "", hash: "", storageEntries: [] }),
    true,
  );
  assertEquals(
    shouldPaintWebAuthShell({
      search: "?utm=share",
      hash: "",
      storageEntries: [{ key: "sharedmoney.themePreference", value: "dark" }],
    }),
    true,
  );
});

Deno.test("an invite join URL skips the login shell", () => {
  assertEquals(
    shouldPaintWebAuthShell({
      pathname: "/app/join/abc",
      search: "",
      hash: "",
      storageEntries: [],
    }),
    false,
  );
  assertEquals(
    shouldPaintWebAuthShell({
      pathname: "/join/abc",
      search: "",
      hash: "",
      storageEntries: [],
    }),
    false,
  );
});

Deno.test("a stored Supabase session or an OAuth return skips the login shell", () => {
  assertEquals(
    shouldPaintWebAuthShell({
      search: "",
      hash: "",
      storageEntries: [
        { key: "sb-example-auth-token", value: '{"access_token":"secret","refresh_token":"r"}' },
      ],
    }),
    false,
  );
  assertEquals(
    shouldPaintWebAuthShell({
      search: "",
      hash: "",
      storageEntries: [{ key: "sb-example-auth-token", value: "null" }],
    }),
    true,
  );
  assertEquals(
    shouldPaintWebAuthShell({ search: "?code=pkce", hash: "", storageEntries: [] }),
    false,
  );
  assertEquals(
    shouldPaintWebAuthShell({
      search: "",
      hash: "#access_token=a&refresh_token=b",
      storageEntries: [],
    }),
    false,
  );
});

Deno.test("exported index.html gains one login title that matches the mobile auth header", () => {
  const html = injectWebAuthShell(EXPO_INDEX);
  assertEquals(html.includes(`<h1>${WEB_AUTH_SHELL_TITLE}</h1>`), true);
  assertEquals(html.includes(`id="${WEB_AUTH_SHELL_ID}"`), true);
  assertEquals(html.includes(`top:${WEB_AUTH_SHELL_TOP_PX}px`), true);
  assertEquals(html.includes(`width:${WEB_AUTH_SHELL_LOGO_PX}px`), true);
  assertEquals(html.includes(`margin:0 0 ${WEB_AUTH_SHELL_LOGO_GAP_PX}px`), true);
  assertEquals(html.includes(`font-size:${WEB_AUTH_SHELL_TITLE_SIZE_PX}px`), true);
  assertEquals(html.includes(`line-height:${WEB_AUTH_SHELL_TITLE_LINE_PX}px`), true);
  assertEquals(html.includes(`min(${WEB_AUTH_SHELL_COLUMN_PX}px`), true);
  assertEquals(html.includes(`min-width: ${WEB_AUTH_SHELL_DESKTOP_MIN_PX}px`), true);
  assertEquals(html.indexOf(`id="${WEB_AUTH_SHELL_ID}"`) < html.indexOf('id="root"'), true);
  assertEquals(injectWebAuthShell(html), html);
  const withLogo = injectWebAuthShell(EXPO_INDEX, {
    logoSrc: "/app/assets/assets/logo.abc123.png",
  });
  assertEquals(
    withLogo.includes(
      `<img src="/app/assets/assets/logo.abc123.png" width="${WEB_AUTH_SHELL_LOGO_PX}" height="${WEB_AUTH_SHELL_LOGO_PX}" alt="" />`,
    ),
    true,
  );
  assertThrows(() => injectWebAuthShell(EXPO_INDEX, { logoSrc: "https://evil.example/logo.png" }));
  assertEquals(
    WEB_AUTH_SHELL_HEADER_HEIGHT,
    WEB_AUTH_SHELL_LOGO_PX + WEB_AUTH_SHELL_LOGO_GAP_PX + WEB_AUTH_SHELL_TITLE_LINE_PX,
  );
});

Deno.test("injection fails closed when the Expo document shape changes", () => {
  assertThrows(() => injectWebAuthShell("<html><body></body></html>"));
});

Deno.test("bootstrap script paints the shell only for an empty logged-out visit", () => {
  const script = webAuthShellBootstrapScript();

  const paint = (page: {
    pathname?: string;
    search?: string;
    hash?: string;
    entries?: Array<[string, string]>;
    sessionTheme?: string | null;
    throwStorage?: boolean;
  }) => {
    const attrs = new Map<string, string>();
    const classes: string[] = [];
    const store = new Map(page.entries ?? []);
    const documentElement = {
      setAttribute: (name: string, value: string) => attrs.set(name, value),
      classList: { add: (name: string) => classes.push(name) },
    };
    const storage = {
      length: store.size,
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
    };
    if (page.throwStorage) {
      Object.defineProperty(storage, "length", {
        get() {
          throw new Error("blocked");
        },
      });
    }
    const fn = new Function(
      "document",
      "localStorage",
      "sessionStorage",
      "location",
      script,
    );
    fn(
      { documentElement },
      storage,
      {
        getItem: (key: string) => (key === "theme" ? page.sessionTheme ?? null : null),
      },
      { pathname: page.pathname ?? "", search: page.search ?? "", hash: page.hash ?? "" },
    );
    return { attr: attrs.get(WEB_AUTH_SHELL_ATTR), classes };
  };

  assertEquals(paint({}).attr, "1");
  assertEquals(paint({ pathname: "/app/join/abc" }).attr, "0");
  assertEquals(paint({ pathname: "/join/deadbeef", throwStorage: true }).attr, "0");
  assertEquals(
    paint({
      entries: [["sb-ref-auth-token", '{"access_token":"x"}']],
    }).attr,
    "0",
  );
  assertEquals(paint({ search: "?code=abc" }).attr, "0");
  assertEquals(paint({ hash: "#error_description=nope" }).attr, "0");
  assertEquals(paint({ sessionTheme: "dark" }).classes, ["sm-auth-dark"]);
  assertEquals(
    paint({ entries: [["sharedmoney.themePreference", "light"]] }).classes,
    ["sm-auth-light"],
  );
  assertEquals(paint({ throwStorage: true }).attr, "1");
});
