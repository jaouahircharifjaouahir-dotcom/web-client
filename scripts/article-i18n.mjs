import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RTL_CODES } from "../workers/iso6391.js";
import { normalizeTrustedLocaleSitemapLoc } from "../workers/sitemap-canonicals.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Stable article id = public slug (matches posts.ts / live URL). */
export const SHARE_LINKS_ARTICLE_ID = "11tik-share-links-thumb-vs-youtube";

export const SHARE_LINKS_EN_HREF =
  "https://www.11tik.com/2026/08/11tik-share-links-thumb-vs-youtube.html";

export const SHARE_LINKS_EN_SOURCE_REL =
  "docs/blogger-pages/blog/11tik-share-links-thumb-vs-watch.html";

export function articleDir(articleId) {
  return join(ROOT, "content", "articles", articleId);
}

export function normalizeArticleSource(raw) {
  return `${String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()}\n`;
}

export function hashArticleSource(raw) {
  return createHash("sha256").update(normalizeArticleSource(raw), "utf8").digest("hex");
}

export function readEnglishSourceHash(articleId = SHARE_LINKS_ARTICLE_ID) {
  if (articleId !== SHARE_LINKS_ARTICLE_ID) {
    throw new Error(`POC only supports articleId=${SHARE_LINKS_ARTICLE_ID}`);
  }
  const path = join(ROOT, SHARE_LINKS_EN_SOURCE_REL);
  return hashArticleSource(readFileSync(path, "utf8"));
}

export function loadLocaleArtifact(articleId, locale) {
  const path = join(articleDir(articleId), `${locale}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Ready for publish when status is ready and sourceHash matches current English.
 */
export function resolveLocalePublishState(articleId, locale, currentSourceHash) {
  const artifact = loadLocaleArtifact(articleId, locale);
  if (!artifact) {
    return { publishable: false, reason: "missing", artifact: null };
  }
  if (artifact.articleId !== articleId) {
    return { publishable: false, reason: "articleId-mismatch", artifact };
  }
  if (artifact.locale !== locale) {
    return { publishable: false, reason: "locale-mismatch", artifact };
  }
  if (artifact.status !== "ready") {
    return { publishable: false, reason: "not-ready", artifact };
  }
  if (!artifact.sourceHash || artifact.sourceHash !== currentSourceHash) {
    return { publishable: false, reason: "stale", artifact };
  }
  return { publishable: true, reason: "ready", artifact };
}

export function localeArticlePublicUrl(articleId, locale) {
  if (locale === "en") return SHARE_LINKS_EN_HREF;
  return `https://${locale}.11tik.com/l/${locale}/2026/08/${articleId}.html`;
}

export function localeArticleAssetRelPath(articleId, locale) {
  return join("l", locale, "2026", "08", `${articleId}.html`);
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function articleHreflangLinks(articleId) {
  const en = SHARE_LINKS_EN_HREF;
  const fr = localeArticlePublicUrl(articleId, "fr");
  return [
    `<link rel="alternate" hreflang="en" href="${en}"/>`,
    `<link rel="alternate" hreflang="fr" href="${fr}"/>`,
    `<link rel="alternate" hreflang="x-default" href="${en}"/>`,
  ].join("\n  ");
}

/**
 * POC redirect helper: returns destination or null.
 * Pure function for tests (no DOM).
 */
export function shouldRedirectEnArticleToFr({
  pathname,
  savedLang,
  sessionRedirected,
  browserLanguages,
  frenchPublishable,
}) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  if (path !== "/2026/08/11tik-share-links-thumb-vs-youtube.html") return null;
  if (!frenchPublishable) return null;
  if (savedLang) return null;
  if (sessionRedirected) return null;
  const langs = Array.isArray(browserLanguages) ? browserLanguages : [];
  const prefersFr = langs.some((lang) => /^fr\b/i.test(String(lang || "")));
  if (!prefersFr) return null;
  return localeArticlePublicUrl(SHARE_LINKS_ARTICLE_ID, "fr");
}

export function renderLocalizedArticleHtml(artifact) {
  const dir = RTL_CODES.has(artifact.locale) ? "rtl" : "ltr";
  const canonical = localeArticlePublicUrl(artifact.articleId, artifact.locale);
  const title = xmlEscape(artifact.title);
  const description = xmlEscape(artifact.description);
  const ogTitle = xmlEscape(artifact.ogTitle || artifact.title);
  const ogDescription = xmlEscape(artifact.ogDescription || artifact.description);
  const hero =
    artifact.images?.[0] || {
      src: "https://www.11tik.com/web-client/images/blog/11tik-share-link-three-url-comparison.png",
      alt: artifact.imageAlt || "",
    };
  const sectionsHtml = (artifact.sections || [])
    .map((section) => {
      const heading = section.heading ? `<h2>${xmlEscape(section.heading)}</h2>` : "";
      return `${heading}\n${section.html || ""}`;
    })
    .join("\n");
  const faqHtml = (artifact.faq || [])
    .map(
      (item) =>
        `<h3>${xmlEscape(item.question)}</h3>\n<p>${item.answerHtml || xmlEscape(item.answer || "")}</p>`,
    )
    .join("\n");
  const faqLd = (artifact.faq || []).map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: String(item.answer || "").replace(/<[^>]+>/g, ""),
    },
  }));
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: artifact.h1,
        description: artifact.description,
        datePublished: "2026-08-23",
        dateModified: "2026-08-23",
        inLanguage: artifact.locale,
        mainEntityOfPage: canonical,
        author: { "@type": "Organization", name: "11tik", url: "https://www.11tik.com/p/about.html" },
        publisher: { "@type": "Organization", name: "11tik", url: "https://www.11tik.com/" },
        image: {
          "@type": "ImageObject",
          url: hero.src,
          width: 1200,
          height: 630,
        },
      },
      { "@type": "FAQPage", mainEntity: faqLd },
    ],
  };

  return `<!DOCTYPE html>
<html lang="${xmlEscape(artifact.locale)}" dir="${dir}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <meta name="description" content="${description}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${canonical}"/>
  ${articleHreflangLinks(artifact.articleId)}
  <meta property="og:type" content="article"/>
  <meta property="og:locale" content="fr_FR"/>
  <meta property="og:site_name" content="11tik"/>
  <meta property="og:title" content="${ogTitle}"/>
  <meta property="og:description" content="${ogDescription}"/>
  <meta property="og:url" content="${canonical}"/>
  <meta property="og:image" content="${xmlEscape(hero.src)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${ogTitle}"/>
  <meta name="twitter:description" content="${ogDescription}"/>
  <meta name="twitter:image" content="${xmlEscape(hero.src)}"/>
  <link rel="icon" type="image/png" sizes="32x32" href="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj3ow8HyWy9yRQFsg4KZb6tJUZwxmUUEuEBv5FzGZMbQrZ9wzK7tCB5GfEPlvGu4fTNSqAPeke2IJdpwubgUfq7XdryvcebCtYraxd6l2vUDo8hG3RimtLewbO1R4TB1_WehF-PziUil11Sb_rPJZ1YqlS5ikOWvartEdOCVK6s8SsmZaT-qK-HlzzAtG1n/s32/favicon-2.png"/>
  <style>
.yte-page{max-width:720px;margin:32px auto 64px;padding:0 20px;font-family:system-ui,Segoe UI,sans-serif;color:#17141c;line-height:1.65}
.yte-page h1{font-size:2rem;line-height:1.15;margin:0 0 12px}
.yte-page h2{font-size:1.2rem;margin:28px 0 8px}
.yte-page h3{font-size:1.05rem;margin:18px 0 6px}
.yte-page p,.yte-page li,.yte-page td,.yte-page th{color:#5c5666}
.yte-page a{color:#c2410c}
.yte-byline,.yte-updated,.yte-caption{font-size:14px;color:#5c5666;margin:0 0 8px}
.yte-hero{display:block;width:100%;max-width:1200px;height:auto;margin:12px 0 8px;border-radius:12px}
.yte-bio{margin-top:36px;padding-top:16px;border-top:1px solid #d9d3dc;font-size:14px;color:#5c5666}
.yte-page table{width:100%;border-collapse:collapse;margin:16px 0 20px;font-size:15px}
.yte-page th,.yte-page td{border:1px solid #d9d3dc;padding:10px 12px;text-align:left;vertical-align:top}
.yte-page th{background:#f6f1ea;color:#17141c;font-weight:700}
.yte-page code{font-size:0.92em;background:#f6f1ea;padding:0.1em 0.35em;border-radius:4px}
.yte-page pre{background:#17141c;color:#f6f1ea;padding:14px;border-radius:12px;overflow:auto;font-size:13px;line-height:1.45}
.yte-page ol,.yte-page ul{padding-left:1.25rem}
  </style>
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<article class="yte-page" itemscope itemtype="https://schema.org/Article">
  <h1 itemprop="headline">${xmlEscape(artifact.h1)}</h1>
  <p class="yte-byline">Par <a href="https://www.11tik.com/p/about.html" itemprop="author">11tik</a></p>
  <p class="yte-updated"><time datetime="2026-08-23" itemprop="datePublished">Publié le 23 août 2026</time> · <time datetime="2026-08-23" itemprop="dateModified">Mis à jour le 23 août 2026</time></p>
  <p itemprop="description">${description}</p>
  ${sectionsHtml}
  <h2>${xmlEscape(artifact.faqHeading || "FAQ")}</h2>
  ${faqHtml}
  ${artifact.conclusionHtml || ""}
  <p class="yte-bio">${artifact.bioHtml || ""}</p>
</article>
</body>
</html>
`;
}

/**
 * Collect publishable POC locale article URLs for sitemap (fr only today).
 */
export function collectPublishableLocaleArticleLocs(currentSourceHash) {
  const state = resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "fr", currentSourceHash);
  if (!state.publishable) return [];
  const loc = normalizeTrustedLocaleSitemapLoc(localeArticlePublicUrl(SHARE_LINKS_ARTICLE_ID, "fr"));
  return loc ? [loc] : [];
}

/** Write ready locale article HTML into staged assets. Returns list of written public locs. */
export function writePublishableLocaleArticles(writeFile, staged, currentSourceHash) {
  const writtenLocs = [];
  const state = resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "fr", currentSourceHash);
  if (!state.publishable) return writtenLocs;
  const rel = localeArticleAssetRelPath(SHARE_LINKS_ARTICLE_ID, "fr");
  writeFile(join(staged, rel), renderLocalizedArticleHtml(state.artifact));
  writtenLocs.push(localeArticlePublicUrl(SHARE_LINKS_ARTICLE_ID, "fr"));
  return writtenLocs;
}

export const POC_FR_MANIFEST_REL = join("web-client", "i18n", "poc-share-links-fr.json");

export const BLOGGER_POC_BEGIN = "<!-- YTE-POC-SHARE-LINKS-I18N:BEGIN -->";
export const BLOGGER_POC_END = "<!-- YTE-POC-SHARE-LINKS-I18N:END -->";

export function buildPocFrReadinessManifest(publishable, currentSourceHash) {
  if (!publishable) {
    return {
      articleId: SHARE_LINKS_ARTICLE_ID,
      locale: "fr",
      ready: false,
      sourceHash: currentSourceHash,
      url: null,
    };
  }
  return {
    articleId: SHARE_LINKS_ARTICLE_ID,
    locale: "fr",
    ready: true,
    sourceHash: currentSourceHash,
    url: localeArticlePublicUrl(SHARE_LINKS_ARTICLE_ID, "fr"),
  };
}

export function writePocFrReadinessManifest(writeFile, staged, publishable, currentSourceHash) {
  writeFile(
    join(staged, POC_FR_MANIFEST_REL),
    `${JSON.stringify(buildPocFrReadinessManifest(publishable, currentSourceHash), null, 2)}\n`,
  );
}

/** Map a trusted locale article sitemap loc to a path under dist-assets. */
export function localeArticleLocToAssetRel(loc) {
  const normalized = normalizeTrustedLocaleSitemapLoc(loc);
  if (!normalized) return null;
  const url = new URL(normalized);
  // /l/fr/2026/08/slug.html → l/fr/2026/08/slug.html
  return url.pathname.replace(/^\//, "");
}

/**
 * Every locale article sitemap loc must map to an existing generated HTML file.
 */
export function assertLocaleSitemapLocsHaveFiles(staged, locs) {
  const missing = [];
  for (const loc of locs) {
    const rel = localeArticleLocToAssetRel(loc);
    if (!rel || !existsSync(join(staged, rel))) missing.push(loc);
  }
  if (missing.length) {
    throw new Error(`Locale sitemap locs without generated files: ${missing.join(", ")}`);
  }
}

function genericArticleHreflangXml() {
  return `        <link href='https://www.11tik.com/' hreflang='en' rel='alternate'/>
        <link href='https://fr.11tik.com/' hreflang='fr' rel='alternate'/>
        <link href='https://es.11tik.com/' hreflang='es' rel='alternate'/>
        <link href='https://www.11tik.com/' hreflang='x-default' rel='alternate'/>`;
}

function readyPocArticleHreflangAndRedirectXml() {
  const fr = localeArticlePublicUrl(SHARE_LINKS_ARTICLE_ID, "fr");
  const en = SHARE_LINKS_EN_HREF;
  return `      <b:if cond='data:view.url contains "11tik-share-links-thumb-vs-youtube"'>
        <link href='${en}' hreflang='en' rel='alternate'/>
        <link href='${fr}' hreflang='fr' rel='alternate'/>
        <link href='${en}' hreflang='x-default' rel='alternate'/>
        <script type='text/javascript'>
(function () {
  try {
    var path = location.pathname.replace(/\\/+$/, '') || '/';
    if (path !== '/2026/08/11tik-share-links-thumb-vs-youtube.html') return;
    if (localStorage.getItem('yte-lang')) return;
    if (sessionStorage.getItem('yte-poc-share-links-fr-redir')) return;
    if (/Googlebot|Google-InspectionTool|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot/i.test(navigator.userAgent || '')) return;
    var langs = navigator.languages || (navigator.language ? [navigator.language] : []);
    var preferFr = false;
    for (var i = 0; i &lt; langs.length; i++) {
      if (/^fr\\b/i.test(String(langs[i] || ''))) { preferFr = true; break; }
    }
    if (!preferFr) return;
    sessionStorage.setItem('yte-poc-share-links-fr-redir', '1');
    fetch('https://www.11tik.com/web-client/i18n/poc-share-links-fr.json', { credentials: 'omit', cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : { ready: false }; })
      .then(function (meta) {
        if (!meta || meta.ready !== true || !meta.url) return;
        localStorage.setItem('yte-lang', 'fr');
        location.replace(String(meta.url));
      })
      .catch(function () {});
  } catch (e) {}
})();
        </script>
      <b:else/>
${genericArticleHreflangXml()}
      </b:if>`;
}

/**
 * Build the Blogger POC theme fragment (between markers).
 * When FR is not publishable: no article-specific FR hreflang and no redirect.
 */
export function buildBloggerPocThemeFragment(frenchPublishable) {
  const inner = frenchPublishable ? readyPocArticleHreflangAndRedirectXml() : genericArticleHreflangXml();
  return `${BLOGGER_POC_BEGIN}
${inner}
      ${BLOGGER_POC_END}`;
}

export function applyBloggerPocTheme(themeXml, frenchPublishable) {
  const fragment = buildBloggerPocThemeFragment(frenchPublishable);
  const start = themeXml.indexOf(BLOGGER_POC_BEGIN);
  const end = themeXml.indexOf(BLOGGER_POC_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Blogger theme missing YTE-POC-SHARE-LINKS-I18N markers");
  }
  return themeXml.slice(0, start) + fragment + themeXml.slice(end + BLOGGER_POC_END.length);
}

export function syncBloggerThemePoc(themePath, frenchPublishable) {
  const current = readFileSync(themePath, "utf8");
  const next = applyBloggerPocTheme(current, frenchPublishable);
  if (next !== current) {
    writeFileSync(themePath, next);
  }
  return next;
}

