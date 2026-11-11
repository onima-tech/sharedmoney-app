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

/** Cold-load route. Profile URLs stay on Profile; everything else opens Groups. */
export function initialRouteFromLocation(
  href: string | null | undefined,
): "profile" | "groups" {
  return isProfileDeepLink(href) ? "profile" : "groups";
}

/**
 * A signed-in reload of Profile restores the session after first paint.
 * That restore is not a login navigation and must not send the user to Groups.
 * Logout still returns to Groups. A login that did not start on Profile does too.
 */
export function routeAfterSessionChange(input: {
  hadSession: boolean;
  hasSession: boolean;
  initialRoute: string;
}): "groups" | null {
  if (input.hadSession === input.hasSession) return null;
  if (!input.hadSession && input.hasSession && input.initialRoute === "profile") {
    return null;
  }
  return "groups";
}

/**
 * Address-bar update for the in-app router.
 * Null means the current URL already matches the route.
 */
export function webHistoryPathForRoute(input: {
  route: string;
  appBase: string;
  pathname: string;
  search: string;
  hash: string;
}): string | null {
  const base = (input.appBase || "/app").replace(/\/+$/, "") || "/app";
  const current = `${input.pathname}${input.search}${input.hash}`;
  if (input.route === "profile") {
    if (isProfileDeepLink(current)) return null;
    return `${profileWebPath(base)}${input.search}${input.hash}`;
  }
  if (isProfileDeepLink(input.pathname) || isProfileDeepLink(current)) {
    return `${base}${input.search}${input.hash}`;
  }
  return null;
}

export type AppStartupChrome =
  | "groups-skeleton"
  | "profile-skeleton"
  | "spinner"
  | "profile-screen"
  | "auth"
  | "account-error"
  | "terms"
  | "ready";

/**
 * Signed-in Profile paints the real screen while auth or the profile request
 * is still in flight. Groups keeps its own skeleton. Logged-out Profile does
 * not borrow the Groups skeleton or the /app login shell.
 */
export function shouldRenderProfileDuringBootstrap(input: {
  route: string;
  hasSession: boolean;
  profileShellActive: boolean;
  profileFailed: boolean;
  needsTerms: boolean;
}): boolean {
  return (
    input.route === "profile" &&
    !input.profileFailed &&
    !input.needsTerms &&
    (input.profileShellActive || input.hasSession)
  );
}

export function resolveAppStartupChrome(input: {
  route: string;
  authLoading: boolean;
  hasSession: boolean;
  profileLoading: boolean;
  profileShellActive: boolean;
  profileFailed: boolean;
  needsTerms: boolean;
  hasProfile: boolean;
}): AppStartupChrome {
  const showProfileScreen = shouldRenderProfileDuringBootstrap(input);
  const bootstrapping =
    (input.authLoading || (input.hasSession && input.profileLoading)) &&
    !showProfileScreen;

  if (bootstrapping) {
    if (input.route === "groups") return "groups-skeleton";
    if (input.route === "profile") return "profile-skeleton";
    return "spinner";
  }

  if (!input.hasSession && !showProfileScreen) return "auth";

  if (
    input.hasSession &&
    (input.profileFailed || (!input.hasProfile && !input.profileLoading))
  ) {
    return "account-error";
  }

  if (input.hasSession && input.needsTerms) return "terms";
  if (input.route === "profile") return "profile-screen";
  return "ready";
}
