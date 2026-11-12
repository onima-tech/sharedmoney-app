/**
 * Static invite shell for /app/join/:token on the Expo web export.
 *
 * Logged-out browsers paint this before the bundle: the person was invited,
 * with store links and an open-in-app control. Logged-in visits skip it so
 * the existing join flow can redeem the token. The shell does not read or
 * render group names, members, balances, emails, or phone numbers.
 *
 * A standalone copy (web/dist/app/join.html) carries the document title and
 * a noscript block so the store links still show with JavaScript disabled.
 * The shared index.html gets the same shell, hidden until the path matches.
 */

import { STORE_URL_ANDROID, STORE_URL_IOS } from "../constants/storeUrls";
import {
  INVITE_LANDING_CAPTURE_KEY,
  INVITE_LANDING_CTAS,
  INVITE_LANDING_PENDING_VIEW_ATTR,
  INVITE_LANDING_QUEUE_KEY,
  INVITE_LANDING_SOURCE,
} from "./inviteLandingAnalytics";
import { ANALYTICS_EVENTS } from "./posthogEvents";

export const WEB_JOIN_SHELL_ATTR = "data-sm-join-shell";
export const WEB_JOIN_SHELL_ID = "sm-join-shell";
export const WEB_JOIN_NOSCRIPT_ID = "sm-join-noscript";
export const WEB_JOIN_OPEN_ID = "sm-join-open";
export const WEB_JOIN_SHELL_TITLE = "You're invited to a SharedMoney group";
export const WEB_JOIN_SHELL_TAGLINE = "No daily limits, no ads, no bank link.";
export const WEB_JOIN_SHELL_PLAY_LABEL = "Google Play";
export const WEB_JOIN_SHELL_IOS_LABEL = "App Store";
export const WEB_JOIN_SHELL_OPEN_LABEL = "Open in the app";
export const WEB_JOIN_SHELL_WEB_LABEL = "Continue on the web";

/** Matches the logged-out login shell so the invite page sits in the same column. */
export const WEB_JOIN_SHELL_TOP_PX = 96;
export const WEB_JOIN_SHELL_LOGO_PX = 50;
export const WEB_JOIN_SHELL_LOGO_GAP_PX = 28;
export const WEB_JOIN_SHELL_TITLE_SIZE_PX = 24;
export const WEB_JOIN_SHELL_TITLE_LINE_PX = 32;
export const WEB_JOIN_SHELL_COLUMN_PX = 342;

const LIGHT_CANVAS = "#F7F9FC";
const LIGHT_INK = "#17202A";
const LIGHT_SUBTITLE = "#4A5870";
const LIGHT_SURFACE = "#FFFFFF";
const LIGHT_OUTLINE = "#DCE3EC";
const LIGHT_ACTION = "#1F5EFF";
const DARK_CANVAS = "#11171D";
const DARK_INK = "#E6ECF3";
const DARK_SUBTITLE = "#B7C2CF";
const DARK_SURFACE = "#17202A";
const DARK_OUTLINE = "#344252";
const DARK_ACTION = "#9BB8FF";

const JOIN_PATH_SOURCE = "(?:^|/)(?:app/)?join/[^/?#]+";
const TOKEN_PATH_SOURCE = "^(?:/app)?/join/([^/?#]+)/?$";
const TOKEN_SAFE_SOURCE = "^[A-Za-z0-9_-]{1,128}$";

export interface WebJoinShellStorageEntry {
  key: string;
  value: string | null;
}

export function isInviteJoinPath(pathname: string): boolean {
  return new RegExp(JOIN_PATH_SOURCE).test(pathname);
}

/** Safe path segment for the custom-scheme link. Rejects slashes and markup. */
export function readInviteJoinToken(pathname: string): string | null {
  const match = pathname.match(new RegExp(TOKEN_PATH_SOURCE));
  if (!match?.[1]) return null;
  if (!new RegExp(TOKEN_SAFE_SOURCE).test(match[1])) return null;
  return match[1];
}

export function inviteOpenAppHref(token: string): string {
  return `sharedmoney://join/${token}`;
}

export function shouldPaintWebJoinShell(input: {
  pathname: string;
  search: string;
  hash: string;
  storageEntries: readonly WebJoinShellStorageEntry[];
}): boolean {
  if (!isInviteJoinPath(input.pathname)) return false;
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

function hasStoredAuthSession(entries: readonly WebJoinShellStorageEntry[]): boolean {
  return entries.some(
    (entry) =>
      entry.key.includes("auth-token") &&
      typeof entry.value === "string" &&
      entry.value.includes("access_token"),
  );
}

type ShellNode = { remove?: () => void };

type ShellDocument = {
  documentElement: {
    getAttribute(name: string): string | null;
    setAttribute?(name: string, value: string): void;
    removeAttribute?(name: string): void;
  };
  getElementById?(id: string): ShellNode | null;
};

function shellDocument(): ShellDocument | null {
  const scope = globalThis as { document?: ShellDocument };
  return scope.document ?? null;
}

export function isWebJoinShellActive(): boolean {
  return shellDocument()?.documentElement.getAttribute(WEB_JOIN_SHELL_ATTR) === "1";
}

export function dismissWebJoinShell(): void {
  const doc = shellDocument();
  if (!doc) return;
  doc.documentElement.setAttribute?.(WEB_JOIN_SHELL_ATTR, "0");
  doc.documentElement.removeAttribute?.(WEB_JOIN_SHELL_ATTR);
  doc.getElementById?.(WEB_JOIN_SHELL_ID)?.remove?.();
}

function regexLiteral(source: string): string {
  return `/${source.replace(/\//g, "\\/")}/`;
}

export function webJoinShellHeadScript(): string {
  const title = JSON.stringify(WEB_JOIN_SHELL_TITLE);
  const queueKey = JSON.stringify(INVITE_LANDING_QUEUE_KEY);
  const captureKey = JSON.stringify(INVITE_LANDING_CAPTURE_KEY);
  const pendingAttr = JSON.stringify(INVITE_LANDING_PENDING_VIEW_ATTR);
  const source = JSON.stringify(INVITE_LANDING_SOURCE);
  const viewEvent = JSON.stringify(ANALYTICS_EVENTS.INVITE_LANDING_VIEWED);
  const clickEvent = JSON.stringify(ANALYTICS_EVENTS.INVITE_LANDING_CTA_CLICKED);
  const allowed = `{${INVITE_LANDING_CTAS.map((cta) => `${JSON.stringify(cta)}:1`).join(",")}}`;
  const joinRe = regexLiteral(JOIN_PATH_SOURCE);

  return `(function(){var ATTR=${JSON.stringify(WEB_JOIN_SHELL_ATTR)};var JOIN=${joinRe};function queue(event,cta){try{var props={source:${source}};if(cta)props.cta=cta;var capture=globalThis[${captureKey}];if(typeof capture==="function"){capture(event,props);return true;}var raw=sessionStorage.getItem(${queueKey});var list=[];try{list=raw?JSON.parse(raw):[];}catch(err){list=[];}if(!Array.isArray(list))list=[];if(list.length>=8)return false;var item={event:event};if(cta)item.cta=cta;list.push(item);sessionStorage.setItem(${queueKey},JSON.stringify(list));return true;}catch(err){return false;}}function paintTheme(){try{var pref=localStorage.getItem("sharedmoney.themePreference")||localStorage.getItem("owewho.themePreference");var landing=null;try{landing=sessionStorage.getItem("theme");}catch(err){}var theme=landing==="light"||landing==="dark"?landing:(pref==="light"||pref==="dark"?pref:null);if(theme==="dark")document.documentElement.classList.add("sm-join-dark");if(theme==="light")document.documentElement.classList.add("sm-join-light");}catch(err){}}function show(){document.documentElement.setAttribute(ATTR,"1");document.title=${title};paintTheme();if(!queue(${viewEvent}))document.documentElement.setAttribute(${pendingAttr},"1");document.addEventListener("click",function(ev){var node=ev.target;if(node&&node.nodeType===3)node=node.parentElement;var ctaNode=node&&node.closest?node.closest("[data-invite-cta]"):null;if(!ctaNode)return;var cta=ctaNode.getAttribute("data-invite-cta");var allowed=${allowed};if(!allowed[cta])return;queue(${clickEvent},cta);if(cta==="web_app"){if(ev.preventDefault)ev.preventDefault();document.documentElement.setAttribute(ATTR,"0");var shell=document.getElementById(${JSON.stringify(WEB_JOIN_SHELL_ID)});if(shell&&shell.remove)shell.remove();}},true);}try{var path=location.pathname||"";var join=JOIN.test(path);var params=new URLSearchParams(location.search);var hash=location.hash||"";var oauth=params.has("code")||params.has("error")||hash.indexOf("access_token")!==-1||hash.indexOf("refresh_token")!==-1||hash.indexOf("error_description")!==-1;var hasSession=false;if(join&&!oauth){for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i);if(!key||key.indexOf("auth-token")===-1)continue;var raw=localStorage.getItem(key);if(raw&&raw.indexOf("access_token")!==-1){hasSession=true;break;}}}var paint=join&&!oauth&&!hasSession;document.documentElement.setAttribute(ATTR,paint?"1":"0");if(!paint){if(hasSession&&join)document.title="SharedMoney";return;}show();}catch(e){try{if(JOIN.test(location.pathname||""))show();}catch(err){}}})();`;
}

export function webJoinShellBodyScript(): string {
  const tokenRe = regexLiteral(TOKEN_PATH_SOURCE);
  const safeRe = regexLiteral(TOKEN_SAFE_SOURCE);
  return `(function(){try{if(document.documentElement.getAttribute(${JSON.stringify(WEB_JOIN_SHELL_ATTR)})!=="1")return;var open=document.getElementById(${JSON.stringify(WEB_JOIN_OPEN_ID)});if(!open)return;var match=(location.pathname||"").match(${tokenRe});var token=match?match[1]:"";if(!${safeRe}.test(token))return;open.setAttribute("href","sharedmoney://join/"+token);open.removeAttribute("hidden");}catch(e){}})();`;
}

function shellMark(logoSrc?: string): string {
  if (logoSrc) {
    return `<img src="${logoSrc}" width="${WEB_JOIN_SHELL_LOGO_PX}" height="${WEB_JOIN_SHELL_LOGO_PX}" alt="" />`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WEB_JOIN_SHELL_LOGO_PX}" height="${WEB_JOIN_SHELL_LOGO_PX}" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="108" fill="#1F5EFF"/><path d="M153 238 190 116c5-18 24-28 42-23l118 34-37 126-160-15Z" fill="#FF8A65"/><path d="M251 239 303 124c8-18 29-25 47-17l103 48-48 112-154-28Z" fill="#10A66E"/><path d="M94 230h324v154c0 45-36 81-81 81H175c-45 0-81-36-81-81V230Z" fill="#FFFFFF"/></svg>`;
}

function storeLink(label: string, href: string, cta: "play" | "app_store" | null): string {
  const ctaAttr = cta ? ` data-invite-cta="${cta}"` : "";
  return `<a class="sm-join-store"${ctaAttr} href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function pageMarkup(id: string, logoSrc: string | undefined, actions: string): string {
  return `<div id="${id}" class="sm-join-page"><div class="sm-join-column">${shellMark(logoSrc)}<h1>${WEB_JOIN_SHELL_TITLE}</h1><p class="sm-join-tagline">${WEB_JOIN_SHELL_TAGLINE}</p><div class="sm-join-actions">${actions}</div></div></div>`;
}

function shellActions(): string {
  return [
    storeLink(WEB_JOIN_SHELL_PLAY_LABEL, STORE_URL_ANDROID, "play"),
    storeLink(WEB_JOIN_SHELL_IOS_LABEL, STORE_URL_IOS, "app_store"),
    `<a id="${WEB_JOIN_OPEN_ID}" class="sm-join-open" data-invite-cta="open_app" href="sharedmoney://join" hidden>${WEB_JOIN_SHELL_OPEN_LABEL}</a>`,
    `<a class="sm-join-web" data-invite-cta="web_app" href="/app">${WEB_JOIN_SHELL_WEB_LABEL}</a>`,
  ].join("");
}

function noscriptMarkup(logoSrc?: string): string {
  const actions = [
    storeLink(WEB_JOIN_SHELL_PLAY_LABEL, STORE_URL_ANDROID, null),
    storeLink(WEB_JOIN_SHELL_IOS_LABEL, STORE_URL_IOS, null),
  ].join("");
  return `<noscript>${pageMarkup(WEB_JOIN_NOSCRIPT_ID, logoSrc, actions)}</noscript>`;
}

function shellCss(): string {
  const column = `${WEB_JOIN_SHELL_COLUMN_PX}px`;
  const top = `${WEB_JOIN_SHELL_TOP_PX}px`;
  const logo = `${WEB_JOIN_SHELL_LOGO_PX}px`;
  const logoGap = `${WEB_JOIN_SHELL_LOGO_GAP_PX}px`;
  const titleSize = `${WEB_JOIN_SHELL_TITLE_SIZE_PX}px`;
  const titleLine = `${WEB_JOIN_SHELL_TITLE_LINE_PX}px`;
  return [
    `#${WEB_JOIN_SHELL_ID}.sm-join-page{display:none;}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"]{background:${LIGHT_CANVAS};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"] body{background:${LIGHT_CANVAS};margin:0;}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"] #root{visibility:hidden;}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"] #sm-auth-shell{display:none !important;}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"] #${WEB_JOIN_SHELL_ID}.sm-join-page{display:flex;}`,
    `#${WEB_JOIN_NOSCRIPT_ID}.sm-join-page{display:flex;}`,
    `.sm-join-page{position:fixed;z-index:5;inset:0;box-sizing:border-box;padding:${top} 20px 40px;flex-direction:column;align-items:center;overflow:auto;background:${LIGHT_CANVAS};color:${LIGHT_INK};font-family:Roboto,"Helvetica Neue",Helvetica,Arial,sans-serif;}`,
    `.sm-join-column{width:min(${column},100%);display:flex;flex-direction:column;align-items:center;}`,
    `.sm-join-page svg,.sm-join-page img{display:block;width:${logo};height:${logo};margin:0 0 ${logoGap};}`,
    `.sm-join-page h1{margin:0;max-width:${column};font-size:${titleSize};line-height:${titleLine};font-weight:700;letter-spacing:0;text-align:center;text-wrap:balance;color:${LIGHT_INK};}`,
    `.sm-join-tagline{margin:12px 0 0;max-width:${column};font-size:16px;line-height:24px;font-weight:400;text-align:center;color:${LIGHT_SUBTITLE};}`,
    `.sm-join-actions{width:100%;display:flex;flex-direction:column;gap:12px;margin-top:30px;}`,
    `.sm-join-store,.sm-join-open{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:48px;padding:0 16px;border-radius:24px;font-size:16px;line-height:24px;font-weight:600;text-align:center;text-decoration:none;}`,
    `.sm-join-store{border:1px solid ${LIGHT_OUTLINE};background:${LIGHT_SURFACE};color:${LIGHT_INK};}`,
    `.sm-join-open{border:0;background:transparent;color:${LIGHT_ACTION};}`,
    `#${WEB_JOIN_OPEN_ID}[hidden]{display:none !important;}`,
    `.sm-join-web{display:flex;align-items:center;justify-content:center;min-height:40px;margin-top:4px;font-size:14px;line-height:20px;font-weight:600;color:${LIGHT_SUBTITLE};text-decoration:none;}`,
    `.sm-join-store:focus-visible,.sm-join-open:focus-visible,.sm-join-web:focus-visible{outline:2px solid ${LIGHT_ACTION};outline-offset:2px;}`,
    `@media (prefers-color-scheme: dark){`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"]:not(.sm-join-light),html[${WEB_JOIN_SHELL_ATTR}="1"]:not(.sm-join-light) body,html[${WEB_JOIN_SHELL_ATTR}="1"]:not(.sm-join-light) #${WEB_JOIN_SHELL_ID}.sm-join-page{background:${DARK_CANVAS};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"]:not(.sm-join-light) #${WEB_JOIN_SHELL_ID} h1{color:${DARK_INK};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"]:not(.sm-join-light) #${WEB_JOIN_SHELL_ID} .sm-join-tagline,html[${WEB_JOIN_SHELL_ATTR}="1"]:not(.sm-join-light) #${WEB_JOIN_SHELL_ID} .sm-join-web{color:${DARK_SUBTITLE};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"]:not(.sm-join-light) #${WEB_JOIN_SHELL_ID} .sm-join-store{background:${DARK_SURFACE};border-color:${DARK_OUTLINE};color:${DARK_INK};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"]:not(.sm-join-light) #${WEB_JOIN_SHELL_ID} .sm-join-open{color:${DARK_ACTION};}`,
    `#${WEB_JOIN_NOSCRIPT_ID}.sm-join-page{background:${DARK_CANVAS};color:${DARK_INK};}`,
    `#${WEB_JOIN_NOSCRIPT_ID} h1{color:${DARK_INK};}`,
    `#${WEB_JOIN_NOSCRIPT_ID} .sm-join-tagline{color:${DARK_SUBTITLE};}`,
    `#${WEB_JOIN_NOSCRIPT_ID} .sm-join-store{background:${DARK_SURFACE};border-color:${DARK_OUTLINE};color:${DARK_INK};}`,
    `}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-dark,html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-dark body,html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-dark #${WEB_JOIN_SHELL_ID}.sm-join-page{background:${DARK_CANVAS};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-dark #${WEB_JOIN_SHELL_ID} h1{color:${DARK_INK};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-dark #${WEB_JOIN_SHELL_ID} .sm-join-tagline,html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-dark #${WEB_JOIN_SHELL_ID} .sm-join-web{color:${DARK_SUBTITLE};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-dark #${WEB_JOIN_SHELL_ID} .sm-join-store{background:${DARK_SURFACE};border-color:${DARK_OUTLINE};color:${DARK_INK};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-dark #${WEB_JOIN_SHELL_ID} .sm-join-open{color:${DARK_ACTION};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-light,html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-light body,html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-light #${WEB_JOIN_SHELL_ID}.sm-join-page{background:${LIGHT_CANVAS};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-light #${WEB_JOIN_SHELL_ID} h1{color:${LIGHT_INK};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-light #${WEB_JOIN_SHELL_ID} .sm-join-tagline,html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-light #${WEB_JOIN_SHELL_ID} .sm-join-web{color:${LIGHT_SUBTITLE};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-light #${WEB_JOIN_SHELL_ID} .sm-join-store{background:${LIGHT_SURFACE};border-color:${LIGHT_OUTLINE};color:${LIGHT_INK};}`,
    `html[${WEB_JOIN_SHELL_ATTR}="1"].sm-join-light #${WEB_JOIN_SHELL_ID} .sm-join-open{color:${LIGHT_ACTION};}`,
  ].join("");
}

/** Insert the invite shell into an Expo web document. Idempotent. */
export function injectWebJoinShell(
  html: string,
  options?: { logoSrc?: string; standalone?: boolean },
): string {
  if (html.includes(`id="${WEB_JOIN_SHELL_ID}"`)) return html;
  if (options?.logoSrc && !/^\/app\/[A-Za-z0-9._/-]+$/.test(options.logoSrc)) {
    throw new Error("Join shell logo path must stay on /app");
  }

  const headClose = "</head>";
  if (!html.includes(headClose)) {
    throw new Error("Expo web index.html is missing </head>");
  }
  const rootPattern = /<div id="root"[^>]*><\/div>/;
  if (!rootPattern.test(html)) {
    throw new Error("Expo web index.html is missing #root");
  }

  let next = html;
  if (options?.standalone) {
    if (/<title>[^<]*<\/title>/.test(next)) {
      next = next.replace(
        /<title>[^<]*<\/title>/,
        `<title>${WEB_JOIN_SHELL_TITLE}</title>`,
      );
    } else {
      next = next.replace(headClose, `<title>${WEB_JOIN_SHELL_TITLE}</title>${headClose}`);
    }
    next = next.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
  }

  const head =
    `<style id="${WEB_JOIN_SHELL_ID}-css">${shellCss()}</style>` +
    `<script>${webJoinShellHeadScript()}</script>`;
  next = next.replace(headClose, `${head}${headClose}`);
  const noscript = options?.standalone ? noscriptMarkup(options.logoSrc) : "";
  const body =
    `${noscript}${pageMarkup(WEB_JOIN_SHELL_ID, options?.logoSrc, shellActions())}` +
    `<script>${webJoinShellBodyScript()}</script>`;
  return next.replace(rootPattern, `${body}$&`);
}

/** Fail the export when the standalone join document lost its no-JS content. */
export function assertJoinShellDocument(html: string): void {
  const missing: string[] = [];
  const required = [
    `<title>${WEB_JOIN_SHELL_TITLE}</title>`,
    WEB_JOIN_SHELL_TAGLINE,
    WEB_JOIN_SHELL_OPEN_LABEL,
    WEB_JOIN_SHELL_WEB_LABEL,
    STORE_URL_ANDROID,
    STORE_URL_IOS,
    'data-invite-cta="play"',
    'data-invite-cta="app_store"',
    'data-invite-cta="open_app"',
    'data-invite-cta="web_app"',
    `id="${WEB_JOIN_SHELL_ID}"`,
    "<noscript>",
  ];
  for (const piece of required) {
    if (!html.includes(piece)) missing.push(piece);
  }
  const noscript = html.match(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/i)?.[0] ?? "";
  if (!noscript.includes(STORE_URL_ANDROID) || !noscript.includes(STORE_URL_IOS)) {
    missing.push("noscript store links");
  }
  if (!noscript.includes(WEB_JOIN_SHELL_TITLE) || !noscript.includes(WEB_JOIN_SHELL_TAGLINE)) {
    missing.push("noscript invite copy");
  }
  if (missing.length > 0) {
    throw new Error(`Join shell document is missing: ${missing.join(", ")}`);
  }
}
