/**
 * Phase 6C.2: retire Blogger-backed /search and /search/* via 410 Gone.
 */
export const SEARCH_RETIRE_BODY = "<h1>410 Gone</h1>";

export function isSearchPath(pathname) {
  const path = String(pathname || "");
  return path === "/search" || path.startsWith("/search/");
}

/** @returns {Response | null} 410 Gone for legacy search paths, or null if path does not match. */
export function searchRetireResponse(pathname, { primaryHost = true } = {}) {
  if (!primaryHost || !isSearchPath(pathname)) return null;
  return new Response(SEARCH_RETIRE_BODY, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
