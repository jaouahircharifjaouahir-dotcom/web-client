import { RTL_CODES } from "../../workers/iso6391.js";
import { protectEmailsInHtml } from "../../workers/email-obfuscation.js";
import { clampImgAltsInHtml, fitAlt, fitDescription, fitTitle, toHttpsUrl } from "../../workers/html-meta.js";
import { localizeInternalLinksInHtml } from "./internal-links.mjs";
import { renderContextualLinksNav, CONTEXTUAL_LINK_PLAN } from "./contextual-internal-links.mjs";
import { renderLocaleCrawlNavHtml } from "./locale-crawl-nav.mjs";
import {
  localeHomeUrl,
  siteHeaderBodyClose,
  siteHeaderBodyOpen,
  siteHeaderHeadTags,
} from "./site-header.mjs";
import { upgradeStaticImagesToPicture } from "./image-delivery.mjs";
import { SITE_ICONS } from "./site-icons.mjs";

/** Shared article column CSS — English static + localized pages. */
export const STANDARD_ARTICLE_PAGE_CSS = `.yte-page{max-width:720px;margin:32px auto 64px;padding:0 20px;font-family:system-ui,Segoe UI,sans-serif;color:#17141c;line-height:1.65}
.yte-page h1{font-size:2rem;line-height:1.15;margin:0 0 12px}
.yte-page h2{font-size:1.2rem;margin:28px 0 8px}
.yte-page h3{font-size:1.05rem;margin:18px 0 6px}
.yte-page p,.yte-page li,.yte-page td,.yte-page th{color:#5c5666}
.yte-page a{color:#c2410c}
.yte-byline,.yte-updated,.yte-caption{font-size:14px;color:#5c5666;margin:0 0 8px}
.yte-hero{display:block;width:100%;max-width:100%;height:auto;margin:12px 0 8px;border-radius:12px}
.yte-bio{margin-top:36px;padding-top:16px;border-top:1px solid #d9d3dc;font-size:14px;color:#5c5666}
.yte-page table{width:100%;border-collapse:collapse;margin:16px 0 20px;font-size:15px}
.yte-page th,.yte-page td{border:1px solid #d9d3dc;padding:10px 12px;text-align:left;vertical-align:top}
.yte-page th{background:#f6f1ea;color:#17141c;font-weight:700}
.yte-page code{font-size:0.92em;background:#f6f1ea;padding:0.1em 0.35em;border-radius:4px}
.yte-page pre{background:#17141c;color:#f6f1ea;padding:14px;border-radius:12px;overflow:auto;font-size:13px;line-height:1.45}
.yte-page ol,.yte-page ul{padding-left:1.25rem}
.yte-page nav,.yte-crawl-nav{margin-top:28px}
.yte-crawl-nav ul{padding-left:1.25rem;margin:12px 0 0}
.yte-shell-guides ul{padding-left:1.25rem;margin:16px 0 0}
.yte-shell-guides a{color:#c2410c;font-weight:600}
.yte-form-grid{display:grid;gap:14px;margin:24px 0 8px}
.yte-form-grid label{display:grid;gap:6px;font-weight:600;color:#17141c}
.yte-form-grid input,.yte-form-grid textarea{width:100%;box-sizing:border-box;border:1px solid #d9d3dc;border-radius:16px;padding:12px 14px;font:inherit;color:#17141c;background:#fff}
.yte-form-grid textarea{min-height:140px;resize:vertical}
.yte-form-grid button{border:0;border-radius:999px;padding:12px 18px;cursor:pointer;font-weight:700;background:#17141c;color:#fff;justify-self:start}
.yte-hp{position:absolute;left:-9999px;height:0;width:0;overflow:hidden}`;

export function standardArticleStyleTag() {
  return `<style>\n${STANDARD_ARTICLE_PAGE_CSS}\n</style>`;
}

/** Canonical self-hosted favicons (same assets as English SPA). */
export const LOCALIZED_PAGE_ICONS = { ...SITE_ICONS };

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function attrEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeHeadingText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Page templates already emit one document <h1>. Utility/article section HTML often
 * still includes the source <h1> (and extract may repeat it as an <h2> heading).
 * Strip duplicates; demote any other nested H1 to H2 so Ahrefs sees a single H1.
 */
export function stripNestedDocumentH1(html, pageH1) {
  const pageNorm = normalizeHeadingText(pageH1);
  return String(html || "")
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_, inner) => {
      const text = normalizeHeadingText(inner);
      if (!text || (pageNorm && text === pageNorm)) return "";
      return `<h2>${inner}</h2>`;
    })
    .replace(/^\s+|\s+$/g, "");
}

function headingsMatch(a, b) {
  const left = normalizeHeadingText(a);
  const right = normalizeHeadingText(b);
  return Boolean(left && right && left === right);
}

/**
 * Replace img alt (and optional title) from artifact.images matched by src.
 * Preserves intentional empty alt. Does not change src/srcset/dimensions/classes.
 */
export function applyLocalizedImageMetadata(html, images = []) {
  const list = Array.isArray(images) ? images : [];
  if (!String(html || "") || !list.length) return html;
  const bySrc = new Map();
  for (const img of list) {
    const src = String(img?.src || "").trim();
    if (!src) continue;
    bySrc.set(src, img);
  }
  if (!bySrc.size) return html;

  return String(html).replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const srcMatch = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(attrs);
    if (!srcMatch) return full;
    const src = srcMatch[2];
    const meta = bySrc.get(src);
    if (!meta) return full;

    let next = attrs;
    const hasAlt = /\balt\s*=/i.test(next);
    const localizedAlt = meta.alt != null ? fitAlt(String(meta.alt)) : null;

    if (localizedAlt !== null) {
      if (hasAlt) {
        next = next.replace(/\balt\s*=\s*(["'])[\s\S]*?\1/i, `alt="${attrEscape(localizedAlt)}"`);
      } else if (localizedAlt !== "") {
        next = `${next} alt="${attrEscape(localizedAlt)}"`;
      }
    }

    if (meta.title != null && String(meta.title).length) {
      if (/\btitle\s*=/i.test(next)) {
        next = next.replace(/\btitle\s*=\s*(["'])[\s\S]*?\1/i, `title="${attrEscape(meta.title)}"`);
      } else {
        next = `${next} title="${attrEscape(meta.title)}"`;
      }
    }

    return `<img${next}>`;
  });
}

/** Apply images[].alt into HTML fields of an artifact (no network / no GTX). */
export function syncLocalizedImageAltsIntoArtifact(artifact) {
  if (!artifact || typeof artifact !== "object") return artifact;
  const images = Array.isArray(artifact.images) ? artifact.images : [];
  if (!images.length) return artifact;
  const apply = (html) => applyLocalizedImageMetadata(html, images);
  return {
    ...artifact,
    sections: Array.isArray(artifact.sections)
      ? artifact.sections.map((section) =>
          section && typeof section === "object"
            ? { ...section, html: apply(section.html || "") }
            : section,
        )
      : artifact.sections,
    conclusionHtml: apply(artifact.conclusionHtml || ""),
    bioHtml: artifact.bioHtml != null ? apply(artifact.bioHtml) : artifact.bioHtml,
  };
}

/** Shared by localized and English shadow static renderers. */
export function buildHreflangLinks({ englishUrl, alternates }) {
  const lines = [
    `<link rel="alternate" hreflang="en" href="${xmlEscape(englishUrl)}"/>`,
    `<link rel="alternate" hreflang="x-default" href="${xmlEscape(englishUrl)}"/>`,
  ];
  for (const { locale, url } of alternates) {
    if (locale === "en") continue;
    lines.push(`<link rel="alternate" hreflang="${xmlEscape(locale)}" href="${xmlEscape(url)}"/>`);
  }
  return lines.join("\n  ");
}

function buildFaviconLinks() {
  const { png16, png32, apple180 } = LOCALIZED_PAGE_ICONS;
  return [
    `<link rel="icon" type="image/png" sizes="32x32" href="${xmlEscape(png32)}"/>`,
    `<link rel="icon" type="image/png" sizes="16x16" href="${xmlEscape(png16)}"/>`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${xmlEscape(apple180)}"/>`,
  ].join("\n  ");
}

/**
 * Generic localized page renderer for article/utility artifacts.
 */
export function renderLocalizedHtml(item, artifact, { alternates = [], pathLinkIndex = null, buildContext = null, crawlNavHtml = null } = {}) {
  const locale = artifact.locale;
  const dir = RTL_CODES.has(locale) ? "rtl" : "ltr";
  const canonical = alternates.find((a) => a.locale === locale)?.url;
  if (!canonical) throw new Error("missing self alternate for render");
  const images = Array.isArray(artifact.images) ? artifact.images : [];
  const localize = (html) => {
    const withAlts = clampImgAltsInHtml(applyLocalizedImageMetadata(html, images));
    const linked = pathLinkIndex ? localizeInternalLinksInHtml(withAlts, locale, pathLinkIndex) : withAlts;
    return upgradeStaticImagesToPicture(linked);
  };
  const title = xmlEscape(fitTitle(artifact.title));
  const description = xmlEscape(fitDescription(artifact.description));
  const ogTitle = xmlEscape(fitTitle(artifact.ogTitle || artifact.title));
  const ogDescription = xmlEscape(fitDescription(artifact.ogDescription || artifact.description));
  const canonHref = xmlEscape(toHttpsUrl(canonical));
  const hero =
    images[0] || {
      src: "https://www.11tik.com/web-client/images/social/og-image-1200x630.png",
      alt: artifact.imageAlt || "",
    };
  const pageH1 = artifact.h1 || "";
  const sectionsHtml = (artifact.sections || [])
    .map((section) => {
      const skipHeading = !section.heading || headingsMatch(section.heading, pageH1);
      const heading = skipHeading ? "" : `<h2>${xmlEscape(section.heading)}</h2>`;
      const body = stripNestedDocumentH1(localize(section.html || ""), pageH1);
      return [heading, body].filter(Boolean).join("\n");
    })
    .join("\n");
  const faqHtml = (artifact.faq || [])
    .map(
      (faq) =>
        `<h3>${xmlEscape(faq.question)}</h3>\n<p>${localize(faq.answerHtml || xmlEscape(faq.answer || ""))}</p>`,
    )
    .join("\n");
  const schemaType = item.type === "utility" ? "WebPage" : "Article";
  const faqLd = (artifact.faq || []).map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: String(faq.answer || "").replace(/<[^>]+>/g, ""),
    },
  }));
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": schemaType,
        headline: artifact.h1,
        name: artifact.h1,
        description: artifact.description,
        inLanguage: locale,
        mainEntityOfPage: toHttpsUrl(canonical),
        author: { "@type": "Organization", name: "11tik", url: "https://www.11tik.com/p/about.html" },
        publisher: { "@type": "Organization", name: "11tik", url: "https://www.11tik.com/" },
        image: { "@type": "ImageObject", url: hero.src, width: 1200, height: 630 },
      },
      ...(faqLd.length ? [{ "@type": "FAQPage", mainEntity: faqLd }] : []),
    ],
  };
  const conclusionHtml = stripNestedDocumentH1(localize(artifact.conclusionHtml || ""), pageH1);
  const bioInner = artifact.bioHtml
    ? stripNestedDocumentH1(localize(artifact.bioHtml), pageH1)
    : "";
  const contextualNavHtml =
    CONTEXTUAL_LINK_PLAN[item.contentId]
      ? localize(renderContextualLinksNav(item.contentId, item.canonicalPath))
      : "";

  return protectEmailsInHtml(`<!DOCTYPE html>
<html lang="${xmlEscape(locale)}" dir="${dir}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <meta name="description" content="${description}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${canonHref}"/>
  ${buildHreflangLinks({ englishUrl: item.canonicalUrl, alternates })}
  <meta property="og:type" content="${item.type === "utility" ? "website" : "article"}"/>
  <meta property="og:locale" content="${xmlEscape(`${locale}_${locale.toUpperCase()}`)}"/>
  <meta property="og:site_name" content="11tik"/>
  <meta property="og:title" content="${ogTitle}"/>
  <meta property="og:description" content="${ogDescription}"/>
  <meta property="og:url" content="${canonHref}"/>
  <meta property="og:image" content="${xmlEscape(hero.src)}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${ogTitle}"/>
  <meta name="twitter:description" content="${ogDescription}"/>
  <meta name="twitter:image" content="${xmlEscape(hero.src)}"/>
  ${buildFaviconLinks()}
  ${siteHeaderHeadTags()}
  ${standardArticleStyleTag()}
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
${siteHeaderBodyOpen({
    locale,
    homeUrl: localeHomeUrl(locale),
    contentPath: item.canonicalPath,
    variant: "static",
  })}
<article class="yte-page" itemscope itemtype="https://schema.org/${schemaType}">
  <h1 itemprop="headline name">${xmlEscape(artifact.h1)}</h1>
  <p itemprop="description">${description}</p>
  ${sectionsHtml}
  ${faqHtml ? `<h2>${xmlEscape(artifact.faqHeading || "FAQ")}</h2>\n${faqHtml}` : ""}
  ${conclusionHtml}
  ${bioInner ? `<p class="yte-bio">${bioInner}</p>` : ""}
  ${contextualNavHtml}
  ${crawlNavHtml ?? renderLocaleCrawlNavHtml(locale, {
    ...(buildContext || {}),
    catalogDoc: buildContext?.catalogByLocale?.[locale],
  })}
</article>
${siteHeaderBodyClose()}
</body>
</html>
`);
}
