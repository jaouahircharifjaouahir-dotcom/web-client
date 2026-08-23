import { ISO6391_CODES } from "./iso6391.js";
import { descriptionForPath } from "./post-descriptions.js";
import { resolvePageDescription, upsertHeadDescription } from "./html-meta.js";

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
  let input = response;
  if (path !== "/") {
    const html = await response.text();
    const desc = resolvePageDescription(path, html, descriptionForPath(path));
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "public, max-age=120, must-revalidate");
    input = new Response(desc ? upsertHeadDescription(html, desc) : html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
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
        if (rel === "preconnect") {
          if (href.includes("www.11tik.com") || href.includes("i.ytimg.com")) el.remove();
          return;
        }
        if (rel.includes("alternate") && el.getAttribute("hreflang") && !href.startsWith("https://www.11tik.com") && !href.includes(".11tik.com/")) {
          el.remove();
        }
      },
    })
    .on("img[src]", {
      element(el) {
        rewriteGithubAsset(el, "src");
      },
    })
    .on("meta[content]", {
      element(el) {
        rewriteGithubAsset(el, "content");
      },
    })
    .transform(input);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const lang = localeHostCode(host);
    if (!isPrimaryHost(host) && !lang) {
      return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    }

    if (isPrimaryHost(host) && request.headers.get("x-11tik-pass") !== "1" && isBloggerContentPath(url.pathname)) {
      return polishBloggerHtml(await fetchBlogger(request), url.pathname);
    }

    if (host === "www.11tik.com") {
      const legal = legalPageRedirect(url.pathname);
      if (legal) return Response.redirect(legal, 301);
    }

    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  },
};
