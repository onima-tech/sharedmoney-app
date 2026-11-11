/**
 * Logged-in Profile header painted in the Expo web document, before the bundle.
 *
 * The name uses the same headline as ProfileSetupScreen. The line under it
 * stays the muted body subtitle. Logged-out visits keep the login shell and
 * do not paint this header.
 */

export const WEB_PROFILE_SHELL_ATTR = "data-sm-profile-shell";
export const WEB_PROFILE_SHELL_ID = "sm-profile-shell";
export const WEB_PROFILE_SHELL_HERO_ID = "sm-profile-hero";
export const WEB_PROFILE_SHELL_NAME_ID = "sm-profile-name";
export const WEB_PROFILE_SHELL_SUBTITLE_ID = "sm-profile-subtitle";
export const WEB_PROFILE_LABEL_KEY = "sharedmoney.profileLabel";
export const WEB_PROFILE_SHELL_FALLBACK_NAME = "Your Profile";
export const WEB_PROFILE_SHELL_SUBTITLE = "Update your personal details";
/** App bar (64) + scroll padding + header margin + avatar block. */
export const WEB_PROFILE_SHELL_TOP_PX = 200;
/** headlineSmall, plus the bold title style on the Profile name. */
export const WEB_PROFILE_SHELL_NAME_SIZE_PX = 24;
export const WEB_PROFILE_SHELL_NAME_LINE_PX = 32;
/** styles.title marginBottom between the name and the subtitle. */
export const WEB_PROFILE_SHELL_NAME_GAP_PX = 4;
/** bodyMedium subtitle under the name. */
export const WEB_PROFILE_SHELL_SUBTITLE_SIZE_PX = 14;
export const WEB_PROFILE_SHELL_SUBTITLE_LINE_PX = 20;
export const WEB_PROFILE_SHELL_HERO_BLOCK_PX =
  WEB_PROFILE_SHELL_NAME_LINE_PX +
  WEB_PROFILE_SHELL_NAME_GAP_PX +
  WEB_PROFILE_SHELL_SUBTITLE_LINE_PX;

const LIGHT_CANVAS = "#F7F9FC";
const LIGHT_INK = "#17202A";
const LIGHT_SUBTITLE = "#4A5870";
const DARK_CANVAS = "#11171D";
const DARK_INK = "#E6ECF3";
const DARK_SUBTITLE = "#B7C2CF";

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
 * Move the painted header into the profile screen so it scrolls with the page.
 */
export function adoptWebProfileHero(
  slot: { appendChild(node: unknown): void } | null,
): void {
  const hero = shellDocument()?.getElementById?.(WEB_PROFILE_SHELL_HERO_ID);
  if (!slot || typeof slot.appendChild !== "function" || !hero) return;
  if (hero.parentElement === slot) return;
  slot.appendChild(hero);
}

/** Put the signed-in name in the headline. The subtitle node stays as body text. */
export function writeWebProfileHero(fullName: string | null | undefined): void {
  const name = shellDocument()?.getElementById?.(WEB_PROFILE_SHELL_NAME_ID);
  if (!name) return;
  name.textContent = normalizeProfileLabel(fullName);
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
  return `(function(){try{if(document.documentElement.getAttribute("${WEB_PROFILE_SHELL_ATTR}")!=="1")return;var nameEl=document.getElementById("${WEB_PROFILE_SHELL_NAME_ID}");if(!nameEl)return;var name=${JSON.stringify(WEB_PROFILE_SHELL_FALLBACK_NAME)};var saved=localStorage.getItem(${JSON.stringify(WEB_PROFILE_LABEL_KEY)});if(saved!=null){name=saved;}else{for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i);if(!key||key.indexOf("auth-token")===-1)continue;var raw=localStorage.getItem(key);if(!raw||raw.indexOf("access_token")===-1)continue;try{var parsed=JSON.parse(raw);var meta=parsed&&parsed.user&&parsed.user.user_metadata;var candidate=meta&&(meta.full_name||meta.name);if(typeof candidate==="string"&&candidate.trim()){name=candidate;break;}}catch(err){}}}name=(name||"").replace(/\\s+/g," ").trim().slice(0,80)||${JSON.stringify(WEB_PROFILE_SHELL_FALLBACK_NAME)};nameEl.textContent=name;}catch(e){}})();`;
}

function shellCss(): string {
  return [
    `#${WEB_PROFILE_SHELL_ID}{display:none;}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"] body{background:${LIGHT_CANVAS};}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"] #${WEB_PROFILE_SHELL_ID}{display:block;position:fixed;z-index:2;top:${WEB_PROFILE_SHELL_TOP_PX}px;left:16px;right:16px;pointer-events:none;}`,
    `#${WEB_PROFILE_SHELL_NAME_ID}{margin:0 0 ${WEB_PROFILE_SHELL_NAME_GAP_PX}px;padding:0;font-family:Roboto,"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:${WEB_PROFILE_SHELL_NAME_SIZE_PX}px;line-height:${WEB_PROFILE_SHELL_NAME_LINE_PX}px;font-weight:700;letter-spacing:0;text-align:center;color:${LIGHT_INK};}`,
    `#${WEB_PROFILE_SHELL_SUBTITLE_ID}{margin:0;padding:0;font-family:Roboto,"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:${WEB_PROFILE_SHELL_SUBTITLE_SIZE_PX}px;line-height:${WEB_PROFILE_SHELL_SUBTITLE_LINE_PX}px;font-weight:400;letter-spacing:0;text-align:center;color:${LIGHT_SUBTITLE};}`,
    `@media (prefers-color-scheme: dark){html[${WEB_PROFILE_SHELL_ATTR}="1"]:not(.sm-profile-light) body{background:${DARK_CANVAS};}html[${WEB_PROFILE_SHELL_ATTR}="1"]:not(.sm-profile-light) #${WEB_PROFILE_SHELL_NAME_ID}{color:${DARK_INK};}html[${WEB_PROFILE_SHELL_ATTR}="1"]:not(.sm-profile-light) #${WEB_PROFILE_SHELL_SUBTITLE_ID}{color:${DARK_SUBTITLE};}}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"].sm-profile-dark body{background:${DARK_CANVAS};}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"].sm-profile-dark #${WEB_PROFILE_SHELL_NAME_ID}{color:${DARK_INK};}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"].sm-profile-dark #${WEB_PROFILE_SHELL_SUBTITLE_ID}{color:${DARK_SUBTITLE};}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"].sm-profile-light body{background:${LIGHT_CANVAS};}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"].sm-profile-light #${WEB_PROFILE_SHELL_NAME_ID}{color:${LIGHT_INK};}`,
    `html[${WEB_PROFILE_SHELL_ATTR}="1"].sm-profile-light #${WEB_PROFILE_SHELL_SUBTITLE_ID}{color:${LIGHT_SUBTITLE};}`,
  ].join("");
}

function shellMarkup(): string {
  return `<div id="${WEB_PROFILE_SHELL_ID}"><div id="${WEB_PROFILE_SHELL_HERO_ID}"><p id="${WEB_PROFILE_SHELL_NAME_ID}">${WEB_PROFILE_SHELL_FALLBACK_NAME}</p><p id="${WEB_PROFILE_SHELL_SUBTITLE_ID}">${WEB_PROFILE_SHELL_SUBTITLE}</p></div></div><script>${webProfileShellNameScript()}</script>`;
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
