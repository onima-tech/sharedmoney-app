import { Platform } from "react-native";
import { getUserFriendlyErrorMessage } from "./errorMessages";

export const CANONICAL_WEB_APP_URL = "https://sharedmoney.app/app";

/** Invite-link tokens are 64 lowercase hex chars (256-bit secrets). */
export const INVITE_TOKEN_REGEX = /(?:^|\/)(?:app\/)?join\/([a-f0-9]{64})(?:[/?#]|$)/i;
export const GROUP_DEEP_LINK_REGEX =
  /(?:^|\/)(?:app\/)?groups\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

/**
 * Human-readable message for invite-link redemption failures.
 *
 * The redeem/preview RPCs raise Postgres exceptions with messages that are
 * already written for humans ("This invite link has already been used or
 * cancelled", "Invalid invite link"). supabase-js surfaces them as
 * PostgrestError ({ code: 'P0001', message, details, hint }); edge-function
 * errors use the { error, code } shape from _shared/error-handler.ts. Prefer
 * the known link messages verbatim, fall back to the generic mapper (which
 * would otherwise mangle e.g. "Invalid invite link" into "Invalid input").
 */
export function getInviteLinkErrorMessage(err: unknown): string {
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null
        ? String(
            (err as { message?: string; error?: string }).message ??
              (err as { message?: string; error?: string }).error ??
              ""
          )
        : "";

  if (/invite link/i.test(rawMessage)) {
    return rawMessage;
  }

  return getUserFriendlyErrorMessage(
    err instanceof Error ? err : new Error(rawMessage || "Unknown error")
  );
}

/**
 * Extracts an invite-link token from a URL (deep link, universal link, or web
 * location). Returns null when the URL is not an invite link.
 */
export function extractInviteToken(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(INVITE_TOKEN_REGEX);
  return match ? match[1].toLowerCase() : null;
}

export function extractGroupDeepLinkId(
  url: string | null | undefined
): string | null {
  if (!url) return null;
  const match = url.match(GROUP_DEEP_LINK_REGEX);
  return match ? match[1].toLowerCase() : null;
}

export function getCanonicalWebAppUrl(): string {
  return CANONICAL_WEB_APP_URL;
}

export function buildWebAppUrl(path: string): string {
  const pathWithoutLeadingSlash = path.replace(/^\/+/, "");
  const normalizedPath = pathWithoutLeadingSlash.startsWith("app/")
    ? pathWithoutLeadingSlash.slice(4)
    : pathWithoutLeadingSlash;
  return normalizedPath
    ? `${getCanonicalWebAppUrl()}/${normalizedPath}`
    : getCanonicalWebAppUrl();
}

export function getInviteLinkUrl(token: string): string {
  return buildWebAppUrl(`join/${encodeURIComponent(token)}`);
}

export function getGroupLinkUrl(groupId: string): string {
  return buildWebAppUrl(`groups/${encodeURIComponent(groupId)}`);
}

export function getConfiguredWebAppPath(): string {
  if (process.env.EXPO_PUBLIC_WEB_BASE_URL) {
    return normalizeAppPath(process.env.EXPO_PUBLIC_WEB_BASE_URL);
  }

  if (process.env.EXPO_PUBLIC_APP_URL) {
    try {
      return normalizeAppPath(new URL(process.env.EXPO_PUBLIC_APP_URL).pathname);
    } catch {
      return "";
    }
  }

  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/app")
  ) {
    return "/app";
  }

  return "";
}

function normalizeAppPath(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  return normalized === "/" ? "" : normalized;
}
