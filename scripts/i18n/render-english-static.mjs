/**
 * English static pages for /2026/* and /p/* (repo-first, no Blogger runtime).
 * Phase A: /2026/* removed from run_worker_first; /p/* remains Worker-first until Phase C.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clampImgAltsInHtml, fitAlt, fitDescription, fitTitle } from "../../workers/html-meta.js";
import { protectEmailsInHtml } from "../../workers/email-obfuscation.js";
import { descriptionForPath } from "../../workers/post-descriptions.js";
import { extractStructuredSource } from "./extract-source.mjs";
import { LOCALIZED_PAGE_ICONS, buildHreflangLinks, standardArticleStyleTag } from "./render-localized.mjs";
import {
  siteHeaderBodyClose,
  siteHeaderBodyOpen,
  siteHeaderHeadTags,
} from "./site-header.mjs";
import { renderLocaleCrawlNavHtml } from "./locale-crawl-nav.mjs";
import { upgradeStaticImagesToPicture } from "./image-delivery.mjs";
import { applyContextualInternalLinks } from "./contextual-internal-links.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GH_PAGES = "https://jaouahircharifjaouahir-dotcom.github.io/web-client/";
const EDGE_ASSETS = "https://www.11tik.com/web-client/";
const DEFAULT_OG = "https://www.11tik.com/web-client/images/social/og-image-1200x630.png";
const STUDY_OG_IMAGE =
  "https://www.11tik.com/web-client/images/blog/youtube-thumbnail-sizes-resolutions-study-og.png";
const STUDY_CONTENT_ID = "youtube-thumbnail-sizes-resolutions-study";

const UTILITY_PREVIEW_ALTS = {
  "/embed": "11tik thumbnail extractor embed widget preview",
  "/about": "11tik YouTube Thumbnail Extractor product preview at 1200 by 630 pixels",
};

/** Utility/article pages referenced only via og:image need a crawlable img+alt (Ahrefs File 26). */
function ensureBodyHeroImg(article, item, structured) {
  if (/<img\b/i.test(article)) return article;
  const alt = fitAlt(
    UTILITY_PREVIEW_ALTS[item.canonicalPath] ||
      structured.imageAlt ||
      structured.h1 ||
      "11tik YouTube thumbnail preview",
  );
  const tag = `<img alt="${xmlEscape(alt)}" class="yte-hero" height="630" loading="${item.canonicalPath === "/embed" ? "eager" : "lazy"}" src="${DEFAULT_OG}" width="1200"/>`;
  return article.replace(/(<(?:article|div)[^>]*class="yte-page"[^>]*>)/i, `$1\n  ${tag}`);
}

/**
 * Semrush #8 follow-up: English-only utility prose without mutating Blogger source
 * (keeps translation sourceHash stable — localized /l/{xx}/embed already pass).
 */
const ENGLISH_UTILITY_CONTENT_PATCHES = {
  embed: `<p>The embed loads the same in-browser extractor as <a href="https://www.11tik.com/?embed=1">www.11tik.com</a> with <code>?embed=1</code>. Visitors paste a public watch, Shorts, or youtu.be URL and download the largest still YouTube returns. No API key, no server-side storage of pasted links, and no video or audio download.</p>
  <p>Use this on a blog sidebar, documentation page, or creator toolkit where a self-contained widget helps. Thumbnail copyright stays with the uploader — see <a href="https://www.11tik.com/copyright">Copyright &amp; Usage</a>. For product background, read <a href="https://www.11tik.com/about">About 11tik</a>.</p>
  <h2>What the embed does</h2>
  <p>The iframe loads the public 11tik extractor UI. Height sync uses <code>id="yte-app"</code> plus <code>embed.js</code> so download buttons stay visible as results expand. Processing stays in the visitor&apos;s browser; pasted URLs are not stored on 11tik servers. There is no private YouTube API—only the same client-side image validation as the homepage.</p>
  <h2>iframe usage and URL structure</h2>
  <p>Point <code>src</code> at <code>https://www.11tik.com/?embed=1</code>. Deep-link a video with <code>?v=VIDEO_ID&amp;embed=1</code>. Keep <code>id="yte-app"</code> and load <code>embed.js</code> for automatic height sync. Do not clip the iframe with a fixed short height.</p>
  <h2>Video ID extraction</h2>
  <p>The widget accepts watch, Shorts, live, embed, and youtu.be URLs—the same parser as the main tool. Channel-only URLs need Bulk on the full site; the embed focuses on single-ID extraction.</p>
  <h2>Thumbnail variant logic and maxres fallback</h2>
  <p>Public stills use <code>i.ytimg.com/vi/{VIDEO_ID}/{filename}.jpg</code> (and WebP under <code>/vi_webp/</code> when published). The embed probes preset variants and lists only files that validate—it does not invent maxres or 4K. In our <a href="https://www.11tik.com/youtube-thumbnail-sizes-resolutions-study">300-video sample</a>, maxres validated for 286/300 IDs (sample-scoped). Details: <a href="https://www.11tik.com/what-is-maxresdefaultjpg-when-youtube">maxres and fallbacks</a>, <a href="https://www.11tik.com/youtube-thumbnail-size-resolution">size guide</a>.</p>
  <h2>Validation and browser-side processing</h2>
  <p>Each candidate loads as an image in the visitor&apos;s browser. Placeholders and 404s are dropped before any download button appears. Validate before hotlinking in your CMS.</p>
  <h2>CORS, CMS integration, and Open Graph</h2>
  <p>Cross-origin image loads work for display; canvas pixel reads may be restricted. For WordPress featured images and <code>og:image</code>, download a confirmed still and host on your domain—do not rely on long-lived <code>i.ytimg.com</code> hotlinks. Walkthrough: <a href="https://www.11tik.com/how-to-use-youtube-thumbnail-as-blog">blog / Open Graph guide</a>. URL anatomy: <a href="https://www.11tik.com/youtube-thumbnail-url">thumbnail URL guide</a>. WebP vs JPEG: <a href="https://www.11tik.com/webp-vs-jpeg-youtube-thumbnails-which">format comparison</a>.</p>
  <h2>Security and trust</h2>
  <p>The embed runs on 11tik over HTTPS. It does not execute arbitrary scripts from pasted URLs, does not request YouTube account cookies, and does not bypass private or age-gated videos. Only use the official <code>embed.js</code> from <code>www.11tik.com</code> so height sync and updates stay trustworthy.</p>`,
};

export function applyEnglishUtilityContentPatches(article, contentId) {
  const insert = ENGLISH_UTILITY_CONTENT_PATCHES[contentId];
  if (!insert) return article;
  if (article.includes(insert)) return article;
  const anchor =
    "<p>Add a free YouTube thumbnail extractor to your blog, docs, or creator toolkit. The widget loads from 11tik and resizes itself. No API key.</p>";
  if (!article.includes(anchor)) {
    throw new Error(`English utility content patch anchor missing for ${contentId}`);
  }
  return article.replace(anchor, `${anchor}\n  ${insert}`);
}

/** Ahrefs File 23: English-only href inlinks without mutating Blogger source (keeps translation sourceHash stable). */
const ENGLISH_ORPHAN_INLINK_PATCHES = {
  "youtube-thumbnail-url": [
    {
      before:
        "not <code>youtube.com/watch?v=…</code>. If you only need the file on disk, use the <a href=\"https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html\">download guide</a> instead of this URL-focused page.",
      after:
        "not <code>youtube.com/watch?v=…</code>. 11tik also uses a third URL shape — <code>/thumb/{VIDEO_ID}</code> — to reopen an extractor result page; that path is not a watch link and not a direct image file. See the <a href=\"https://www.11tik.com/11tik-share-links-thumb-vs-youtube\">share link guide</a> for when to copy each type. If you only need the file on disk, use the <a href=\"https://www.11tik.com/how-to-download-youtube-thumbnail\">download guide</a> instead of this URL-focused page.",
    },
  ],
  "how-to-download-youtube-thumbnail": [
    {
      before:
        "Channel or playlist URLs without a video ID will not yield a single thumbnail. For many video links at once, use Bulk (up to 50) — see <a href=\"https://www.11tik.com/how-to-batch-download-youtube\">batch download</a>. Working from a channel page with individual watch URLs: <a href=\"https://www.11tik.com/how-to-extract-thumbnails-from-youtube\">channel thumbnail guide</a>.",
      after:
        "Channel or playlist URLs without a video ID will not yield a single thumbnail. For live streams and premieres — saving the cover before go-live, during the broadcast, or after replay — see the <a href=\"https://www.11tik.com/youtube-live-premiere-thumbnail-download\">live and premiere thumbnail guide</a>. For many video links at once, use Bulk (up to 50) — see <a href=\"https://www.11tik.com/how-to-batch-download-youtube\">batch download</a>. Working from a channel page with individual watch URLs: <a href=\"https://www.11tik.com/how-to-extract-thumbnails-from-youtube\">channel thumbnail guide</a>.",
    },
    {
      before:
        "You save a public still YouTube already hosts. You do not unlock private videos, members-only files, or the MP4/WebM stream. 11tik is an extractor, not a maker and not a video downloader — comparison: <a href=\"https://www.11tik.com/2026/08/thumbnail-extractor-vs-maker.html\">extractor vs maker</a>.",
      after:
        "You save a public still YouTube already hosts. You do not unlock private videos, members-only files, or the MP4/WebM stream — see <a href=\"https://www.11tik.com/youtube-thumbnail-not-appearing-private\">why a thumbnail will not appear</a> when every size fails. 11tik is an extractor, not a maker and not a video downloader — comparison: <a href=\"https://www.11tik.com/thumbnail-extractor-vs-maker\">extractor vs maker</a>.",
    },
  ],
  "how-to-extract-thumbnails-from-youtube": [
    {
      before:
        "Line-by-line bulk details: <a href=\"https://www.11tik.com/how-to-batch-download-youtube\">batch download guide</a>. Single-URL flow: <a href=\"https://www.11tik.com/how-to-download-youtube-thumbnail\">how to download a YouTube thumbnail</a>.",
      after:
        "Line-by-line bulk details: <a href=\"https://www.11tik.com/how-to-batch-download-youtube\">batch download guide</a>. On a phone, see <a href=\"https://www.11tik.com/how-to-save-youtube-thumbnail-on-iphone\">save on iPhone and Android</a>. Single-URL flow: <a href=\"https://www.11tik.com/how-to-download-youtube-thumbnail\">how to download a YouTube thumbnail</a>.",
    },
  ],
};

/**
 * Rewrite legacy www article/utility hrefs inside a patch `before` anchor to clean paths.
 * Used so Ahrefs orphan-inlink enrichment still applies after Phase 57B source migration.
 */
export function migrateOrphanPatchAnchorHrefs(anchor) {
  return String(anchor || "")
    .replace(
      /https:\/\/www\.11tik\.com\/2026\/(?:\d{2}\/)?([a-z0-9-]+)\.html/gi,
      "https://www.11tik.com/$1",
    )
    .replace(/https:\/\/www\.11tik\.com\/p\/([a-z0-9-]+)\.html/gi, "https://www.11tik.com/$1");
}

/**
 * Idempotent Ahrefs File 23 inlink patches.
 * CASE A: legacy `before` present → replace with `after`
 * CASE A′: clean-migrated `before` present → replace with `after` (same final output)
 * CASE B: `after` already present → no-op
 * CASE C: neither → throw with patch identity
 */
export function applyEnglishOrphanInlinkPatches(html, contentId) {
  const patches = ENGLISH_ORPHAN_INLINK_PATCHES[contentId];
  if (!patches?.length) return html;
  let out = String(html || "");
  let patchIndex = 0;
  for (const patch of patches) {
    patchIndex += 1;
    const patchId = `${contentId}#${patchIndex}`;
    if (out.includes(patch.after)) continue;
    if (out.includes(patch.before)) {
      out = out.replace(patch.before, patch.after);
      continue;
    }
    const migratedBefore = migrateOrphanPatchAnchorHrefs(patch.before);
    if (migratedBefore !== patch.before && out.includes(migratedBefore)) {
      out = out.replace(migratedBefore, patch.after);
      continue;
    }
    throw new Error(
      [
        `English orphan inlink patch anchor missing for ${patchId}`,
        `expectedLegacyAnchor: ${JSON.stringify(patch.before)}`,
        `expectedMigratedAnchor: ${JSON.stringify(migratedBefore)}`,
        `expectedFinalAnchor: ${JSON.stringify(patch.after)}`,
        `sourceFile: scripts/i18n/render-english-static.mjs (ENGLISH_ORPHAN_INLINK_PATCHES)`,
      ].join("\n"),
    );
  }
  return out;
}

/** @returns {number} total patch definitions across all contentIds */
export function countEnglishOrphanInlinkPatches() {
  return Object.values(ENGLISH_ORPHAN_INLINK_PATCHES).reduce((n, list) => n + (list?.length || 0), 0);
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rewriteGithubAssets(html) {
  return String(html || "").split(GH_PAGES).join(EDGE_ASSETS);
}

/**
 * Prefer the content <article class="yte-page"> over any other article in a full Blogger dump.
 * Do not copy source <style> — Blogger theme CSS (max-width:none / 920px shells) must not win.
 * Strip nested JSON-LD + microdata so the page has one head schema (Ahrefs File 16).
 */
function extractArticleHtml(raw) {
  const preferred =
    /<article\b[^>]*class=["'][^"']*\byte-page\b[^"']*["'][^>]*>[\s\S]*?<\/article>/i.exec(raw) ||
    /<article\b[^>]*>[\s\S]*?<\/article>/i.exec(raw);
  if (!preferred) return "";
  return stripArticleStructuredDataNoise(rewriteGithubAssets(preferred[0]));
}

/** Remove body JSON-LD / microdata that duplicate the head @graph. */
export function stripArticleStructuredDataNoise(html) {
  return String(html || "")
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s+itemscope\b/gi, "")
    .replace(/\s+itemtype\s*=\s*(["'])[^"']*\1/gi, "")
    .replace(/\s+itemprop\s*=\s*(["'])[^"']*\1/gi, "");
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function buildSchema({ item, canonical, h1, description, hero, structured }) {
  const schemaType = item.type === "utility" ? "WebPage" : "Article";
  const cleanH1 = decodeEntities(h1);
  const cleanDesc = decodeEntities(description);
  const faqLd = (structured.faq || []).map((faq) => ({
    "@type": "Question",
    name: decodeEntities(faq.question),
    acceptedAnswer: {
      "@type": "Answer",
      text: decodeEntities(String(faq.answer || "").replace(/<[^>]+>/g, "")),
    },
  }));
  const primary = {
    "@type": schemaType,
    headline: cleanH1,
    name: cleanH1,
    description: cleanDesc,
    inLanguage: "en",
    mainEntityOfPage: canonical,
    author: { "@type": "Organization", name: "11tik", url: "https://www.11tik.com/about" },
    publisher: { "@type": "Organization", name: "11tik", url: "https://www.11tik.com/" },
    image: {
      "@type": "ImageObject",
      url: hero.src,
      width: Number(hero?.width) > 0 ? Number(hero.width) : 1200,
      height: Number(hero?.height) > 0 ? Number(hero.height) : 630,
    },
  };
  if (structured.datePublished) primary.datePublished = structured.datePublished;
  if (structured.dateModified || structured.datePublished) {
    primary.dateModified = structured.dateModified || structured.datePublished;
  }

  const graph = [primary];
  if (item.type === "article") {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.11tik.com/" },
        { "@type": "ListItem", position: 2, name: cleanH1, item: canonical },
      ],
    });
  }
  if (structured.howTo && typeof structured.howTo === "object") {
    const howTo = { ...structured.howTo };
    delete howTo["@context"];
    if (howTo.name) howTo.name = decodeEntities(howTo.name);
    graph.push(howTo);
  }
  if (faqLd.length) {
    graph.push({ "@type": "FAQPage", mainEntity: faqLd });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function buildFaviconLinks() {
  const { png16, png32, apple180 } = LOCALIZED_PAGE_ICONS;
  return [
    `<link rel="icon" type="image/png" sizes="32x32" href="${xmlEscape(png32)}"/>`,
    `<link rel="icon" type="image/png" sizes="16x16" href="${xmlEscape(png16)}"/>`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${xmlEscape(apple180)}"/>`,
  ].join("\n  ");
}

function resolveDescription(pathname, structured) {
  const mapped = fitDescription(descriptionForPath(pathname) || "");
  if (mapped.length >= 120) return mapped;
  return fitDescription(structured.description || structured.ogDescription || "");
}

function normalizeHeadingText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function resolveTitle(structured, h1, postTitle) {
  const fromPosts = String(postTitle || "").trim();
  let base = "";
  if (fromPosts) {
    base = fromPosts.includes("| 11tik") ? fromPosts : `${fromPosts} | 11tik`;
  } else {
    const raw = String(structured.title || "").trim();
    if (raw) {
      base = raw.includes("| 11tik") ? raw : `${raw.replace(/\s*\|\s*11tik\s*$/i, "")} | 11tik`;
    } else if (h1) {
      base = `${h1} | 11tik`;
    } else {
      base = "11tik";
    }
  }
  const title = fitTitle(base);
  const h1Norm = normalizeHeadingText(h1);
  let titleNorm = normalizeHeadingText(title.replace(/\s*\|\s*11tik\s*$/i, ""));
  if (h1Norm && titleNorm && h1Norm === titleNorm) {
    const withoutYear = h1.replace(/\s*\(20\d{2}\)\s*$/, "").trim();
    const brand = " | 11tik";
    const maxCore = 60 - brand.length;
    let core = withoutYear;
    if (core.length > maxCore) {
      core = `${core.slice(0, Math.max(1, maxCore - 1)).trim()}…`;
    }
    return `${core}${brand}`;
  }
  return title;
}

/** Global default social OG; study article uses its own hero PNG for og/twitter only. */
function resolveOgImage(_rawHtml, structured, contentId) {
  if (contentId === STUDY_CONTENT_ID) {
    const blogHero = (structured?.images || []).find((img) =>
      String(img.src || "").includes("sizes-resolutions-study-og"),
    );
    return blogHero?.src || STUDY_OG_IMAGE;
  }
  return DEFAULT_OG;
}

/**
 * @param {{ contentId: string, type: string, canonicalPath: string, canonicalUrl: string, sourceRel: string|null, title?: string }} item
 * @param {{ alternates?: { locale: string, url: string }[], postTitle?: string }} [options]
 */
export function renderEnglishStaticHtml(item, options = {}) {
  if (!item?.sourceRel) throw new Error(`Missing sourceRel for ${item?.contentId || "unknown"}`);
  const abs = join(ROOT, item.sourceRel);
  if (!existsSync(abs)) throw new Error(`Missing English source: ${item.sourceRel}`);
  const raw = readFileSync(abs, "utf8");
  const structured = extractStructuredSource(raw, { contentType: item.type === "utility" ? "utility" : "article" });
  const article = upgradeStaticImagesToPicture(
    clampImgAltsInHtml(
      ensureBodyHeroImg(
        applyContextualInternalLinks(
          applyEnglishUtilityContentPatches(
            applyEnglishOrphanInlinkPatches(extractArticleHtml(raw), item.contentId),
            item.contentId,
          ),
          item.contentId,
          item.canonicalPath,
        ),
        item,
        structured,
      ),
    ),
  );
  if (!article) throw new Error(`No <article> in source: ${item.sourceRel}`);
  const style = standardArticleStyleTag();

  const canonical = item.canonicalUrl;
  const h1 = structured.h1 || structured.title || item.contentId;
  const description = resolveDescription(item.canonicalPath, structured);
  const title = resolveTitle(structured, h1, options.postTitle);
  const ogTitle = options.postTitle || structured.ogTitle || h1;
  const ogDescription = fitDescription(description);
  const images = Array.isArray(structured.images) ? structured.images : [];
  const bodyHero =
    images.find((img) => /\/images\/(blog|posts)\//.test(String(img.src || ""))) ||
    images[0] ||
    { src: DEFAULT_OG, alt: structured.imageAlt || "" };
  const ogImageSrc = resolveOgImage(raw, structured, item.contentId);
  // Article JSON-LD: prefer in-article hero; OG meta stays on the default social image.
  const schemaImageSrc = bodyHero?.src || ogImageSrc;

  const alternates = Array.isArray(options.alternates) ? options.alternates : [{ locale: "en", url: canonical }];
  const schema = buildSchema({
    item,
    canonical,
    h1,
    description,
    hero: {
      src: schemaImageSrc,
      alt: bodyHero.alt || structured.imageAlt || "",
      width: bodyHero.width,
      height: bodyHero.height,
    },
    structured,
  });

  return protectEmailsInHtml(`<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${xmlEscape(title)}</title>
  <meta name="description" content="${xmlEscape(description)}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${xmlEscape(canonical)}"/>
  ${buildHreflangLinks({ englishUrl: canonical, alternates })}
  <meta property="og:type" content="${item.type === "utility" ? "website" : "article"}"/>
  <meta property="og:locale" content="en_US"/>
  <meta property="og:site_name" content="11tik"/>
  <meta property="og:title" content="${xmlEscape(ogTitle)}"/>
  <meta property="og:description" content="${xmlEscape(ogDescription)}"/>
  <meta property="og:url" content="${xmlEscape(canonical)}"/>
  <meta property="og:image" content="${xmlEscape(ogImageSrc)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${xmlEscape(ogTitle)}"/>
  <meta name="twitter:description" content="${xmlEscape(ogDescription)}"/>
  <meta name="twitter:image" content="${xmlEscape(ogImageSrc)}"/>
  ${buildFaviconLinks()}
  ${siteHeaderHeadTags()}
  ${style}
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
${siteHeaderBodyOpen({ locale: "en", contentPath: item.canonicalPath, variant: "static" })}
${article}
${options.crawlNavHtml ?? renderLocaleCrawlNavHtml("en", options.buildContext || {})}
${siteHeaderBodyClose()}
</body>
</html>
`);
}

export function englishStaticAssetRel(item) {
  if (item.assetRel) return item.assetRel;
  const contentId = item.contentId || String(item.canonicalPath || "").replace(/^\//, "").replace(/\.html$/i, "");
  if (!contentId || contentId.includes("..")) throw new Error(`Invalid content item for asset rel: ${item.canonicalPath}`);
  return `${contentId}.html`;
}
