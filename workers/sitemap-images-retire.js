/**
 * Phase 10D: retire legacy /sitemap-images.xml (SPA fallback served homepage HTML).
 */
export const SITEMAP_IMAGES_RETIRE_BODY = "<h1>410 Gone</h1>";

export function isSitemapImagesPath(pathname) {
  return String(pathname || "") === "/sitemap-images.xml";
}

/** @returns {Response | null} 410 Gone for legacy image sitemap path, or null if path does not match. */
export function sitemapImagesRetireResponse(pathname, { primaryHost = true } = {}) {
  if (!primaryHost || !isSitemapImagesPath(pathname)) return null;
  return new Response(SITEMAP_IMAGES_RETIRE_BODY, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
