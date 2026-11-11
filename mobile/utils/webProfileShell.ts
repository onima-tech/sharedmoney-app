/**
 * Logged-in Profile hero painted in the Expo web document, before the bundle.
 *
 * A signed-in Groups load paints its title only after the JS bundle runs
 * (~1.8s lab LCP). Profile's largest text is this hero (the name line plus
 * "Update your personal details" as one block). A later currency paragraph
 * or a separate name heading is smaller, so this node has to stay in the
 * document. Removing it hands LCP back to whatever React paints.
 *
 * This is not the logged-out login shell. Logged-out visits keep that shell
 * and do not paint this hero.
 */

export const WEB_PROFILE_SHELL_ATTR = "data-sm-profile-shell";
export const WEB_PROFILE_SHELL_ID = "sm-profile-shell";
export const WEB_PROFILE_SHELL_HERO_ID = "sm-profile-hero";
export const WEB_PROFILE_LABEL_KEY = "sharedmoney.profileLabel";
export const WEB_PROFILE_SHELL_FALLBACK_NAME = "Your Profile";
export const WEB_PROFILE_SHELL_SUBTITLE = "Update your personal details";
/** App bar (64) + scroll padding + header margin + avatar block. */
export const WEB_PROFILE_SHELL_TOP_PX = 200;
export const WEB_PROFILE_SHELL_HERO_LINE_PX = 32;
export const WEB_PROFILE_SHELL_HERO_BLOCK_PX = WEB_PROFILE_SHELL_HERO_LINE_PX * 2;

const LIGHT_CANVAS = "#F7F9FC";
const LIGHT_INK = "#17202A";
const DARK_CANVAS = "#11171D";
const DARK_INK = "#E6ECF3";

export interface WebProfileShellStorageEntry {
  key: string;
  value: string | null;
}

export function normalizeProfileLabel(value: string | null | undefined): string {
  if (!value) return WEB_PROFILE_SHELL_FALLBACK_NAME;
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) return WEB_PROFILE_SHELL_FALLBACK_NAME;
  return collapsed.slice(0, 80);
}

export function readProfileLabelFromStorage(
  entries: readonly WebProfileShellStorageEntry[],
): string {
  const saved = entries.find((entry) => entry.key === WEB_PROFILE_LABEL_KEY);
  if (saved) return normalizeProfileLabel(saved.value);

  for (const entry of entries) {
    if (!entry.key.includes("auth-token") || !entry.value) continue;
    if (!entry.value.includes("access_token")) continue;
    try {
      const parsed = JSON.parse(entry.value) as {
        user?: { user_metadata?: Record<string, unknown> };
      };
      const meta = parsed.user?.user_metadata;
      if (!meta) continue;
      for (const key of ["full_name", "name"] as const) {
        const candidate = meta[key];
        if (typeof candidate === "string" && candidate.trim()) {
          return normalizeProfileLabel(candidate);
        }
      }
    } catch {
      continue;
    }
  }

  return WEB_PROFILE_SHELL_FALLBACK_NAME;
}

export function shouldPaintWebProfileShell(input: {
  pathname: string;
  search: string;
  hash: string;
  storageEntries: readonly WebProfileShellStorageEntry[];
}): boolean {
  if (!isProfilePath(input.pathname)) return false;
  if (hasOAuthCallback(input.search, input.hash)) return false;
  return hasStoredAuthSession(input.storageEntries);
}

function isProfilePath(pathname: string): boolean {
  return /(?:^|\/)(?:app\/)?profile\/?$/.test(pathname);
}

function hasOAuthCallback(search: string, hash: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.has("code") || params.has("error")) return true;
  return (
    hash.includes("access_token") ||
    hash.includes("refresh_token") ||
    hash.includes("error_description")
  );
}

function hasStoredAuthSession(entries: readonly WebProfileShellStorageEntry[]): boolean {
  return entries.some(
    (entry) =>
      entry.key.includes("auth-token") &&
      typeof entry.value === "string" &&
      entry.value.includes("access_token"),
  );
}

type ShellNode = {
  id?: string;
  textContent: string;
  innerText?: string;
  parentElement?: unknown;
  appendChild?(node: ShellNode): void;
};

type ShellDocument = {
  documentElement: {
    getAttribute(name: string): string | null;
    setAttribute?(name: string, value: string): void;
    removeAttribute?(name: string): void;
    classList?: { add(name: string): void };
  };
  getElementById?(id: string): ShellNode | null;
  createElement?(tag: string): ShellNode;
  createTextNode?(text: string): ShellNode;
};

function shellDocument(): ShellDocument | null {
  const scope = globalThis as { document?: ShellDocument };
  return scope.document ?? null;
}

function browserStorage(): Storage | null {
  const scope = globalThis as { localStorage?: Storage };
  return scope.localStorage ?? null;
}

export function isWebProfileShellActive(): boolean {
  return shellDocument()?.documentElement.getAttribute(WEB_PROFILE_SHELL_ATTR) === "1";
}

export function rememberWebProfileLabel(fullName: string | null | undefined): void {
  const storage = browserStorage();
  if (!storage) return;
  const normalized = normalizeProfileLabel(fullName);
  if (normalized === WEB_PROFILE_SHELL_FALLBACK_NAME && !(fullName ?? "").trim()) {
    storage.setItem(WEB_PROFILE_LABEL_KEY, "");
    return;
  }
  storage.setItem(WEB_PROFILE_LABEL_KEY, normalized);
}

export function forgetWebProfileLabel(): void {
  browserStorage()?.removeItem(WEB_PROFILE_LABEL_KEY);
}

/**
 * Move the hero into the profile header so it scrolls with the screen.
 * Reparenting keeps the same element, so the early paint stays the LCP.
 */
export function adoptWebProfileHero(
  slot: { appendChild(node: unknown): void } | null,
): void {
  const hero = shellDocument()?.getElementById?.(WEB_PROFILE_SHELL_HERO_ID);
  if (!slot || typeof slot.appendChild !== "function" || !hero) return;
  if (hero.parentElement === slot) return;
  slot.appendChild(hero);
}

/** Keep the early hero node and put the signed-in name in it. */
export function writeWebProfileHero(fullName: string | null | undefined): void {
  const doc = shellDocument();
  const hero = doc?.getElementById?.(WEB_PROFILE_SHELL_HERO_ID);
  if (!doc || !hero || !doc.createElement || !doc.createTextNode) return;
  hero.textContent = "";
  hero.appendChild?.(doc.createTextNode(normalizeProfileLabel(fullName)));
  const lineBreak = doc.createElement("br");
  hero.appendChild?.(lineBreak);
  hero.appendChild?.(doc.createTextNode(WEB_PROFILE_SHELL_SUBTITLE));
}

export function dismissWebProfileShell(): void {
  const doc = shellDocument();
  if (!doc) return;
  doc.documentElement.removeAttribute?.(WEB_PROFILE_SHELL_ATTR);
  const node = doc.getElementById?.(WEB_PROFILE_SHELL_ID) as { remove?: () => void } | null;
  node?.remove?.();
}

export function webProfileShellHeadScript(): string {
  return `(function(){try{var path=location.pathname||"";var profile=/(?:^|\\/)(?:app\\/)?profile\\/?$/.test(path);var params=new URLSearchParams(location.search);var hash=location.hash||"";var oauth=params.has("code")||params.has("error")||hash.indexOf("access_token")!==-1||hash.indexOf("refresh_token")!==-1||hash.indexOf("error_description")!==-1;var hasSession=false;if(profile&&!oauth){for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i);if(!key||key.indexOf("auth-token")===-1)continue;var raw=localStorage.getItem(key);if(raw&&raw.indexOf("access_token")!==-1){hasSession=true;break;}}}var paint=profile&&!oauth&&hasSession;document.documentElement.setAttribute("${WEB_PROFILE_SHELL_ATTR}",paint?"1":"0");if(!paint)return;var pref=localStorage.getItem("sharedmoney.themePreference")||localStorage.getItem("owewho.themePreference");var landing=null;try{landing=sessionStorage.getItem("theme");}catch(err){}var theme=landing==="light"||landing==="dark"?landing:(pref==="light"||pref==="dark"?pref:null);if(theme==="dark")document.documentElement.classList.add("sm-profile-dark");if(theme==="light")document.documentElement.classList.add("sm-profile-light");}catch(e){document.documentElement.setAttribute("${WEB_PROFILE_SHELL_ATTR}","0");}})();`;
}

export function webProfileShellNameScript(): string {
  return `(function(){try{if(document.documentElement.getAttribute("${WEB_PROFILE_SHELL_ATTR}")!=="1")return;var hero=document.getElementById("${WEB_PROFILE_SHELL_HERO_ID}");if(!hero)return;var name=${JSON.stringify(WEB_PROFILE_SHELL_FALLBACK_NAME)};var saved=localStorage.getItem(${JSON.stringify(WEB_PROFILE_LABEL_KEY)});if(saved!=null){name=saved;}else{for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i);if(!key||key.indexOf("auth-token")===-1)continue;var raw=localStorage.getItem(key);if(!raw||raw.indexOf("access_token")===-1)continue;try{var parsed=JSON.parse(raw);var meta=parsed&&parsed.user&&parsed.user.user_metadata;var candidate=meta&&(meta.full_name||meta.name);if(typeof candidate==="string"&&candidate.trim()){name=candidate;break;}}catch(err){}}}name=(name||"").replace(/\\s+/g," ").trim().slice(0,80)||${JSON.stringify(WEB_PROFILE_SHELL_FALLBACK_NAME)};hero.textContent="";hero.appendChild(document.createTextNode(name));hero.appendChild(document.createElement("br"));hero.appendChild(document.createTextNode(${JSON.stringify(WEB_PROFILE_SHELL_SUBTITLE)}));}catch(e){}})();`;
}

function shellCss(): string {
  return [
    `#${WEB_PROFILE_SHELL_ID}{display:none;}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"] body{background:${LIGHT_CANVAS};}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"] #${WEB_PROFILE_SHELL_ID}{display:block;position:fixed;z-index:2;top:${WEB_PROFILE_SHELL_TOP_PX}px;left:16px;right:16px;pointer-events:none;}`,
    `#${WEB_PROFILE_SHELL_HERO_ID}{margin:0;padding:0;max-height:${WEB_PROFILE_SHELL_HERO_BLOCK_PX}px;overflow:hidden;font-family:Roboto,"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:24px;line-height:${WEB_PROFILE_SHELL_HERO_LINE_PX}px;font-weight:700;letter-spacing:0;text-align:center;color:${LIGHT_INK};}`,
    `@media (prefers-color-scheme: dark){html[${WEB_PROFILE_SHELL_ATTR}="1"]:not(.sm-profile-light) body{background:${DARK_CANVAS};}html[${WEB_PROFILE_SHELL_ATTR}="1"]:not(.sm-profile-light) #${WEB_PROFILE_SHELL_HERO_ID}{color:${DARK_INK};}}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"].sm-profile-dark body{background:${DARK_CANVAS};}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"].sm-profile-dark #${WEB_PROFILE_SHELL_HERO_ID}{color:${DARK_INK};}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"].sm-profile-light body{background:${LIGHT_CANVAS};}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"].sm-profile-light #${WEB_PROFILE_SHELL_HERO_ID}{color:${LIGHT_INK};}`,
  ].join("");
}

function shellMarkup(): string {
  return `<div id="${WEB_PROFILE_SHELL_ID}"><p id="${WEB_PROFILE_SHELL_HERO_ID}">${WEB_PROFILE_SHELL_FALLBACK_NAME}<br>${WEB_PROFILE_SHELL_SUBTITLE}</p></div><script>${webProfileShellNameScript()}</script>`;
}

/** Insert the Profile hero into an Expo web `index.html`. Idempotent. */
export function injectWebProfileShell(html: string): string {
  if (html.includes(`id="${WEB_PROFILE_SHELL_ID}"`)) return html;

  const headClose = "</head>";
  if (!html.includes(headClose)) {
    throw new Error("Expo web index.html is missing </head>");
  }

  const rootPattern = /<div id="root"[^>]*><\/div>/;
  if (!rootPattern.test(html)) {
    throw new Error("Expo web index.html is missing #root");
  }

  const head =
    `<style id="${WEB_PROFILE_SHELL_ID}-css">${shellCss()}</style>` +
    `<script>${webProfileShellHeadScript()}</script>`;
  const withHead = html.replace(headClose, `${head}${headClose}`);
  return withHead.replace(rootPattern, `${shellMarkup()}$&`);
}
