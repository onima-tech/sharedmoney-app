import { assertEquals } from "jsr:@std/assert@1";
import {
  initialRouteFromLocation,
  isProfileDeepLink,
  profileWebPath,
  resolveAppStartupChrome,
  routeAfterSessionChange,
  webHistoryPathForRoute,
} from "./profileLink.ts";

Deno.test("profile links are /app/profile and do not swallow other app paths", () => {
  assertEquals(isProfileDeepLink("https://sharedmoney.app/app/profile"), true);
  assertEquals(isProfileDeepLink("https://sharedmoney.app/app/profile/"), true);
  assertEquals(isProfileDeepLink("https://sharedmoney.app/app/profile?utm=share"), true);
  assertEquals(isProfileDeepLink("/app/profile#account"), true);
  assertEquals(isProfileDeepLink("/profile"), true);
  assertEquals(isProfileDeepLink("sharedmoney://profile"), true);
  assertEquals(isProfileDeepLink("https://sharedmoney.app/app"), false);
  assertEquals(isProfileDeepLink("https://sharedmoney.app/app/"), false);
  assertEquals(
    isProfileDeepLink(
      "https://sharedmoney.app/app/groups/11111111-2222-3333-4444-555555555555",
    ),
    false,
  );
  assertEquals(isProfileDeepLink("https://sharedmoney.app/app/profile/extra"), false);
  assertEquals(isProfileDeepLink("https://sharedmoney.app/application"), false);
  assertEquals(isProfileDeepLink(null), false);
});

Deno.test("profile web path hangs off the app base", () => {
  assertEquals(profileWebPath("/app"), "/app/profile");
  assertEquals(profileWebPath("/app/"), "/app/profile");
  assertEquals(profileWebPath(""), "/app/profile");
});

Deno.test("signed-in /app/profile does not fall through to Groups", () => {
  const href = "https://sharedmoney.app/app/profile";
  const initialRoute = initialRouteFromLocation(href);
  assertEquals(initialRoute, "profile");
  assertEquals(
    routeAfterSessionChange({
      hadSession: false,
      hasSession: true,
      initialRoute,
    }),
    null,
  );
  assertEquals(
    webHistoryPathForRoute({
      route: initialRoute,
      appBase: "/app",
      pathname: "/app/profile",
      search: "",
      hash: "",
    }),
    null,
  );

  const whileAuthRestores = resolveAppStartupChrome({
    route: initialRoute,
    authLoading: true,
    hasSession: false,
    profileLoading: true,
    profileShellActive: true,
    profileFailed: false,
    needsTerms: false,
    hasProfile: false,
  });
  assertEquals(whileAuthRestores, "profile-screen");

  const whileProfileLoads = resolveAppStartupChrome({
    route: initialRoute,
    authLoading: false,
    hasSession: true,
    profileLoading: true,
    profileShellActive: true,
    profileFailed: false,
    needsTerms: false,
    hasProfile: false,
  });
  assertEquals(whileProfileLoads, "profile-screen");
});

Deno.test("/profile stays on Profile after the redirect and /app stays on Groups", () => {
  assertEquals(
    initialRouteFromLocation("https://sharedmoney.app/profile"),
    "profile",
  );
  assertEquals(initialRouteFromLocation("https://sharedmoney.app/app"), "groups");
  assertEquals(initialRouteFromLocation("https://sharedmoney.app/app/"), "groups");
  assertEquals(
    routeAfterSessionChange({
      hadSession: false,
      hasSession: true,
      initialRoute: "groups",
    }),
    "groups",
  );
  assertEquals(
    resolveAppStartupChrome({
      route: "groups",
      authLoading: true,
      hasSession: false,
      profileLoading: false,
      profileShellActive: false,
      profileFailed: false,
      needsTerms: false,
      hasProfile: false,
    }),
    "groups-skeleton",
  );
  assertEquals(
    resolveAppStartupChrome({
      route: "groups",
      authLoading: false,
      hasSession: false,
      profileLoading: false,
      profileShellActive: false,
      profileFailed: false,
      needsTerms: false,
      hasProfile: false,
    }),
    "auth",
  );
});

Deno.test("logged-out Profile does not paint the Groups skeleton", () => {
  assertEquals(
    resolveAppStartupChrome({
      route: initialRouteFromLocation("/app/profile"),
      authLoading: true,
      hasSession: false,
      profileLoading: false,
      profileShellActive: false,
      profileFailed: false,
      needsTerms: false,
      hasProfile: false,
    }),
    "profile-skeleton",
  );
  assertEquals(
    resolveAppStartupChrome({
      route: "profile",
      authLoading: false,
      hasSession: false,
      profileLoading: false,
      profileShellActive: false,
      profileFailed: false,
      needsTerms: false,
      hasProfile: false,
    }),
    "auth",
  );
});

Deno.test("logout leaves Profile, and choosing a tab updates the address bar", () => {
  assertEquals(
    routeAfterSessionChange({
      hadSession: true,
      hasSession: false,
      initialRoute: "profile",
    }),
    "groups",
  );
  assertEquals(
    webHistoryPathForRoute({
      route: "profile",
      appBase: "/app",
      pathname: "/app",
      search: "",
      hash: "",
    }),
    "/app/profile",
  );
  assertEquals(
    webHistoryPathForRoute({
      route: "groups",
      appBase: "/app",
      pathname: "/app/profile",
      search: "?from=tab",
      hash: "",
    }),
    "/app?from=tab",
  );
  assertEquals(
    webHistoryPathForRoute({
      route: "groups",
      appBase: "/app",
      pathname: "/app",
      search: "",
      hash: "",
    }),
    null,
  );
});
