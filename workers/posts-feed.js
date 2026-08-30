/**
 * Static posts feed delivery for /feeds/posts/default (Phase 6B).
 * Serves build-time Atom/RSS assets — never fetchBlogger().
 */
export const FEED_POSTS_PATH = "/feeds/posts/default";
export const FEED_POSTS_ATOM_ASSET = "/feeds/posts/default";
export const FEED_POSTS_RSS_ASSET = "/feeds/posts/default.rss";

export const FEED_ATOM_CONTENT_TYPE = "application/atom+xml; charset=UTF-8";
export const FEED_RSS_CONTENT_TYPE = "application/rss+xml; charset=UTF-8";

export function isPostsFeedPath(pathname) {
  return String(pathname || "") === FEED_POSTS_PATH;
}

/**
 * Resolve which static feed variant to serve.
 *
 * Intended behavior:
 * - no query → atom
 * - ?alt=rss → rss (exact, case-sensitive)
 * - ?alt=RSS → atom (not exact "rss")
 * - ?alt=atom → atom (site-urls.mjs)
 * - ?alt=atom&max-results=150 → atom
 * - ?foo=1 → atom (unknown params ignored)
 * - ?alt=rss&foo=1 → rss
 */
export function resolvePostsFeedVariant(searchParams) {
  const alt = searchParams?.get?.("alt");
  if (alt === "rss") return "rss";
  return "atom";
}

export function postsFeedAssetPath(variant) {
  return variant === "rss" ? FEED_POSTS_RSS_ASSET : FEED_POSTS_ATOM_ASSET;
}

export function postsFeedContentType(variant) {
  return variant === "rss" ? FEED_RSS_CONTENT_TYPE : FEED_ATOM_CONTENT_TYPE;
}

/**
 * @param {URL} url
 * @param {{ ASSETS?: { fetch: (req: Request) => Promise<Response> } }} env
 * @returns {Promise<Response | null>}
 */
export async function handlePostsFeedRequest(url, env) {
  if (!isPostsFeedPath(url.pathname)) return null;
  if (!env?.ASSETS) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const variant = resolvePostsFeedVariant(url.searchParams);
  const assetPath = postsFeedAssetPath(variant);
  const assetUrl = new URL(assetPath, url.origin);
  const res = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: "GET" }));
  if (!res.ok) return res;

  const headers = new Headers(res.headers);
  headers.set("content-type", postsFeedContentType(variant));
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=3600, must-revalidate");
  }
  return new Response(res.body, { status: res.status, headers });
}
