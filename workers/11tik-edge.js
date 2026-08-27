import { ISO6391_CODES } from "./iso6391.js";
import { descriptionForPath } from "./post-descriptions.js";
import { resolvePageDescription, upsertHeadDescription, upgradeHttpCanonicals } from "./html-meta.js";
import { protectEmailsInHtml, wrapMailtoWithEmailOff } from "./email-obfuscation.js";

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
    pathname.startsWith("/p/") ||
    pathname.startsWith("/feeds/") ||
    pathname === "/sitemap-pages.xml" ||
    pathname === "/search" ||
    pathname.startsWith("/search/")
  );
}

function legalPageRedirect(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/about") return `${SITE}/p/about.html`;
  if (path === "/privacy") return `${SITE}/p/privacy.html`;
  if (path === "/contact") return `${SITE}/p/contact.html`;
  if (path === "/terms") return `${SITE}/p/terms-of-use.html`;
  return "";
}

/** /p/about → /p/about.html (Worker-first paths skip Assets `_redirects`). */
export function extensionlessPPathToHtml(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  if (path.endsWith(".html")) return "";
  const m = /^\/p\/([a-z0-9-]+)$/i.exec(path);
  return m ? `/p/${m[1]}.html` : "";
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

export default {
  async fetch(request, env) {
    const httpsRedirect = httpsRedirectIfNeeded(request);
    if (httpsRedirect) return httpsRedirect;

    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const lang = localeHostCode(host);
    if (!isPrimaryHost(host) && !lang) {
      return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    }

    // Assets-backed sitemap must not be reachable as a second http:// sitemap copy.
    if (url.pathname === "/sitemap.xml" && env?.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Same pattern as sitemap.xml: Worker-first + ASSETS so /robots.txt never falls
    // through to Blogger origin (Mediapartners-Google /share-widget). Zone route alone
    // without run_worker_first was insufficient once Managed robots prepend was off.
    if (url.pathname === "/robots.txt" && env?.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // IndexNow ownership key — Worker-first Assets so SPA fallback / Blogger never wrap it.
    if (url.pathname === "/r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt" && env?.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Homepage (incl. ?bulk=1 / ?posts=1): Worker-first so http→https always runs here
    // if zone Always Use HTTPS is ever off (Ahrefs File 18).
    if (url.pathname === "/" && env?.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Exact zone routes without a trailing * do not match query strings (CF routes docs).
    // www.11tik.com/copyright therefore missed /copyright?m=1 → Blogger origin 404.
    // Route is copyright*; canonicalize any query to the clean SPA URL (canonical /copyright).
    if (isPrimaryHost(host) && url.pathname.replace(/\/+$/, "") === "/copyright" && url.search) {
      return Response.redirect(`${SITE}/copyright`, 301);
    }

    if (isPrimaryHost(host) && request.headers.get("x-11tik-pass") !== "1" && isBloggerContentPath(url.pathname)) {
      const toHtml = extensionlessPPathToHtml(url.pathname);
      if (toHtml) {
        const dest = new URL(toHtml, `${SITE}/`);
        dest.search = url.search;
        return Response.redirect(dest.toString(), 301);
      }
      return polishBloggerHtml(await fetchBlogger(request), url.pathname);
    }

    if (host === "www.11tik.com") {
      const legal = legalPageRedirect(url.pathname);
      if (legal) return Response.redirect(legal, 301);
    }

    // SPA + static assets: /copyright, /thumb/*, /l/*, /2026/*.html, /web-client/*, …
    // Explicit zone routes (e.g. www.11tik.com/copyright) invoke this Worker; without
    // ASSETS passthrough the Worker used to hard-404 and Blogger never saw the request.
    if (env?.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  },
};
