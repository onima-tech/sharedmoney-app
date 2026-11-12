const WWW_HOST = "www.sharedmoney.app";

/** `/faq` and `/faq/` are the same path. A lone `/` stays `/`. */
function normalizeTrailingSlash(pathname) {
  if (typeof pathname !== "string" || pathname.length <= 1 || !pathname.endsWith("/")) {
    return pathname;
  }
  return pathname.slice(0, -1);
}

function isWwwHostRedirect(redirect) {
  const conditions = Array.isArray(redirect?.has) ? redirect.has : [];
  return conditions.some((condition) => {
    if (condition?.type !== "host" || typeof condition.value !== "string") {
      return false;
    }
    return condition.value.replace(/\.$/, "").toLowerCase() === WWW_HOST;
  });
}

function redirectSourcePath(source) {
  const raw = String(source);
  if (raw.includes("://")) {
    return normalizeTrailingSlash(new URL(raw).pathname);
  }
  const pathOnly = raw.split("?")[0].split("#")[0];
  const pathname = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return normalizeTrailingSlash(pathname);
}

export function sitemapLocPath(loc) {
  return normalizeTrailingSlash(new URL(loc).pathname);
}

/**
 * Sitemap `<loc>` values whose path equals a vercel.json redirect `source`.
 * Host-conditioned www redirects are ignored: they only rewrite the www host
 * and are not canonical URLs on the apex domain the sitemap advertises.
 */
export function sitemapLocsMatchingRedirects(locs, redirects) {
  const sources = new Set(
    (redirects ?? [])
      .filter((redirect) => typeof redirect?.source === "string" && !isWwwHostRedirect(redirect))
      .map((redirect) => redirectSourcePath(redirect.source)),
  );
  return locs.filter((loc) => sources.has(sitemapLocPath(loc)));
}
