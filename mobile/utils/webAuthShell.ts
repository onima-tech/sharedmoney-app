/**
 * Static login shell for the Expo web export at /app.
 *
 * The exported document is an empty `#root` plus one multi-megabyte script.
 * On a mobile lab run that script cannot download and paint before 1s, so the
 * logged-out LCP title has to be real HTML that stays on screen. Removing it
 * when React mounts hands LCP back to whatever the bundle paints later.
 *
 * The shell is only shown for a logged-out mobile visit. React keeps the
 * methods-step title out of the DOM until the visitor leaves that step, so
 * the HTML title remains the largest text.
 */

import { isInviteJoinPath } from "./webJoinShell";

export const WEB_AUTH_SHELL_ATTR = "data-sm-auth-shell";
export const WEB_AUTH_SHELL_ID = "sm-auth-shell";
export const WEB_AUTH_SHELL_TITLE = "Log in to SharedMoney";

/** Matches AuthScreen's mobile methods header. Desktop auth is a different layout. */
export const WEB_AUTH_SHELL_TOP_PX = 96;
export const WEB_AUTH_SHELL_LOGO_PX = 50;
export const WEB_AUTH_SHELL_LOGO_GAP_PX = 28;
export const WEB_AUTH_SHELL_TITLE_SIZE_PX = 24;
export const WEB_AUTH_SHELL_TITLE_LINE_PX = 32;
export const WEB_AUTH_SHELL_COLUMN_PX = 342;
/** Same cutoff as WEB_AUTH_DESKTOP_BREAKPOINT. At this width the two-pane auth layout wins. */
export const WEB_AUTH_SHELL_DESKTOP_MIN_PX = 960;

export const WEB_AUTH_SHELL_HEADER_HEIGHT =
  WEB_AUTH_SHELL_LOGO_PX + WEB_AUTH_SHELL_LOGO_GAP_PX + WEB_AUTH_SHELL_TITLE_LINE_PX;

const LIGHT_CANVAS = "#F7F9FC";
const LIGHT_INK = "#17202A";
const DARK_CANVAS = "#11171D";
const DARK_INK = "#E6ECF3";

export interface WebAuthShellStorageEntry {
  key: string;
  value: string | null;
}

export function shouldPaintWebAuthShell(input: {
  search: string;
  hash: string;
  storageEntries: readonly WebAuthShellStorageEntry[];
  pathname?: string;
}): boolean {
  if (isInviteJoinPath(input.pathname ?? "")) return false;
  if (hasOAuthCallback(input.search, input.hash)) return false;
  if (hasStoredAuthSession(input.storageEntries)) return false;
  return true;
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

function hasStoredAuthSession(entries: readonly WebAuthShellStorageEntry[]): boolean {
  return entries.some(
    (entry) =>
      entry.key.includes("auth-token") &&
      typeof entry.value === "string" &&
      entry.value.includes("access_token"),
  );
}

type ShellDocument = {
  documentElement: {
    getAttribute(name: string): string | null;
    setAttribute?(name: string, value: string): void;
    removeAttribute?(name: string): void;
    classList?: { add(name: string): void };
  };
  getElementById?(id: string): { remove(): void } | null;
};

function shellDocument(): ShellDocument | null {
  const scope = globalThis as { document?: ShellDocument };
  return scope.document ?? null;
}

export function isWebAuthShellActive(): boolean {
  return shellDocument()?.documentElement.getAttribute(WEB_AUTH_SHELL_ATTR) === "1";
}

/** Drop the shell after the visitor leaves the logged-out methods step. */
export function dismissWebAuthShell(): void {
  const doc = shellDocument();
  if (!doc) return;
  doc.documentElement.removeAttribute?.(WEB_AUTH_SHELL_ATTR);
  doc.getElementById?.(WEB_AUTH_SHELL_ID)?.remove();
}

export function webAuthShellBootstrapScript(): string {
  return `(function(){try{var path=location.pathname||"";var join=/(?:^|\\/)(?:app\\/)?join\\/[^/?#]+/.test(path);var params=new URLSearchParams(location.search);var hash=location.hash||"";var oauth=params.has("code")||params.has("error")||hash.indexOf("access_token")!==-1||hash.indexOf("refresh_token")!==-1||hash.indexOf("error_description")!==-1;var hasSession=false;if(!join&&!oauth){for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i);if(!key||key.indexOf("auth-token")===-1)continue;var raw=localStorage.getItem(key);if(raw&&raw.indexOf("access_token")!==-1){hasSession=true;break;}}}var paint=!oauth&&!hasSession&&!join;document.documentElement.setAttribute("${WEB_AUTH_SHELL_ATTR}",paint?"1":"0");if(!paint)return;var pref=localStorage.getItem("sharedmoney.themePreference")||localStorage.getItem("owewho.themePreference");var landing=null;try{landing=sessionStorage.getItem("theme");}catch(err){}var theme=landing==="light"||landing==="dark"?landing:(pref==="light"||pref==="dark"?pref:null);if(theme==="dark")document.documentElement.classList.add("sm-auth-dark");if(theme==="light")document.documentElement.classList.add("sm-auth-light");}catch(e){var joinPath=false;try{joinPath=/(?:^|\\/)(?:app\\/)?join\\/[^/?#]+/.test(location.pathname||"");}catch(err){}document.documentElement.setAttribute("${WEB_AUTH_SHELL_ATTR}",joinPath?"0":"1");}})();`;
}

function shellMark(logoSrc?: string): string {
  if (logoSrc) {
    return `<img src="${logoSrc}" width="${WEB_AUTH_SHELL_LOGO_PX}" height="${WEB_AUTH_SHELL_LOGO_PX}" alt="" />`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WEB_AUTH_SHELL_LOGO_PX}" height="${WEB_AUTH_SHELL_LOGO_PX}" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="108" fill="#1F5EFF"/><path d="M153 238 190 116c5-18 24-28 42-23l118 34-37 126-160-15Z" fill="#FF8A65"/><path d="M251 239 303 124c8-18 29-25 47-17l103 48-48 112-154-28Z" fill="#10A66E"/><path d="M94 230h324v154c0 45-36 81-81 81H175c-45 0-81-36-81-81V230Z" fill="#FFFFFF"/></svg>`;
}

function shellMarkup(logoSrc?: string): string {
  return `<div id="${WEB_AUTH_SHELL_ID}">${shellMark(logoSrc)}<h1>${WEB_AUTH_SHELL_TITLE}</h1></div>`;
}

function shellCss(): string {
  const column = `${WEB_AUTH_SHELL_COLUMN_PX}px`;
  return [
    `html[${WEB_AUTH_SHELL_ATTR}="1"] body{background:${LIGHT_CANVAS};}`,
    `#${WEB_AUTH_SHELL_ID}{display:none;}`,
    `html[${WEB_AUTH_SHELL_ATTR}="1"] #${WEB_AUTH_SHELL_ID}{display:flex;position:fixed;z-index:2;top:${WEB_AUTH_SHELL_TOP_PX}px;left:50%;transform:translateX(-50%);width:min(${column},calc(100% - 40px));flex-direction:column;align-items:center;pointer-events:none;}`,
    `#${WEB_AUTH_SHELL_ID} svg,#${WEB_AUTH_SHELL_ID} img{display:block;width:${WEB_AUTH_SHELL_LOGO_PX}px;height:${WEB_AUTH_SHELL_LOGO_PX}px;margin:0 0 ${WEB_AUTH_SHELL_LOGO_GAP_PX}px;}`,
    `#${WEB_AUTH_SHELL_ID} h1{margin:0;padding:0;max-width:${column};font-family:Roboto,"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:${WEB_AUTH_SHELL_TITLE_SIZE_PX}px;line-height:${WEB_AUTH_SHELL_TITLE_LINE_PX}px;font-weight:700;letter-spacing:0;text-align:center;color:${LIGHT_INK};}`,
    `@media (prefers-color-scheme: dark){html[${WEB_AUTH_SHELL_ATTR}="1"]:not(.sm-auth-light) body{background:${DARK_CANVAS};}html[${WEB_AUTH_SHELL_ATTR}="1"]:not(.sm-auth-light) #${WEB_AUTH_SHELL_ID} h1{color:${DARK_INK};}}`,
    `html[${WEB_AUTH_SHELL_ATTR}="1"].sm-auth-dark body{background:${DARK_CANVAS};}`,
    `html[${WEB_AUTH_SHELL_ATTR}="1"].sm-auth-dark #${WEB_AUTH_SHELL_ID} h1{color:${DARK_INK};}`,
    `html[${WEB_AUTH_SHELL_ATTR}="1"].sm-auth-light body{background:${LIGHT_CANVAS};}`,
    `html[${WEB_AUTH_SHELL_ATTR}="1"].sm-auth-light #${WEB_AUTH_SHELL_ID} h1{color:${LIGHT_INK};}`,
    `@media (min-width: ${WEB_AUTH_SHELL_DESKTOP_MIN_PX}px){#${WEB_AUTH_SHELL_ID}{display:none !important;}}`,
  ].join("");
}

/** Insert the shell into an Expo web `index.html`. Idempotent. */
export function injectWebAuthShell(
  html: string,
  options?: { logoSrc?: string },
): string {
  if (html.includes(`id="${WEB_AUTH_SHELL_ID}"`)) return html;
  if (options?.logoSrc && !/^\/app\/[A-Za-z0-9._/-]+$/.test(options.logoSrc)) {
    throw new Error("Login shell logo path must stay on /app");
  }

  const headClose = "</head>";
  if (!html.includes(headClose)) {
    throw new Error("Expo web index.html is missing </head>");
  }

  const rootPattern = /<div id="root"[^>]*><\/div>/;
  if (!rootPattern.test(html)) {
    throw new Error("Expo web index.html is missing #root");
  }

  const head =
    `<style id="${WEB_AUTH_SHELL_ID}-css">${shellCss()}</style>` +
    `<script>${webAuthShellBootstrapScript()}</script>`;
  const withHead = html.replace(headClose, `${head}${headClose}`);
  return withHead.replace(rootPattern, `${shellMarkup(options?.logoSrc)}$&`);
}
