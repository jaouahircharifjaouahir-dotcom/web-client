/**
 * Phase 6D: root /2026/* static articles — hard 404 on miss, no Blogger, no SPA fallback.
 */
export const ARTICLE_NOT_FOUND_HTML =
  '<!DOCTYPE html><html lang="en"><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>';

/** Root English articles only (`/2026/…`), not `/l/{locale}/2026/…`. */
export function isPrimary2026Path(pathname) {
  const path = String(pathname || "");
  return path.startsWith("/2026/") && !path.startsWith("/l/");
}

/** `/2026/…/article.html/` → canonical `.html` without trailing slash. */
export function article2026HtmlTrailingSlashRedirect(url, siteOrigin = "https://www.11tik.com") {
  const rawPath = String(url.pathname || "");
  if (rawPath === rawPath.replace(/\/+$/, "")) return "";
  const path = rawPath.replace(/\/+$/, "") || "/";
  if (!path.startsWith("/2026/") || !path.endsWith(".html")) return "";
  return `${siteOrigin}${path}`;
}

/** Detect ASSETS SPA `not_found_handling` body (English index.html). */
export function isSpaFallbackHtml(html) {
  return /id=["']yte-root["']/.test(String(html || ""));
}

function articleNotFoundResponse(withSecurityHeaders) {
  return withSecurityHeaders(
    new Response(ARTICLE_NOT_FOUND_HTML, {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    }),
  );
}

/**
 * Primary-host /2026/* handler. Returns Response, or null when path is out of scope.
 * Never calls fetchBlogger().
 */
export async function handlePrimary2026PathRequest(
  url,
  env,
  { siteOrigin = "https://www.11tik.com", withSecurityHeaders = (response) => response } = {},
) {
  if (!isPrimary2026Path(url.pathname)) return null;
  if (!env?.ASSETS) return articleNotFoundResponse(withSecurityHeaders);

  const trailingSlashRedirect = article2026HtmlTrailingSlashRedirect(url, siteOrigin);
  if (trailingSlashRedirect) {
    const dest = new URL(trailingSlashRedirect);
    dest.search = url.search;
    return withSecurityHeaders(Response.redirect(dest.toString(), 301));
  }

  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path.endsWith(".html")) {
    const assetUrl = new URL(path, url.origin);
    const res = await env.ASSETS.fetch(new Request(assetUrl.toString()));
    if (!res.ok) return articleNotFoundResponse(withSecurityHeaders);
    const html = await res.text();
    if (isSpaFallbackHtml(html)) return articleNotFoundResponse(withSecurityHeaders);
    return withSecurityHeaders(new Response(html, { status: res.status, headers: res.headers }));
  }

  // Worker-first skips Assets `_redirects`; mirror extensionless → .html when asset exists.
  const htmlPath = `${path}.html`;
  const htmlRes = await env.ASSETS.fetch(new Request(new URL(htmlPath, url.origin).toString()));
  if (htmlRes.ok) {
    const html = await htmlRes.text();
    if (!isSpaFallbackHtml(html)) {
      const dest = new URL(htmlPath, `${siteOrigin}/`);
      dest.search = url.search;
      return withSecurityHeaders(Response.redirect(dest.toString(), 301));
    }
  }

  return articleNotFoundResponse(withSecurityHeaders);
}
