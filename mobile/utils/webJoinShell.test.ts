import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { STORE_URL_ANDROID, STORE_URL_IOS } from "../constants/storeUrls.ts";
import { ANALYTICS_EVENTS } from "./posthogEvents.ts";
import {
  INVITE_LANDING_CAPTURE_KEY,
  INVITE_LANDING_QUEUE_KEY,
  INVITE_LANDING_SOURCE,
} from "./inviteLandingAnalytics.ts";
import {
  WEB_AUTH_SHELL_COLUMN_PX,
  WEB_AUTH_SHELL_LOGO_GAP_PX,
  WEB_AUTH_SHELL_LOGO_PX,
  WEB_AUTH_SHELL_TITLE_LINE_PX,
  WEB_AUTH_SHELL_TITLE_SIZE_PX,
  WEB_AUTH_SHELL_TOP_PX,
} from "./webAuthShell.ts";
import {
  WEB_JOIN_NOSCRIPT_ID,
  WEB_JOIN_OPEN_ID,
  WEB_JOIN_SHELL_ATTR,
  WEB_JOIN_WEB_ID,
  WEB_JOIN_SHELL_COLUMN_PX,
  WEB_JOIN_SHELL_ID,
  WEB_JOIN_SHELL_IOS_LABEL,
  WEB_JOIN_SHELL_LOGO_GAP_PX,
  WEB_JOIN_SHELL_LOGO_PX,
  WEB_JOIN_SHELL_OPEN_LABEL,
  WEB_JOIN_SHELL_PLAY_LABEL,
  WEB_JOIN_SHELL_TAGLINE,
  WEB_JOIN_SHELL_TITLE,
  WEB_JOIN_SHELL_TITLE_LINE_PX,
  WEB_JOIN_SHELL_TITLE_SIZE_PX,
  WEB_JOIN_SHELL_TOP_PX,
  WEB_JOIN_SHELL_WEB_LABEL,
  assertJoinShellDocument,
  injectWebJoinShell,
  inviteOpenAppHref,
  inviteWebContinueHref,
  isInviteJoinPath,
  readInviteJoinToken,
  shouldPaintWebJoinShell,
  webJoinShellBodyScript,
  webJoinShellHeadScript,
} from "./webJoinShell.ts";

const TOKEN = "ab".repeat(32);

const EXPO_INDEX = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>SharedMoney</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  <script src="/app/_expo/static/js/web/index.js" defer></script>
</body>
</html>
`;

Deno.test("join paths are recognized without treating other app routes as invites", () => {
  assertEquals(isInviteJoinPath("/app/join/abc"), true);
  assertEquals(isInviteJoinPath("/join/abc"), true);
  assertEquals(isInviteJoinPath("/app"), false);
  assertEquals(isInviteJoinPath("/app/profile"), false);
  assertEquals(isInviteJoinPath("/app/join"), false);
});

Deno.test("only a safe path segment becomes the open-in-app link", () => {
  assertEquals(readInviteJoinToken(`/app/join/${TOKEN}`), TOKEN);
  assertEquals(readInviteJoinToken("/join/preview-token"), "preview-token");
  assertEquals(readInviteJoinToken("/app/join/../../etc"), null);
  assertEquals(readInviteJoinToken("/app/join/%3Cscript%3E"), null);
  assertEquals(readInviteJoinToken("/app/groups/abc"), null);
  assertEquals(inviteOpenAppHref(TOKEN), `sharedmoney://join/${TOKEN}`);
  assertEquals(
    inviteWebContinueHref(`/app/join/${TOKEN}`, "?utm=share"),
    `/app/join/${TOKEN}?utm=share`,
  );
  assertEquals(inviteWebContinueHref(`/app/join/${TOKEN}`), `/app/join/${TOKEN}`);
});

Deno.test("the invite shell paints for a logged-out join visit only", () => {
  assertEquals(
    shouldPaintWebJoinShell({
      pathname: `/app/join/${TOKEN}`,
      search: "",
      hash: "",
      storageEntries: [],
    }),
    true,
  );
  assertEquals(
    shouldPaintWebJoinShell({
      pathname: "/app",
      search: "",
      hash: "",
      storageEntries: [],
    }),
    false,
  );
  assertEquals(
    shouldPaintWebJoinShell({
      pathname: `/app/join/${TOKEN}`,
      search: "",
      hash: "",
      storageEntries: [
        { key: "sb-example-auth-token", value: '{"access_token":"secret"}' },
      ],
    }),
    false,
  );
  assertEquals(
    shouldPaintWebJoinShell({
      pathname: `/app/join/${TOKEN}`,
      search: "?code=pkce",
      hash: "",
      storageEntries: [],
    }),
    false,
  );
});

Deno.test("standalone join document has a real title, store links, and a noscript path", () => {
  const html = injectWebJoinShell(EXPO_INDEX, { standalone: true });
  assertJoinShellDocument(html);
  assertEquals(html.includes(`<h1>${WEB_JOIN_SHELL_TITLE}</h1>`), true);
  assertEquals(html.includes(WEB_JOIN_SHELL_TAGLINE), true);
  assertEquals(html.includes(WEB_JOIN_SHELL_PLAY_LABEL), true);
  assertEquals(html.includes(WEB_JOIN_SHELL_IOS_LABEL), true);
  assertEquals(html.includes(WEB_JOIN_SHELL_OPEN_LABEL), true);
  assertEquals(html.includes(WEB_JOIN_SHELL_WEB_LABEL), true);
  assertEquals(html.includes(STORE_URL_ANDROID), true);
  assertEquals(html.includes(STORE_URL_IOS), true);
  assertEquals(html.includes('data-invite-cta="play"'), true);
  assertEquals(html.includes('data-invite-cta="app_store"'), true);
  assertEquals(html.includes('data-invite-cta="open_app"'), true);
  assertEquals(html.includes('data-invite-cta="web_app"'), true);
  assertEquals(html.includes(`padding:${WEB_JOIN_SHELL_TOP_PX}px 20px 40px`), true);
  assertEquals(html.includes(`width:${WEB_JOIN_SHELL_LOGO_PX}px`), true);
  assertEquals(html.includes(`margin:0 0 ${WEB_JOIN_SHELL_LOGO_GAP_PX}px`), true);
  assertEquals(html.includes(`font-size:${WEB_JOIN_SHELL_TITLE_SIZE_PX}px`), true);
  assertEquals(html.includes(`line-height:${WEB_JOIN_SHELL_TITLE_LINE_PX}px`), true);
  assertEquals(html.includes(`min(${WEB_JOIN_SHELL_COLUMN_PX}px`), true);
  assertEquals(html.includes("You need to enable JavaScript to run this app."), false);
  assertEquals(html.indexOf(`id="${WEB_JOIN_SHELL_ID}"`) < html.indexOf('id="root"'), true);
  assertEquals(injectWebJoinShell(html, { standalone: true }), html);

  const noscript = html.match(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/i)?.[0] ?? "";
  assertEquals(noscript.includes(`id="${WEB_JOIN_NOSCRIPT_ID}"`), true);
  assertEquals(noscript.includes(STORE_URL_ANDROID), true);
  assertEquals(noscript.includes(STORE_URL_IOS), true);
  assertEquals(noscript.includes(WEB_JOIN_SHELL_TAGLINE), true);
  assertEquals(noscript.includes(TOKEN), false);
  assertEquals(html.replaceAll("text-wrap:balance", "").includes("balance"), false);
  assertEquals(html.includes("email"), false);
  assertEquals(html.includes("phone"), false);
  assertEquals(html.includes('href="/app"'), false);
  assertEquals(html.includes(".sm-join-open{border:0;background:#1F5EFF;color:#FFFFFF;}"), true);
  assertEquals(html.includes("min-height:48px"), true);
  const shellHtml = html.slice(html.indexOf(`id="${WEB_JOIN_SHELL_ID}"`));
  assertEquals(
    shellHtml.indexOf(WEB_JOIN_SHELL_OPEN_LABEL) < shellHtml.indexOf('data-invite-cta="play"'),
    true,
  );
  assertEquals(
    shellHtml.indexOf('data-invite-cta="play"') < shellHtml.indexOf('data-invite-cta="app_store"'),
    true,
  );
  assertEquals(
    shellHtml.indexOf('data-invite-cta="app_store"') < shellHtml.indexOf('data-invite-cta="web_app"'),
    true,
  );

  const shared = injectWebJoinShell(EXPO_INDEX);
  assertEquals(shared.includes("<title>SharedMoney</title>"), true);
  assertEquals(shared.includes(`id="${WEB_JOIN_NOSCRIPT_ID}"`), false);
  assertEquals(shared.includes("You need to enable JavaScript to run this app."), true);
  assertEquals(shared.includes(WEB_JOIN_SHELL_TAGLINE), true);

  const withLogo = injectWebJoinShell(EXPO_INDEX, {
    standalone: true,
    logoSrc: "/app/assets/assets/logo.abc123.png",
  });
  assertEquals(
    withLogo.includes(
      `<img src="/app/assets/assets/logo.abc123.png" width="${WEB_JOIN_SHELL_LOGO_PX}" height="${WEB_JOIN_SHELL_LOGO_PX}" alt="" />`,
    ),
    true,
  );
  assertThrows(() =>
    injectWebJoinShell(EXPO_INDEX, { logoSrc: "https://evil.example/logo.png" })
  );
  assertEquals(WEB_JOIN_SHELL_TOP_PX, WEB_AUTH_SHELL_TOP_PX);
  assertEquals(WEB_JOIN_SHELL_LOGO_PX, WEB_AUTH_SHELL_LOGO_PX);
  assertEquals(WEB_JOIN_SHELL_LOGO_GAP_PX, WEB_AUTH_SHELL_LOGO_GAP_PX);
  assertEquals(WEB_JOIN_SHELL_TITLE_SIZE_PX, WEB_AUTH_SHELL_TITLE_SIZE_PX);
  assertEquals(WEB_JOIN_SHELL_TITLE_LINE_PX, WEB_AUTH_SHELL_TITLE_LINE_PX);
  assertEquals(WEB_JOIN_SHELL_COLUMN_PX, WEB_AUTH_SHELL_COLUMN_PX);
});

Deno.test("injection fails closed when the Expo document shape changes", () => {
  assertThrows(() => injectWebJoinShell("<html><body></body></html>"));
});

Deno.test("bootstrap paints the invite shell, queues a view, and fills the deep link", () => {
  const script = `${webJoinShellHeadScript()}\n${webJoinShellBodyScript()}`;

  const run = (page: {
    pathname?: string;
    search?: string;
    hash?: string;
    entries?: Array<[string, string]>;
    sessionTheme?: string | null;
    throwStorage?: boolean;
    capture?: (event: string, properties: Record<string, string>) => void;
    clickWeb?: { prevented: boolean };
  }) => {
    const attrs = new Map<string, string>();
    const classes: string[] = [];
    const store = new Map(page.entries ?? []);
    const session = new Map<string, string>();
    if (page.sessionTheme) session.set("theme", page.sessionTheme);
    const open = {
      href: "",
      hidden: true,
      setAttribute: (name: string, value: string) => {
        if (name === "href") open.href = value;
      },
      removeAttribute: (name: string) => {
        if (name === "hidden") open.hidden = false;
      },
    };
    const web = {
      href: "",
      setAttribute: (name: string, value: string) => {
        if (name === "href") web.href = value;
      },
    };
    const state = { removed: false };
    const listeners: Array<(event: { target: unknown; preventDefault: () => void }) => void> = [];
    const shell = { remove: () => { state.removed = true; } };
    const documentElement = {
      setAttribute: (name: string, value: string) => attrs.set(name, value),
      getAttribute: (name: string) => attrs.get(name) ?? null,
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
    const scope = globalThis as Record<string, unknown>;
    const previousCapture = scope[INVITE_LANDING_CAPTURE_KEY];
    if (page.capture) scope[INVITE_LANDING_CAPTURE_KEY] = page.capture;
    else delete scope[INVITE_LANDING_CAPTURE_KEY];
    const fn = new Function(
      "document",
      "localStorage",
      "sessionStorage",
      "location",
      script,
    );
    try {
      fn(
        {
          documentElement,
          addEventListener: (
            _type: string,
            listener: (event: { target: unknown; preventDefault: () => void }) => void,
          ) => listeners.push(listener),
          getElementById: (id: string) => {
            if (id === WEB_JOIN_OPEN_ID) return open;
            if (id === WEB_JOIN_WEB_ID) return web;
            if (id === WEB_JOIN_SHELL_ID) return shell;
            return null;
          },
        },
        storage,
        {
          getItem: (key: string) => session.get(key) ?? null,
          setItem: (key: string, value: string) => session.set(key, value),
        },
        { pathname: page.pathname ?? "", search: page.search ?? "", hash: page.hash ?? "" },
      );
      if (page.clickWeb) {
        listeners[0]?.({
          target: {
            nodeType: 1,
            closest: (selector: string) =>
              selector === "[data-invite-cta]"
                ? { getAttribute: () => "web_app" }
                : null,
          },
          preventDefault: () => {
            if (page.clickWeb) page.clickWeb.prevented = true;
          },
        });
      }
    } finally {
      if (previousCapture === undefined) delete scope[INVITE_LANDING_CAPTURE_KEY];
      else scope[INVITE_LANDING_CAPTURE_KEY] = previousCapture;
    }
    return {
      attr: attrs.get(WEB_JOIN_SHELL_ATTR),
      title: (documentElement as { title?: string }).title,
      classes,
      queue: session.get(INVITE_LANDING_QUEUE_KEY) ?? null,
      href: open.href,
      webHref: web.href,
      hidden: open.hidden,
      listeners,
      get removed() {
        return state.removed;
      },
      attrs,
    };
  };

  const loggedOut = run({ pathname: `/app/join/${TOKEN}` });
  assertEquals(loggedOut.attr, "1");
  assertEquals(loggedOut.href, `sharedmoney://join/${TOKEN}`);
  assertEquals(loggedOut.webHref, `/app/join/${TOKEN}`);
  assertEquals(loggedOut.hidden, false);
  const queued = JSON.parse(loggedOut.queue ?? "[]") as Array<{ event: string; cta?: string }>;
  assertEquals(queued, [{ event: ANALYTICS_EVENTS.INVITE_LANDING_VIEWED }]);
  assertEquals(JSON.stringify(queued).includes(TOKEN), false);

  const home = run({ pathname: "/app" });
  assertEquals(home.attr, "0");
  assertEquals(home.queue, null);
  assertEquals(home.hidden, true);

  const signedIn = run({
    pathname: `/app/join/${TOKEN}`,
    entries: [["sb-ref-auth-token", '{"access_token":"x"}']],
  });
  assertEquals(signedIn.attr, "0");
  assertEquals(signedIn.queue, null);

  assertEquals(run({ pathname: `/app/join/${TOKEN}`, search: "?code=abc" }).attr, "0");
  assertEquals(run({ pathname: `/app/join/${TOKEN}`, sessionTheme: "dark" }).classes, [
    "sm-join-dark",
  ]);
  assertEquals(
    run({
      pathname: "/join/preview-token",
      entries: [["sharedmoney.themePreference", "light"]],
    }).classes,
    ["sm-join-light"],
  );
  assertEquals(run({ pathname: `/app/join/${TOKEN}`, throwStorage: true }).attr, "1");
  assertEquals(run({ pathname: "/app/join/%3Cbad%3E" }).hidden, true);

  const clicked: Array<{ event: string; properties: Record<string, string> }> = [];
  const clickWeb = { prevented: false };
  const withCapture = run({
    pathname: `/app/join/${TOKEN}`,
    capture: (event, properties) => clicked.push({ event, properties }),
    clickWeb,
  });
  assertEquals(withCapture.queue, null);
  assertEquals(clicked[0], {
    event: ANALYTICS_EVENTS.INVITE_LANDING_VIEWED,
    properties: { source: INVITE_LANDING_SOURCE },
  });
  assertEquals(clickWeb.prevented, true);
  assertEquals(withCapture.removed, true);
  assertEquals(withCapture.attrs.get("data-sm-auth-shell"), "1");
  assertEquals(withCapture.attrs.get(WEB_JOIN_SHELL_ATTR), "0");
  assertEquals(clicked[1]?.properties, { source: "invite_join", cta: "web_app" });
  assertEquals(JSON.stringify(clicked).includes(TOKEN), false);
});
