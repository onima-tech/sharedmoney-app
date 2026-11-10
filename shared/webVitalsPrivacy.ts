const SECRET_TOKEN = /[a-f0-9]{64}/i;

/** Invite links and guest bill links are 64-hex bearer secrets. */
export function redactSecretTokens(value: string): string {
  return value.replace(/[a-f0-9]{64}/gi, ":token");
}

export function containsSecretToken(value: unknown): boolean {
  if (typeof value === "string") return SECRET_TOKEN.test(value);
  if (Array.isArray(value)) return value.some(containsSecretToken);
  if (value && typeof value === "object") {
    return Object.values(value).some(containsSecretToken);
  }
  return false;
}

function stripQueryAndHash(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? value;
}

/**
 * Keep the page path for vitals and drop query, hash, credentials, and
 * bearer tokens. Returns null when the value is not an http(s) URL.
 */
export function sanitizeWebVitalUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  url.pathname = redactSecretTokens(url.pathname);
  return url.toString();
}

export type WebVitalEvent = {
  url: string;
  route?: string | null;
};

/**
 * Rewrite a Speed Insights vital before it is sent.
 * The injected script replaces `href` with the returned `url` and drops the
 * vital when this returns null. It does not apply a rewritten `route`, so
 * callers must not set the script `route` option to a raw path.
 */
export function sanitizeSpeedInsightsVital<T extends WebVitalEvent>(event: T): T | null {
  const url = sanitizeWebVitalUrl(event.url);
  if (!url || containsSecretToken(url)) return null;

  if (typeof event.route !== "string") {
    return { ...event, url };
  }

  const route = redactSecretTokens(stripQueryAndHash(event.route));
  if (containsSecretToken(route)) return null;
  return { ...event, url, route };
}

function sanitizeAnalyticsString(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return sanitizeWebVitalUrl(value) ?? redactSecretTokens(stripQueryAndHash(value));
  }

  if (value.startsWith("/") || value.includes("?") || value.includes("#")) {
    return redactSecretTokens(stripQueryAndHash(value));
  }

  return redactSecretTokens(value);
}

function sanitizeAnalyticsValue(value: unknown, depth: number): unknown {
  if (value === undefined) return undefined;
  if (depth > 8) return null;
  if (typeof value === "string") return sanitizeAnalyticsString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAnalyticsValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const sanitized = sanitizeAnalyticsValue(item, depth + 1);
      if (sanitized !== undefined) next[key] = sanitized;
    }
    return next;
  }
  return null;
}

/** Scrub PostHog event properties. Null means the event must not be sent. */
export function sanitizeAnalyticsRecord(
  properties: Record<string, unknown>,
): Record<string, unknown> | null {
  const sanitized = sanitizeAnalyticsValue(properties, 0);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return null;
  }
  if (containsSecretToken(sanitized)) return null;
  return sanitized as Record<string, unknown>;
}
