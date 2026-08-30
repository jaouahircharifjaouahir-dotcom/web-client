/**
 * Phase 6E.2: retire Blogger-backed /feeds/pages/* via 410 Gone.
 */
export const PAGES_FEED_RETIRE_BODY = "<h1>410 Gone</h1>";

export function isPagesFeedPath(pathname) {
  const path = String(pathname || "");
  return path === "/feeds/pages/default" || path.startsWith("/feeds/pages/");
}

/** @returns {Response | null} 410 Gone for legacy pages feed paths, or null if path does not match. */
export function pagesFeedRetireResponse(pathname, { primaryHost = true } = {}) {
  if (!primaryHost || !isPagesFeedPath(pathname)) return null;
  return new Response(PAGES_FEED_RETIRE_BODY, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
