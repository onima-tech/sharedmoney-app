/** Web path for the signed-in Profile screen. Mirrors group links under /app. */
export const PROFILE_DEEP_LINK_REGEX =
  /(?:^|\/)(?:app\/)?profile\/?(?:[?#]|$)/i;

/**
 * True for /app/profile, /profile, and the sharedmoney://profile scheme.
 * Extra path segments are not Profile.
 */
export function isProfileDeepLink(url: string | null | undefined): boolean {
  if (!url) return false;
  return PROFILE_DEEP_LINK_REGEX.test(url);
}

/** `/app/profile` from the configured app base (`/app` in production). */
export function profileWebPath(appBase: string): string {
  const base = (appBase || "/app").replace(/\/+$/, "") || "/app";
  return `${base}/profile`;
}
