/**
 * Phase 6C.1: retire Blogger-backed /sitemap-pages.xml via 301 to static sitemap.xml.
 */
export const SITEMAP_PAGES_PATH = "/sitemap-pages.xml";
export const SITEMAP_CANONICAL_URL = "https://www.11tik.com/sitemap.xml";

export function isSitemapPagesPath(pathname) {
  return String(pathname || "") === SITEMAP_PAGES_PATH;
}

/** @returns {Response | null} 301 to canonical sitemap, or null if path does not match. */
export function sitemapPagesRedirectResponse(pathname, { primaryHost = true } = {}) {
  if (!primaryHost || !isSitemapPagesPath(pathname)) return null;
  return Response.redirect(SITEMAP_CANONICAL_URL, 301);
}
