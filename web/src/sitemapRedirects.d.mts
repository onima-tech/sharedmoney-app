export type SitemapRedirect = {
  source?: string;
  has?: readonly { type?: string; value?: string }[];
  destination?: string;
  permanent?: boolean;
};

export function sitemapLocPath(loc: string): string;

export function sitemapLocsMatchingRedirects(
  locs: readonly string[],
  redirects: readonly SitemapRedirect[] | undefined,
): string[];
