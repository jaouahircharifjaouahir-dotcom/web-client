import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ISO6391, RTL_CODES, hreflangLinks } from "../workers/iso6391.js";
import localeMeta from "../workers/locale-meta.json" with { type: "json" };
import {
  buildSitemapXml,
  collectCanonicalSitemapLocs,
  loadGuidePostHrefsFromFile,
  normalizeTrustedLocaleSitemapLoc,
} from "../workers/sitemap-canonicals.js";
import {
  collectPublishableLocaleArticleLocs,
  writePublishableLocaleArticles,
  writePocFrReadinessManifest,
  assertLocaleSitemapLocsHaveFiles,
} from "./article-i18n.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_TS = join(ROOT, "src", "content", "posts.ts");

const SITE = "https://www.11tik.com";
const APP_ASSET_V = "55";
const OG_IMAGE = `${SITE}/web-client/images/social/og-image-1200x630.png`;
const ICON_32 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj3ow8HyWy9yRQFsg4KZb6tJUZwxmUUEuEBv5FzGZMbQrZ9wzK7tCB5GfEPlvGu4fTNSqAPeke2IJdpwubgUfq7XdryvcebCtYraxd6l2vUDo8hG3RimtLewbO1R4TB1_WehF-PziUil11Sb_rPJZ1YqlS5ikOWvartEdOCVK6s8SsmZaT-qK-HlzzAtG1n/s32/favicon-2.png";
const ICON_16 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEihb_sRR2V8NIZeXgIcfoASdqkVpP_dJJw0aWqqyrfEScm_bdpf5JrwNRLoEqlNhoM9S1c04HkxXeuNcwipE6U4uHtuoqmeMBHTC_oYjQfVuwE8vGuQd-HO9wQrnbT8FjnRanV5l12qwI7oQDo-79aeYKW1RsMZzgcWd-ECWdqJiRy0VCTeNVhycwFxz5bB/s16/favicon-1.png";
const ICON_APPLE =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgsK_kbqmn-MxxqHuxGNn_zB550uVfsk6tOxxn5aOqdpfctXcSb7v38a3W-jVKYS7plgByL7Ab2mslJd3juenu64QRnDc5qmC2yUtFTasYuGEqeJKwkPaag4XazIwU98clI_a6pOvlJ6uFjd9PsOGqW-spiCqDU11skry2hbU9inYPr3k8WUY64rqwl0wNx/s180/apple-touch-icon.png";

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
    description: meta.description || localeMeta.en.description,
  };
}

function canonicalFor(code) {
  return code === "en" ? `${SITE}/` : `https://${code}.11tik.com/l/${code}/`;
}

function appShellHtml({ code, canonical, title, description, robots = "index,follow" }) {
  const copy = localeRecord(code);
  const headTitle = xmlEscape(title || copy.title);
  const headDesc = xmlEscape(description || copy.description);
  const css = `/web-client/blogger-app.css?v=${APP_ASSET_V}`;
  const js = `/web-client/blogger-app.js?v=${APP_ASSET_V}`;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": ["WebApplication", "SoftwareApplication"],
    name: copy.title,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    url: canonical,
    image: OG_IMAGE,
    description: copy.description,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  });
  return `<!DOCTYPE html>
<html lang="${copy.code}" dir="${copy.dir}">
<head>
  <script src="/web-client/rights-boot.js?v=${APP_ASSET_V}"></script>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${headTitle}</title>
  <meta name="description" content="${headDesc}"/>
  <meta name="robots" content="${robots}"/>
  <link rel="canonical" href="${canonical}"/>
  ${hreflangLinks("/")}
  <meta property="og:type" content="website"/>
  <meta property="og:locale" content="${copy.locale}"/>
  <meta property="og:site_name" content="11tik"/>
  <meta property="og:title" content="${headTitle}"/>
  <meta property="og:description" content="${headDesc}"/>
  <meta property="og:url" content="${canonical}"/>
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
  <style>html,body{margin:0;background:#f4efe6}#yte-root{display:block;min-height:100vh}</style>
  <link rel="preload" href="${css}" as="style"/>
  <link rel="preload" href="${js}" as="script"/>
  <script type="application/ld+json">${schema}</script>
</head>
<body>
  <div id="yte-root"></div>
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
  return buildSitemapXml([...new Set([...locs, ...trustedLocale])].sort());
}

function robotsTxt() {
  return `# 11tik robots.txt
# https://www.11tik.com/
# YouTube Thumbnail Extractor — allow public pages and render assets.
# Do not Disallow /web-client/ broadly (JS/CSS required for rendering).
# Do not Disallow /thumb/ (share/result SPA; use page-level noindex/canonical if needed).

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

export function generateStaticSite(staged) {
  const en = localeRecord("en");
  writeFile(
    join(staged, "index.html"),
    appShellHtml({ code: "en", canonical: `${SITE}/`, title: en.title, description: en.description }),
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
      }),
    );
  }
  // Ready translations only (status=ready + sourceHash match + validation). Missing/stale skipped.
  const localeArticleLocs = writePublishableLocaleArticles(writeFile, staged);
  const publishable = collectPublishableLocaleArticleLocs().filter((loc) => localeArticleLocs.includes(loc));
  assertLocaleSitemapLocsHaveFiles(staged, publishable);
  writePocFrReadinessManifest(writeFile, staged, publishable.length > 0, null);
  writeFile(join(staged, "robots.txt"), robotsTxt());
  writeFile(join(staged, "sitemap.xml"), sitemapXml(publishable));
}
