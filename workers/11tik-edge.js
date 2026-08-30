import { ISO6391_CODES } from "./iso6391.js";
import { descriptionForPath } from "./post-descriptions.js";
import { resolvePageDescription, upsertHeadDescription, upgradeHttpCanonicals } from "./html-meta.js";
import { protectEmailsInHtml, wrapMailtoWithEmailOff } from "./email-obfuscation.js";
import {
  homepageUrlWithoutBloggerMobileParam,
  patchHomepageShellHtml,
  resolveHomepageQueryShell,
} from "./homepage-query-shell.mjs";
import { INDEXABLE_UTILITY_PATHS, LEGACY_P_REDIRECTS } from "./sitemap-canonicals.js";
import { handlePostsFeedRequest, isPostsFeedPath } from "./posts-feed.js";
import { sitemapPagesRedirectResponse } from "./sitemap-pages-redirect.js";

export { wrapMailtoWithEmailOff, protectEmailsInHtml };

const SITE = "https://www.11tik.com";
const GH_PAGES = "https://jaouahircharifjaouahir-dotcom.github.io/web-client/";
const EDGE_ASSETS = "https://www.11tik.com/web-client/";

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

function isBloggerContentPath(pathname) {
  return (
    pathname.startsWith("/2026/") ||
    (pathname.startsWith("/feeds/") && !isPostsFeedPath(pathname)) ||
    pathname === "/search" ||
    pathname.startsWith("/search/")
  );
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
 * Phase 2B: www /p/* Worker fallback when negative run_worker_first excludes only six utilities.
 * Never calls fetchBlogger(); unknown paths return a true 404 (not SPA).
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

  if (INDEXABLE_UTILITY_SET.has(path) && env?.ASSETS) {
    const assetUrl = new URL(path, url.origin);
    return withSecurityHeaders(await env.ASSETS.fetch(new Request(assetUrl.toString())));
  }

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

function fetchBlogger(request) {
  const headers = new Headers(request.headers);
  headers.set("x-11tik-pass", "1");
  return fetch(new Request(request.url, { method: "GET", headers }), {
    cf: { resolveOverride: "ghs.googlehosted.com", cacheEverything: true, cacheTtl: 0 },
  });
}

function rewriteGithubAsset(el, attr) {
  const value = el.getAttribute(attr) || "";
  if (value.startsWith(GH_PAGES)) el.setAttribute(attr, EDGE_ASSETS + value.slice(GH_PAGES.length));
}

function bloggerRuntimeStubs() {
  return `<script>window.cookieChoices=window.cookieChoices||{};function _WidgetInfo(){return this;}window._WidgetInfo=window._WidgetInfo||_WidgetInfo;window._WidgetManager=window._WidgetManager||new Proxy({},{get:function(t,p){if(p==="then")return;return function(){return t;}}});</script>`;
}

async function polishBloggerHtml(response, pathname = "/") {
  const path = String(pathname || "/").replace(/\/+$/, "") || "/";
  let html = await response.text();
  html = upgradeHttpCanonicals(html);
  html = protectEmailsInHtml(html);
  if (path !== "/") {
    const desc = resolvePageDescription(path, html, descriptionForPath(path));
    if (desc) html = upsertHeadDescription(html, desc);
  }
  const headers = new Headers(response.headers);
  // no-transform: Cloudflare skips Email Obfuscation on this response.
  headers.set("Cache-Control", "public, max-age=120, must-revalidate, no-transform");
  const input = new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  return new HTMLRewriter()
    .on("head", {
      element(el) {
        el.prepend(bloggerRuntimeStubs(), { html: true });
      },
    })
    .on("script[src]", {
      element(el) {
        const src = el.getAttribute("src") || "";
        if (src.includes("widgets.js") || src.includes("/static/v1/widgets/") || src.includes("cookienotice.js")) {
          el.remove();
        }
      },
    })
    .on("link[rel]", {
      element(el) {
        const rel = (el.getAttribute("rel") || "").toLowerCase();
        const href = el.getAttribute("href") || "";
        if (rel === "canonical" && href.startsWith("http://") && href.includes("11tik.com")) {
          el.setAttribute("href", href.replace(/^http:\/\//i, "https://"));
        }
        if (rel === "preconnect") {
          if (href.includes("www.11tik.com") || href.includes("i.ytimg.com")) el.remove();
          return;
        }
        if (rel.includes("alternate") && el.getAttribute("hreflang") && !href.startsWith("https://www.11tik.com") && !href.includes(".11tik.com/")) {
          el.remove();
        }
      },
    })
    .on("meta[property]", {
      element(el) {
        const prop = (el.getAttribute("property") || "").toLowerCase();
        const content = el.getAttribute("content") || "";
        if (prop === "og:url" && content.startsWith("http://") && content.includes("11tik.com")) {
          el.setAttribute("content", content.replace(/^http:\/\//i, "https://"));
        }
        rewriteGithubAsset(el, "content");
      },
    })
    .on("img[src]", {
      element(el) {
        rewriteGithubAsset(el, "src");
      },
    })
    .on("meta[content]", {
      element(el) {
        const prop = (el.getAttribute("property") || "").toLowerCase();
        if (prop === "og:url") return;
        rewriteGithubAsset(el, "content");
      },
    })
    .transform(input);
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
    if (isPrimaryHost(host)) {
      const sitemapPagesRedirect = sitemapPagesRedirectResponse(url.pathname);
      if (sitemapPagesRedirect) return withSecurityHeaders(sitemapPagesRedirect);
    }

    // Same pattern as sitemap.xml: Worker-first + ASSETS so /robots.txt never falls
    // through to Blogger origin (Mediapartners-Google /share-widget). Zone route alone
    // without run_worker_first was insufficient once Managed robots prepend was off.
    if (url.pathname === "/robots.txt" && env?.ASSETS) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    if (url.pathname === "/llms.txt" && env?.ASSETS) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    // IndexNow ownership key — Worker-first Assets so SPA fallback / Blogger never wrap it.
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
    // www.11tik.com/copyright therefore missed /copyright?m=1 → Blogger origin 404.
    // Route is copyright*; canonicalize any query to the clean SPA URL (canonical /copyright).
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

    // Phase 6B: static posts feed (Atom passthrough + ?alt=rss RSS asset). Never fetchBlogger().
    if (isPrimaryHost(host) && isPostsFeedPath(url.pathname)) {
      const feedResponse = await handlePostsFeedRequest(url, env);
      if (feedResponse) return withSecurityHeaders(feedResponse);
    }

    if (isPrimaryHost(host) && request.headers.get("x-11tik-pass") !== "1" && isBloggerContentPath(url.pathname)) {
      return polishBloggerHtml(await fetchBlogger(request), url.pathname);
    }

    if (host === "www.11tik.com") {
      const legal = legalPageRedirect(url.pathname);
      if (legal) return Response.redirect(legal, 301);
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
    // Explicit zone routes (e.g. www.11tik.com/copyright) invoke this Worker; without
    // ASSETS passthrough the Worker used to hard-404 and Blogger never saw the request.
    if (env?.ASSETS) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  },
};
