import { fitAlt, fitDescription, fitTitle } from "./html-meta.js";
import { KEYWORD_LANDINGS } from "./keyword-landings-data.js";

const SITE = "https://www.11tik.com";

export const HOMEPAGE_PREVIEW = {
  src: `${SITE}/web-client/images/social/og-image-640x336.webp`,
  alt: "11tik extractor showing a pasted YouTube URL and HD public thumbnail preview",
};

const POSTS_SHELL = {
  title: "YouTube thumbnail guides · 11tik",
  h1: "YouTube thumbnail guides",
  intro:
    "Browse step-by-step articles on downloading public YouTube thumbnails, Shorts stills, live covers, URL formats, and quality tiers. Each guide links to the same in-browser extractor on 11tik.",
};

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Blogger mobile ?m=1 duplicates the homepage shell (Ahrefs File 24). */
export function homepageUrlWithoutBloggerMobileParam(url) {
  if (!url.searchParams.has("m")) return null;
  const next = new URL(url.href);
  next.searchParams.delete("m");
  return next;
}

export function resolveHomepageQueryShell(searchParams) {
  const k = searchParams.get("k");
  if (k) {
    const landing = KEYWORD_LANDINGS.find((item) => item.slug === k);
    if (landing) {
      return {
        h1: landing.title,
        intro: landing.intro,
        title: fitTitle(`${landing.title} · 11tik`),
        description: fitDescription(landing.intro),
      };
    }
  }
  if (searchParams.get("posts") === "1") {
    return {
      ...POSTS_SHELL,
      title: fitTitle(POSTS_SHELL.title),
      description: fitDescription(POSTS_SHELL.intro),
    };
  }
  if (searchParams.get("bulk") === "1") {
    const landing = KEYWORD_LANDINGS.find((item) => item.slug === "bulk-youtube-thumbnails");
    if (landing) {
      return {
        h1: landing.title,
        intro: landing.intro,
        title: fitTitle(`${landing.title} · 11tik`),
        description: fitDescription(landing.intro),
      };
    }
  }
  return null;
}

export function homepagePreviewImgHtml() {
  const alt = fitAlt(HOMEPAGE_PREVIEW.alt);
  return `<p class="yte-preview-wrap"><img alt="${xmlEscape(alt)}" class="yte-preview" decoding="async" height="336" loading="lazy" src="${HOMEPAGE_PREVIEW.src}" width="640"/></p>`;
}

/** Visible homepage preview img removed (UX); og:image meta unchanged. Kept as identity for callers. */
export function ensureHomepagePreviewImg(html) {
  return String(html || "");
}

function upsertMetaContent(html, selectorAttr, selectorValue, content) {
  const re = new RegExp(
    `<meta\\s+${selectorAttr}=["']${selectorValue}["']\\s+content=["'][^"']*["']\\s*/?>`,
    "i",
  );
  const tag = `<meta ${selectorAttr}="${selectorValue}" content="${xmlEscape(content)}"/>`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `  ${tag}\n</head>`);
}

/** Non-canonical homepage query shells consolidate to /; hreflang belongs only on /. */
export function stripHreflangLinks(html) {
  return String(html || "").replace(/\s*<link\b[^>]*\bhreflang=[^>]*>\s*/gi, "\n");
}

/** Query shells are non-canonical; drop app JSON-LD (SoftwareApplication needs ratings). */
export function stripHeadJsonLd(html) {
  return String(html || "").replace(/\s*<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, "\n");
}

/** Patch crawlable homepage shell for ?k= / ?posts=1 / ?bulk=1 (JS-free Ahrefs crawl). */
export function patchHomepageShellHtml(html, variant) {
  if (!variant?.h1 || !variant.intro) return html;
  const h1 = xmlEscape(variant.h1);
  const intro = xmlEscape(variant.intro);
  const title = xmlEscape(variant.title || variant.h1);
  const description = xmlEscape(variant.description || variant.intro);

  let out = String(html || "");
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  out = upsertMetaContent(out, "name", "description", description);
  out = upsertMetaContent(out, "property", "og:title", title);
  out = upsertMetaContent(out, "property", "og:description", description);
  out = upsertMetaContent(out, "name", "twitter:title", title);
  out = upsertMetaContent(out, "name", "twitter:description", description);
  out = out.replace(
    /(<div id="yte-root"><h1>)[^<]*(<\/h1><p>)[^<]*(<\/p>)/i,
    `$1${h1}$2${intro}$3`,
  );
  return stripHeadJsonLd(stripHreflangLinks(out));
}
