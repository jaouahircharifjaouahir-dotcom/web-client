import { ISO6391_CODES } from "./iso6391.js";
import { protectEmailsInHtml, wrapMailtoWithEmailOff } from "./email-obfuscation.js";
import {
  homepageUrlWithoutBloggerMobileParam,
  patchHomepageShellHtml,
  resolveHomepageQueryShell,
} from "./homepage-query-shell.mjs";
import { INDEXABLE_UTILITY_PATHS, LEGACY_P_REDIRECTS } from "./sitemap-canonicals.js";
import { handlePrimary2026PathRequest } from "./article-2026-path.js";
import { handlePostsFeedRequest, isPostsFeedPath } from "./posts-feed.js";
import { pagesFeedRetireResponse } from "./pages-feed-retire.js";
import { searchRetireResponse } from "./search-retire.js";
import { sitemapPagesRedirectResponse } from "./sitemap-pages-redirect.js";

export { wrapMailtoWithEmailOff, protectEmailsInHtml };

const SITE = "https://www.11tik.com";

function localeHostCode(host) {
  const match = /^([a-z]{2})\.11tik\.com$/i.exec(host || "");
  if (!match) return "";
  const code = match[1].toLowerCase();
  if (!ISO6391_CODES.has(code)) return "";
  return code;
}

function isPrimaryHost(host) {
  return host === "www.11tik.com" || host === "11tik.com";
}

const LEGACY_P_REDIRECT_BY_PATH = new Map(LEGACY_P_REDIRECTS.map((rule) => [rule.from, rule.to]));
const INDEXABLE_UTILITY_SET = new Set(INDEXABLE_UTILITY_PATHS);

const P_PATH_NOT_FOUND_HTML =
  "<!DOCTYPE html><html lang=\"en\"><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>";

/** @returns {string} absolute redirect URL, or "" */
export function legacyPRedirectUrl(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const to = LEGACY_P_REDIRECT_BY_PATH.get(path);
  if (!to) return "";
  return to === "/" ? `${SITE}/` : `${SITE}${to}`;
}

function pPathNotFoundResponse() {
  return withSecurityHeaders(
    new Response(P_PATH_NOT_FOUND_HTML, {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    }),
  );
}

/** @returns {string} absolute redirect URL when indexable utility has trailing slash, else "" */
export function utilityTrailingSlashCanonicalRedirect(url) {
  const rawPath = String(url.pathname || "");
  const path = rawPath.replace(/\/+$/, "") || "/";
  if (rawPath === path || !path.startsWith("/p/")) return "";
  if (!INDEXABLE_UTILITY_SET.has(path)) return "";
  return `${SITE}${path}`;
}

/**
 * Phase 5.3B / Phase 7A: localized `.html/` → clean `.html` on same host (query stripped).
 * Matches indexable `/l/{locale}/p/*.html/` utilities and `/l/{locale}/2026/…html/` articles only.
 *
 * @param {URL} url
 * @param {string} host normalized lowercase hostname
 * @returns {string} absolute redirect URL, or ""
 */
export function localizedHtmlTrailingSlashCanonicalRedirect(url, host) {
  const rawPath = String(url.pathname || "");
  if (!rawPath.endsWith(".html/")) return "";

  const path = rawPath.replace(/\/+$/, "") || "/";
  const pathLocaleMatch = /^\/l\/([a-z]{2})\/(p\/[^/]+\.html|2026\/.+\.html)$/i.exec(path);
  if (!pathLocaleMatch) return "";

  const pathLocale = pathLocaleMatch[1].toLowerCase();
  if (!ISO6391_CODES.has(pathLocale)) return "";

  const hostLocale = localeHostCode(host);
  if (hostLocale && hostLocale !== pathLocale) return "";
  if (!hostLocale && !isPrimaryHost(host)) return "";

  if (pathLocaleMatch[2].startsWith("p/")) {
    const utilityPath = `/p/${pathLocaleMatch[2].slice(2)}`;
    if (!INDEXABLE_UTILITY_SET.has(utilityPath)) return "";
  }

  return `${url.protocol}//${url.host}${path}`;
}

/**
 * Phase 2B: www /p/* Worker fallback when negative run_worker_first excludes only six utilities.
 * Unknown paths return a true 404 (not SPA).
 */
export async function handlePrimaryPPathRequest(url, env) {
  const rawPath = url.pathname;
  const path = rawPath.replace(/\/+$/, "") || "/";
  if (!path.startsWith("/p/")) return null;

  const trailingSlashRedirect = utilityTrailingSlashCanonicalRedirect(url);
  if (trailingSlashRedirect) {
    return Response.redirect(trailingSlashRedirect, 301);
  }

  const legacy = legacyPRedirectUrl(path);
  if (legacy) {
    const dest = new URL(legacy);
    dest.search = url.search;
    return Response.redirect(dest.toString(), 301);
  }

  if (INDEXABLE_UTILITY_SET.has(path) && url.search) {
    return Response.redirect(`${SITE}${path}`, 301);
  }

  const toHtml = extensionlessPPathToHtml(path);
  if (toHtml) {
    const dest = new URL(toHtml, `${SITE}/`);
    dest.search = url.search;
    return Response.redirect(dest.toString(), 301);
  }

  // Six indexable utilities are asset-first (negative RWF); when fetch() still runs, defer to ASSETS passthrough.
  if (INDEXABLE_UTILITY_SET.has(path)) return null;

  return pPathNotFoundResponse();
}

function legalPageRedirect(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/about") return `${SITE}/p/about.html`;
  if (path === "/privacy") return `${SITE}/p/privacy.html`;
  if (path === "/contact") return `${SITE}/p/contact.html`;
  if (path === "/terms") return `${SITE}/p/terms-of-use.html`;
  return "";
}

/** Extensionless indexable utility → .html (Worker-first /p/* skips Assets `_redirects`). */
export function extensionlessPPathToHtml(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  if (path.endsWith(".html")) return "";
  const withHtml = `${path}.html`;
  return INDEXABLE_UTILITY_SET.has(withHtml) ? withHtml : "";
}

/**
 * Directory-style locale home (/l/fr/) has no exact asset key; ASSETS SPA fallback
 * would serve English index.html. Map to staged l/{code}/index.html instead.
 */
export function localeHomeIndexAssetPath(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const m = /^\/l\/([a-z]{2})$/i.exec(path);
  if (!m) return "";
  const code = m[1].toLowerCase();
  if (!ISO6391_CODES.has(code)) return "";
  return `/l/${code}/index.html`;
}

/**
 * 301 http → https.
 * File 17: http sitemap must not be a second 200 listing.
 * File 18: http homepage must not be a 200 HTML page with internal outlinks.
 * File 21: http homepage must not be a 200 page carrying a canonical (http or https).
 */
export function httpsRedirectIfNeeded(request) {
  const url = new URL(request.url);
  if (url.protocol !== "http:") return null;
  url.protocol = "https:";
  return Response.redirect(url.toString(), 301);
}

/** Semrush HSTS: apex is not www; canonical host is www with path/query preserved. */
export function apexToWwwRedirectIfNeeded(request) {
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() !== "11tik.com") return null;
  url.hostname = "www.11tik.com";
  return withSecurityHeaders(Response.redirect(url.toString(), 301));
}

/** HSTS for Semrush no_hsts_support (Cloudflare terminates TLS; Worker sets policy on HTML/assets). */
export function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  if (!headers.has("strict-transport-security")) {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const httpsRedirect = httpsRedirectIfNeeded(request);
    if (httpsRedirect) return httpsRedirect;

    const apexRedirect = apexToWwwRedirectIfNeeded(request);
    if (apexRedirect) return apexRedirect;

    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const lang = localeHostCode(host);
    if (!isPrimaryHost(host) && !lang) {
      return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    }

    // Assets-backed sitemap must not be reachable as a second http:// sitemap copy.
    if (url.pathname === "/sitemap.xml" && env?.ASSETS) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    // Phase 6C.1: legacy Blogger pages sitemap → canonical static sitemap (query stripped).
    // Phase 6C.2: legacy Blogger search → 410 Gone (query variants included).
    // Phase 6E.2: legacy Blogger pages feed → 410 Gone (query variants included).
    if (isPrimaryHost(host)) {
      const sitemapPagesRedirect = sitemapPagesRedirectResponse(url.pathname);
      if (sitemapPagesRedirect) return withSecurityHeaders(sitemapPagesRedirect);

      const searchRetire = searchRetireResponse(url.pathname);
      if (searchRetire) return withSecurityHeaders(searchRetire);

      const pagesFeedRetire = pagesFeedRetireResponse(url.pathname);
      if (pagesFeedRetire) return withSecurityHeaders(pagesFeedRetire);
    }

    // Static SEO files — passthrough to ASSETS when fetch() runs (asset-first when file exists).
    if (url.pathname === "/robots.txt" && env?.ASSETS) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    if (url.pathname === "/llms.txt" && env?.ASSETS) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    // IndexNow ownership key — passthrough so SPA fallback never wraps it.
    if (url.pathname === "/r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt" && env?.ASSETS) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    // Homepage (incl. ?bulk=1 / ?posts=1 / ?embed=1): Worker-first so http→https always runs here
    // if zone Always Use HTTPS is ever off (Ahrefs File 18). Zone route www.11tik.com/* required
    // so query-string URLs reach this handler (exact www.11tik.com/ omits them — Semrush SD).
    if (url.pathname === "/" && env?.ASSETS) {
      const withoutMobile = homepageUrlWithoutBloggerMobileParam(url);
      if (withoutMobile) return Response.redirect(withoutMobile.toString(), 301);

      const assetUrl = new URL(url.origin + "/");
      const res = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
      const variant = resolveHomepageQueryShell(url.searchParams);
      if (!variant || !res.ok) return withSecurityHeaders(res);

      const headers = new Headers(res.headers);
      headers.set("content-type", "text/html; charset=utf-8");
      headers.set("cache-control", "public, max-age=120, must-revalidate");
      const html = patchHomepageShellHtml(await res.text(), variant);
      return withSecurityHeaders(new Response(html, { status: res.status, headers }));
    }

    // Exact zone routes without a trailing * do not match query strings (CF routes docs).
    // Route is copyright*; canonicalize any query to the clean URL (canonical /copyright).
    if (isPrimaryHost(host) && url.pathname.replace(/\/+$/, "") === "/copyright" && url.search) {
      return Response.redirect(`${SITE}/copyright`, 301);
    }

    // Serve static legal page explicitly so ASSETS SPA fallback never injects homepage hreflang.
    if (isPrimaryHost(host) && url.pathname.replace(/\/+$/, "") === "/copyright" && env?.ASSETS) {
      const assetUrl = new URL("/copyright/index.html", url.origin);
      const res = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
      if (res.ok) return withSecurityHeaders(res);
    }

    // Phase 2B: www /p/* Worker fallback (legacy 301, extensionless utility 301, unknown 404).
    // Six clean utility .html paths are excluded via negative run_worker_first → direct Assets.
    if (isPrimaryHost(host) && url.pathname.startsWith("/p/")) {
      const pResponse = await handlePrimaryPPathRequest(url, env);
      if (pResponse) return pResponse;
    }

    // Phase 6B: static posts feed (Atom passthrough + ?alt=rss RSS asset).
    if (isPrimaryHost(host) && isPostsFeedPath(url.pathname)) {
      const feedResponse = await handlePostsFeedRequest(url, env);
      if (feedResponse) return withSecurityHeaders(feedResponse);
    }

    // Phase 6D: root /2026/* static articles — exact asset or hard 404 (no SPA).
    if (isPrimaryHost(host)) {
      const article2026Response = await handlePrimary2026PathRequest(url, env, {
        siteOrigin: SITE,
        withSecurityHeaders,
      });
      if (article2026Response) return article2026Response;
    }

    if (host === "www.11tik.com") {
      const legal = legalPageRedirect(url.pathname);
      if (legal) return Response.redirect(legal, 301);
    }

    // Phase 7A: localized `.html/` → clean `.html` before ASSETS / SPA fallback.
    const localizedSlashRedirect = localizedHtmlTrailingSlashCanonicalRedirect(url, host);
    if (localizedSlashRedirect) {
      return withSecurityHeaders(Response.redirect(localizedSlashRedirect, 301));
    }

    // Locale home directories (/l/fr/) must resolve to l/fr/index.html before ASSETS SPA fallback.
    const localeHomeAsset = localeHomeIndexAssetPath(url.pathname);
    if (localeHomeAsset && env?.ASSETS) {
      const withoutMobile = homepageUrlWithoutBloggerMobileParam(url);
      if (withoutMobile) return Response.redirect(withoutMobile.toString(), 301);

      const assetUrl = new URL(localeHomeAsset, url.origin);
      const res = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
      if (!res.ok) return withSecurityHeaders(res);

      const variant = resolveHomepageQueryShell(url.searchParams);
      if (variant) {
        const headers = new Headers(res.headers);
        headers.set("content-type", "text/html; charset=utf-8");
        headers.set("cache-control", "public, max-age=120, must-revalidate");
        const html = patchHomepageShellHtml(await res.text(), variant);
        return withSecurityHeaders(new Response(html, { status: res.status, headers }));
      }
      return withSecurityHeaders(res);
    }

    // SPA + static assets: /copyright, /thumb/*, /l/*, /2026/*.html, /web-client/*, …
    if (env?.ASSETS) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  },
};
