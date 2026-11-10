import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..", "..");
const canonicalAppUrl = "https://sharedmoney.app/app";

const inviteLinksSource = readFileSync(
  join(repoRoot, "mobile", "utils", "inviteLinks.ts"),
  "utf8"
);
const addMemberSource = readFileSync(
  join(repoRoot, "mobile", "screens", "AddMemberScreen.tsx"),
  "utf8"
);

if (!inviteLinksSource.includes(`CANONICAL_WEB_APP_URL = "${canonicalAppUrl}"`)) {
  throw new Error(`Expected canonical app URL ${canonicalAppUrl}`);
}

if (!addMemberSource.includes("getInviteLinkUrl(token)")) {
  throw new Error("Invite link generation must use getInviteLinkUrl(token)");
}

if (!inviteLinksSource.includes("getGroupLinkUrl(groupId: string)")) {
  throw new Error("Expected a shared group link helper");
}

if (inviteLinksSource.includes("window.location.origin")) {
  throw new Error("Generated share links must not fall back to the current host");
}

console.log("Canonical link checks passed");
