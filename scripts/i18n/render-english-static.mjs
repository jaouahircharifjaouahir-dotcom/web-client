/**
 * English static pages for /2026/* and /p/* (repo-first, no Blogger runtime).
 * Phase A: /2026/* removed from run_worker_first; /p/* remains Worker-first until Phase C.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fitDescription, fitTitle } from "../../workers/html-meta.js";
import { protectEmailsInHtml } from "../../workers/email-obfuscation.js";
import { descriptionForPath } from "../../workers/post-descriptions.js";
import { extractStructuredSource } from "./extract-source.mjs";
import { LOCALIZED_PAGE_ICONS, buildHreflangLinks, standardArticleStyleTag } from "./render-localized.mjs";
import {
  siteHeaderBodyClose,
  siteHeaderBodyOpen,
  siteHeaderHeadTags,
} from "./site-header.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GH_PAGES = "https://jaouahircharifjaouahir-dotcom.github.io/web-client/";
const EDGE_ASSETS = "https://www.11tik.com/web-client/";
const DEFAULT_OG = "https://www.11tik.com/web-client/images/social/og-image-1200x630.png";

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
    author: { "@type": "Organization", name: "11tik", url: "https://www.11tik.com/p/about.html" },
    publisher: { "@type": "Organization", name: "11tik", url: "https://www.11tik.com/" },
    image: { "@type": "ImageObject", url: hero.src, width: 1200, height: 630 },
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

function resolveTitle(structured, h1, postTitle) {
  const fromPosts = String(postTitle || "").trim();
  if (fromPosts) {
    return fitTitle(fromPosts.includes("| 11tik") ? fromPosts : `${fromPosts} | 11tik`);
  }
  const raw = String(structured.title || "").trim();
  if (raw) {
    return fitTitle(raw.includes("| 11tik") ? raw : `${raw.replace(/\s*\|\s*11tik\s*$/i, "")} | 11tik`);
  }
  if (h1) return fitTitle(`${h1} | 11tik`);
  return fitTitle("11tik");
}

/** Prefer theme/default social OG (matches live Blogger) over in-article hero. */
function resolveOgImage(_rawHtml, _structured) {
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
  const article = extractArticleHtml(raw);
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
    images.find((img) => String(img.src || "").includes("/images/blog/")) ||
    images[0] ||
    { src: DEFAULT_OG, alt: structured.imageAlt || "" };
  const ogImageSrc = resolveOgImage(raw, structured);
  // Article JSON-LD: prefer in-article hero; OG meta stays on the default social image.
  const schemaImageSrc = bodyHero?.src || ogImageSrc;

  const alternates = Array.isArray(options.alternates) ? options.alternates : [{ locale: "en", url: canonical }];
  const schema = buildSchema({
    item,
    canonical,
    h1,
    description,
    hero: { src: schemaImageSrc, alt: bodyHero.alt || structured.imageAlt || "" },
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
${siteHeaderBodyClose()}
</body>
</html>
`);
}

export function englishStaticAssetRel(item) {
  const path = String(item.canonicalPath || "").replace(/^\//, "");
  if (!path || path.includes("..")) throw new Error(`Invalid canonicalPath: ${item.canonicalPath}`);
  return path;
}
