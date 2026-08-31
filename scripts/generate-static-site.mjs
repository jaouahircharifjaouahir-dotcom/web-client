import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { aiSearchAllowRobotsBlock, aiTrainingRobotsBlock } from "../workers/ai-training-robots.js";
import { ISO6391, RTL_CODES, hreflangLinks } from "../workers/iso6391.js";
import { fitDescription, fitTitle, toHttpsUrl } from "../workers/html-meta.js";
import localeMeta from "../workers/locale-meta.json" with { type: "json" };
import uiCatalog from "../src/i18n/catalog.json" with { type: "json" };
import {
  buildSitemapXml,
  collectCanonicalSitemapLocs,
  collectLocaleHomeSitemapLocs,
  loadGuidePostHrefsFromFile,
  normalizeTrustedLocaleSitemapLoc,
} from "../workers/sitemap-canonicals.js";
import {
  collectPublishableLocaleArticleLocs,
  writePublishableLocaleArticles,
  writePocFrReadinessManifest,
  assertLocaleSitemapLocsHaveFiles,
} from "./article-i18n.mjs";
import {
  assertEnglishStaticCoverage,
  writeEnglishStaticPages,
} from "./i18n/write-english-static.mjs";
import { writeLocaleCatalogs } from "./i18n/write-locale-catalogs.mjs";
import { buildHtmlExtensionRedirects } from "./html-extension-redirects.mjs";
import { writeCopyrightStaticPage } from "./write-copyright-static.mjs";
import { ahrefsAnalyticsHeadTag } from "./i18n/ahrefs-analytics.mjs";
import { indexNowKeyBody, indexNowKeyFilename } from "./i18n/indexnow-key.mjs";
import {
  localeHomeUrl as headerLocaleHomeUrl,
  renderSiteHeaderHtml,
  siteHeaderScriptTag,
  siteHeaderStyleTag,
  siteHeaderThemeBootScript,
} from "./i18n/site-header.mjs";
import {
  renderLocaleCrawlNavHtml,
  renderShellGuideListHtml,
} from "./i18n/locale-crawl-nav.mjs";
import { scanPublishability } from "./i18n/publish.mjs";
import { buildContentInventory } from "./i18n/content-inventory.mjs";
import { writePostsFeeds } from "../workers/feed-generation.js";
import { buildLocaleCatalogDoc } from "./i18n/write-locale-catalogs.mjs";
import { getTargetLocales } from "./i18n/target-languages.mjs";
import { SITE_ICONS } from "./i18n/site-icons.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_TS = join(ROOT, "src", "content", "posts.ts");

const SITE = "https://www.11tik.com";
const APP_ASSET_V = "57";
const OG_IMAGE = `${SITE}/web-client/images/social/og-image-1200x630.png`;
const ICON_32 = SITE_ICONS.png32;
const ICON_16 = SITE_ICONS.png16;
const ICON_APPLE = SITE_ICONS.apple180;

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function localeRecord(code) {
  const meta = localeMeta[code] || localeMeta.en;
  return {
    code,
    dir: RTL_CODES.has(code) ? "rtl" : meta.dir || "ltr",
    locale: `${code}_${code.toUpperCase()}`,
    title: meta.title || localeMeta.en.title,
    // Ahrefs File 12/19: keep meta descriptions in the 120–150 band.
    description: fitDescription(meta.description || localeMeta.en.description),
  };
}

function catalogUi(code) {
  const entry = uiCatalog[code] || uiCatalog.en;
  const ui = entry?.ui || uiCatalog.en.ui;
  const posts = Array.isArray(entry?.posts) ? entry.posts : uiCatalog.en.posts || [];
  return { ui, posts };
}

/**
 * Crawlable body for SPA shells (Ahrefs counts content words without JS render).
 * React replaces #yte-root on hydrate; users still see the live app.
 */
function spaShellBodyHtml(code, buildContext) {
  const copy = localeRecord(code);
  const { ui } = catalogUi(code);
  const title = xmlEscape(ui.heroTitle || copy.title);
  const intro = xmlEscape(ui.heroIntro || copy.description);
  const foot = xmlEscape(ui.foot || "");
  const step1 = xmlEscape(ui.pasteOne || "");
  const step2 = xmlEscape(ui.getThumb || "");
  const step3 = xmlEscape(ui.download || "");
  const extraParas = [
    ui.pasteBulk,
    ui.extractAll,
    ui.copyShare,
    ui.share,
    ui.ready,
    ui.shareLink,
    ui.thumbnailsKicker,
    ui.kicker,
    ui.pasteOnePh,
    ui.openFull,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .map((s) => `<p>${xmlEscape(s)}</p>`)
    .join("");
  const catalogDoc = buildContext?.catalogByLocale?.[code];
  const guides = renderShellGuideListHtml(code, { ...buildContext, catalogDoc });
  const crawlNav = renderLocaleCrawlNavHtml(code, { ...buildContext, catalogDoc });
  // Space-poor scripts (e.g. Japanese) yield low whitespace word counts; add English
  // product copy so Ahrefs content-word floor is met without inventing fake locale text.
  let enBridge = "";
  if (code !== "en") {
    const enUi = uiCatalog.en?.ui || {};
    const draft = `<h1>${title}</h1><p>${intro}</p><ol><li>${step1}</li><li>${step2}</li><li>${step3}</li></ol>${extraParas}<p>${foot}</p>${guides}`;
    const approx = draft
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean).length;
    if (approx < 100 && enUi.heroIntro) {
      enBridge = `<p lang="en">${xmlEscape(enUi.heroIntro)}</p><p lang="en">${xmlEscape(enUi.foot || "")}</p>`;
    }
  }
  return `<div id="yte-root"><h1>${title}</h1><p>${intro}</p><ol><li>${step1}</li><li>${step2}</li><li>${step3}</li></ol>${extraParas}<p>${foot}</p>${guides}${crawlNav}${enBridge}</div>`;
}

function canonicalFor(code) {
  return code === "en" ? `${SITE}/` : `https://${code}.11tik.com/l/${code}/`;
}

function appShellHtml({ code, canonical, title, description, robots = "index,follow", buildContext = null }) {
  const copy = localeRecord(code);
  const headTitle = xmlEscape(fitTitle(title || copy.title));
  const headDesc = xmlEscape(fitDescription(description || copy.description));
  const canon = xmlEscape(toHttpsUrl(canonical));
  const css = `/web-client/blogger-app.css?v=${APP_ASSET_V}`;
  const js = `/web-client/blogger-app.js?v=${APP_ASSET_V}`;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: fitTitle(copy.title),
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    url: toHttpsUrl(canonical),
    image: OG_IMAGE,
    description: fitDescription(copy.description),
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  });
  return `<!DOCTYPE html>
<html lang="${copy.code}" dir="${copy.dir}">
<head>
  <script defer src="/web-client/rights-boot.js?v=${APP_ASSET_V}"></script>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  ${ahrefsAnalyticsHeadTag()}
  <title>${headTitle}</title>
  <meta name="description" content="${headDesc}"/>
  <meta name="robots" content="${robots}"/>
  <link rel="canonical" href="${canon}"/>
  ${hreflangLinks("/")}
  <meta property="og:type" content="website"/>
  <meta property="og:locale" content="${copy.locale}"/>
  <meta property="og:site_name" content="11tik"/>
  <meta property="og:title" content="${headTitle}"/>
  <meta property="og:description" content="${headDesc}"/>
  <meta property="og:url" content="${canon}"/>
  <meta property="og:image" content="${OG_IMAGE}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${headTitle}"/>
  <meta name="twitter:description" content="${headDesc}"/>
  <meta name="twitter:image" content="${OG_IMAGE}"/>
  <link rel="icon" type="image/png" sizes="32x32" href="${ICON_32}"/>
  <link rel="icon" type="image/png" sizes="16x16" href="${ICON_16}"/>
  <link rel="apple-touch-icon" sizes="180x180" href="${ICON_APPLE}"/>
  <link rel="dns-prefetch" href="https://www.googletagmanager.com"/>
  ${siteHeaderThemeBootScript()}
  ${siteHeaderStyleTag()}
  <style>html,body{margin:0;background:var(--yte-bg,#f4efe6)}#yte-root{display:block;min-height:100vh}.yte-app>.yte-shell>header.yte-top{display:none!important}.yte-shell-guides ul,.yte-crawl-nav ul{padding-left:1.25rem;margin:16px 0 0}.yte-shell-guides a,.yte-crawl-nav a{color:#c2410c;font-weight:600}</style>
  <link rel="preload" href="${css}" as="style"/>
  <script type="application/ld+json">${schema}</script>
</head>
<body>
  ${renderSiteHeaderHtml({
    locale: code,
    homeUrl: headerLocaleHomeUrl(code),
    contentPath: "/",
    variant: "spa-shell",
  })}
  ${spaShellBodyHtml(code, buildContext)}
  ${siteHeaderScriptTag()}
  <script defer fetchpriority="high" src="${js}"></script>
  <script defer src="/web-client/ga-boot.js?v=${APP_ASSET_V}"></script>
</body>
</html>
`;
}

function writeFile(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function sitemapXml(extraLocaleLocs = []) {
  const postHrefs = loadGuidePostHrefsFromFile(readFileSync(POSTS_TS, "utf8"));
  if (!postHrefs.length) {
    throw new Error("sitemap: no GUIDE_POSTS hrefs found in src/content/posts.ts");
  }
  const locs = collectCanonicalSitemapLocs({ postHrefs });
  const trustedLocale = [];
  for (const raw of extraLocaleLocs) {
    const loc = normalizeTrustedLocaleSitemapLoc(raw);
    if (!loc) throw new Error(`Invalid locale sitemap loc: ${raw}`);
    trustedLocale.push(loc);
  }
  const localeHomes = collectLocaleHomeSitemapLocs();
  return buildSitemapXml([...new Set([...locs, ...trustedLocale, ...localeHomes])].sort());
}

function robotsTxt() {
  return `# 11tik robots.txt
# https://www.11tik.com/
# YouTube Thumbnail Extractor — allow public pages and render assets.
# Do not Disallow /web-client/ broadly (JS/CSS required for rendering).
# Do not Disallow /thumb/ (share/result SPA; use page-level noindex/canonical if needed).

${aiTrainingRobotsBlock()}
${aiSearchAllowRobotsBlock()}
User-agent: *
Allow: /
Disallow: /search
Disallow: /feeds/
Disallow: /hold-queue
Disallow: /web-client/hold-queue.json
Disallow: /web-client/__extracts.json

Sitemap: ${SITE}/sitemap.xml
`;
}

function llmsTxtBody() {
  return `# 11tik
> Free in-browser YouTube Thumbnail Extractor — public stills only, no video download.

## Product
- [Homepage](https://www.11tik.com/): Paste a public YouTube URL and save the largest thumbnail still YouTube hosts.
- [About](https://www.11tik.com/p/about.html): What 11tik is and is not.
- [Copyright](https://www.11tik.com/copyright): Thumbnail reuse and copyright notes.

## Guides
- [How to download a YouTube thumbnail](https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html)
- [YouTube thumbnail URL formats](https://www.11tik.com/2026/08/youtube-thumbnail-url.html)
- [Batch download up to 25 URLs](https://www.11tik.com/2026/08/how-to-batch-download-youtube.html)

## Policies
- [Privacy](https://www.11tik.com/p/privacy.html)
- [Terms](https://www.11tik.com/p/terms-of-use.html)
- [Contact](https://www.11tik.com/p/contact.html)
`;
}

export function generateStaticSite(staged) {
  const inventory = buildContentInventory();
  const manifest = scanPublishability(inventory);
  const catalogByLocale = { en: buildLocaleCatalogDoc("en", { inventory }) };
  for (const locale of getTargetLocales()) {
    catalogByLocale[locale] = buildLocaleCatalogDoc(locale, { inventory });
  }
  for (const [code] of ISO6391) {
    if (!catalogByLocale[code]) catalogByLocale[code] = catalogByLocale.en;
  }
  const buildContext = { inventory, manifest, catalogByLocale };
  const crawlNavByLocale = {};
  for (const locale of ["en", ...getTargetLocales()]) {
    crawlNavByLocale[locale] = renderLocaleCrawlNavHtml(locale, buildContext);
  }
  buildContext.crawlNavByLocale = crawlNavByLocale;

  const en = localeRecord("en");
  writeFile(
    join(staged, "index.html"),
    appShellHtml({
      code: "en",
      canonical: `${SITE}/`,
      title: en.title,
      description: en.description,
      buildContext,
    }),
  );
  for (const [code] of ISO6391) {
    const copy = localeRecord(code);
    writeFile(
      join(staged, "l", code, "index.html"),
      appShellHtml({
        code,
        canonical: canonicalFor(code),
        title: copy.title,
        description: copy.description,
        buildContext,
      }),
    );
  }
  // English static pages at canonical /2026/* and /p/* paths (Phase A serves /2026 from Assets).
  const englishShadow = writeEnglishStaticPages(writeFile, staged, inventory, { manifest, buildContext });
  if (englishShadow.missingSource.length) {
    throw new Error(`English static missing source files: ${englishShadow.missingSource.join(", ")}`);
  }
  assertEnglishStaticCoverage(staged);

  writeLocaleCatalogs(writeFile, staged);

  // Ready translations only (status=ready + sourceHash match + validation). Missing/stale skipped.
  const localeArticleLocs = writePublishableLocaleArticles(writeFile, staged, null, {
    inventory,
    buildContext,
  });
  const publishable = collectPublishableLocaleArticleLocs().filter((loc) => localeArticleLocs.includes(loc));
  assertLocaleSitemapLocsHaveFiles(staged, publishable);
  writePocFrReadinessManifest(writeFile, staged, publishable.length > 0, null);
  writeFile(join(staged, "robots.txt"), robotsTxt());
  writeFile(join(staged, "llms.txt"), llmsTxtBody());
  writeCopyrightStaticPage(writeFile, staged);
  writeFile(join(staged, "sitemap.xml"), sitemapXml(publishable));
  writePostsFeeds(writeFile, staged, { inventory });
  // IndexNow ownership key at site root (plain text only).
  writeFile(join(staged, indexNowKeyFilename()), indexNowKeyBody());
  // After html_handling=none, point extensionless hits at *.html canonicals (Ahrefs File 15).
  writeFile(join(staged, "_redirects"), buildHtmlExtensionRedirects(staged));
}
