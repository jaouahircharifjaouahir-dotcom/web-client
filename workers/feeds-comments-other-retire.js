/**
 * Phase 10D: retire legacy Blogger feed families under /feeds/comments/* and /feeds/other/*.
 */
export const FEEDS_COMMENTS_OTHER_RETIRE_BODY = "<h1>410 Gone</h1>";

export function isCommentsFeedPath(pathname) {
  const path = String(pathname || "");
  return path === "/feeds/comments/default" || path.startsWith("/feeds/comments/");
}

export function isOtherFeedPath(pathname) {
  const path = String(pathname || "");
  return path === "/feeds/other/default" || path.startsWith("/feeds/other/");
}

/** @returns {Response | null} 410 Gone for comments/other feed paths, or null if path does not match. */
export function feedsCommentsOtherRetireResponse(pathname, { primaryHost = true } = {}) {
  if (!primaryHost) return null;
  if (!isCommentsFeedPath(pathname) && !isOtherFeedPath(pathname)) return null;
  return new Response(FEEDS_COMMENTS_OTHER_RETIRE_BODY, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600, must-revalidate",
    },
  });
}
