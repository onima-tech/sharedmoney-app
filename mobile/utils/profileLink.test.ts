import { assertEquals } from "jsr:@std/assert@1";
import {
  isProfileDeepLink,
  profileWebPath,
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
