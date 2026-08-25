import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentInventory } from "./content-inventory.mjs";
import {
  hashSource,
  loadTranslationArtifact,
  localizedAssetRelPath,
  localizedPublicUrl,
  normalizeSource,
  readSourceHash,
  TRANSLATIONS_ROOT,
} from "./translation-store.mjs";
import { resolvePublishState } from "./validate-artifact.mjs";
import { renderLocalizedHtml } from "./render-localized.mjs";
import { buildPathLinkIndex } from "./internal-links.mjs";
import {
  assertLocaleSitemapLocsHaveFiles,
  collectReadyLocaleLocs,
  scanPublishability,
  shouldRedirectToLocale,
  writePublishabilityManifest,
  writeReadyLocalizedPages,
} from "./publish.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const SHARE_LINKS_ARTICLE_ID = "11tik-share-links-thumb-vs-youtube";
export const SHARE_LINKS_EN_HREF =
  "https://www.11tik.com/2026/08/11tik-share-links-thumb-vs-youtube.html";
export const SHARE_LINKS_EN_SOURCE_REL =
  "docs/blogger-pages/blog/11tik-share-links-thumb-vs-watch.html";

export const POC_FR_MANIFEST_REL = join("web-client", "i18n", "poc-share-links-fr.json");
export const BLOGGER_POC_BEGIN = "<!-- YTE-POC-SHARE-LINKS-I18N:BEGIN -->";
export const BLOGGER_POC_END = "<!-- YTE-POC-SHARE-LINKS-I18N:END -->";

export function articleDir(articleId) {
  return join(TRANSLATIONS_ROOT, articleId);
}

export const normalizeArticleSource = normalizeSource;
export const hashArticleSource = hashSource;

export function readEnglishSourceHash(articleId = SHARE_LINKS_ARTICLE_ID) {
  if (articleId !== SHARE_LINKS_ARTICLE_ID) {
    throw new Error(`compat readEnglishSourceHash only for ${SHARE_LINKS_ARTICLE_ID}`);
  }
  return readSourceHash(SHARE_LINKS_EN_SOURCE_REL);
}

export function loadLocaleArtifact(articleId, locale) {
  return loadTranslationArtifact(articleId, locale);
}

export function resolveLocalePublishState(articleId, locale, currentSourceHash) {
  return resolvePublishState(loadTranslationArtifact(articleId, locale), articleId, locale, currentSourceHash);
}

export function localeArticlePublicUrl(articleId, locale) {
  const item = {
    contentId: articleId,
    type: "article",
    canonicalPath: `/2026/08/${articleId}.html`,
    canonicalUrl: `https://www.11tik.com/2026/08/${articleId}.html`,
  };
  return localizedPublicUrl(item, locale);
}

export function localeArticleAssetRelPath(articleId, locale) {
  return localizedAssetRelPath(
    { type: "article", canonicalPath: `/2026/08/${articleId}.html` },
    locale,
  );
}

export function renderLocalizedArticleHtml(artifact) {
  const contentId = artifact.contentId || artifact.articleId;
  const item = {
    contentId,
    type: "article",
    canonicalPath: `/2026/08/${contentId}.html`,
    canonicalUrl: `https://www.11tik.com/2026/08/${contentId}.html`,
  };
  const alternates = [
    { locale: "en", url: item.canonicalUrl },
    { locale: artifact.locale, url: localizedPublicUrl(item, artifact.locale) },
  ];
  // Include all ready locales for this content when available.
  const manifest = scanPublishability();
  const entry = manifest.contents[contentId];
  if (entry) {
    for (const [locale, row] of Object.entries(entry.locales)) {
      if (row.status === "ready" && row.url && !alternates.some((a) => a.locale === locale)) {
        alternates.push({ locale, url: row.url });
      }
    }
  }
  return renderLocalizedHtml(item, artifact, {
    alternates,
    pathLinkIndex: buildPathLinkIndex(manifest.contents),
  });
}

export function collectPublishableLocaleArticleLocs(_currentSourceHash) {
  return collectReadyLocaleLocs();
}

export function writePublishableLocaleArticles(writeFile, staged, _currentSourceHash) {
  const { written } = writeReadyLocalizedPages(writeFile, staged);
  return written.map((row) => row.url);
}

export function buildPocFrReadinessManifest(publishable, currentSourceHash) {
  return {
    articleId: SHARE_LINKS_ARTICLE_ID,
    contentId: SHARE_LINKS_ARTICLE_ID,
    locale: "fr",
    ready: Boolean(publishable),
    sourceHash: currentSourceHash,
    url: publishable ? localeArticlePublicUrl(SHARE_LINKS_ARTICLE_ID, "fr") : null,
  };
}

export function writePocFrReadinessManifest(writeFile, staged, publishable, currentSourceHash) {
  writePublishabilityManifest(writeFile, staged);
  // ensure POC file exists even if called alone
  if (!existsSync(join(staged, POC_FR_MANIFEST_REL))) {
    writeFile(
      join(staged, POC_FR_MANIFEST_REL),
      `${JSON.stringify(buildPocFrReadinessManifest(publishable, currentSourceHash), null, 2)}\n`,
    );
  }
}

export function localeArticleLocToAssetRel(loc) {
  try {
    return new URL(loc).pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}

export { assertLocaleSitemapLocsHaveFiles };

export function shouldRedirectEnArticleToFr(args) {
  const ready = args.frenchPublishable
    ? { fr: localeArticlePublicUrl(SHARE_LINKS_ARTICLE_ID, "fr") }
    : {};
  if (String(args.pathname || "").replace(/\/+$/, "") !== "/2026/08/11tik-share-links-thumb-vs-youtube.html") {
    return null;
  }
  return shouldRedirectToLocale({ ...args, readyLocales: ready });
}

function genericArticleHreflangXml() {
  return `        <link href='https://www.11tik.com/' hreflang='en' rel='alternate'/>
        <link href='https://fr.11tik.com/' hreflang='fr' rel='alternate'/>
        <link href='https://es.11tik.com/' hreflang='es' rel='alternate'/>
        <link href='https://www.11tik.com/' hreflang='x-default' rel='alternate'/>`;
}

/**
 * Manifest-driven EN Blogger integration.
 * Compact /web-client/i18n/publishability.json supplies ready locales only.
 * Static generic host hreflang remains as crawlable fallback; JS adds page-specific alts.
 */
function readyManifestDrivenHreflangAndRedirectXml() {
  return `      <script type='text/javascript'>
(function () {
  try {
    var path = location.pathname.replace(/\\/+$/, '') || '/';
    if (/^\\/l\\//.test(path)) return;
    if (localStorage.getItem('yte-lang')) return;
    if (sessionStorage.getItem('yte-i18n-redir')) return;
    if (/Googlebot|Google-InspectionTool|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot/i.test(navigator.userAgent || '')) return;
    fetch('https://www.11tik.com/web-client/i18n/publishability.json', { credentials: 'omit', cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (doc) {
        if (!doc || !doc.contents) return;
        var entry = null;
        var id;
        for (id in doc.contents) {
          if (doc.contents[id] &amp;&amp; doc.contents[id].path === path) { entry = doc.contents[id]; break; }
        }
        if (!entry || !entry.locales) return;
        var head = document.head || document.getElementsByTagName('head')[0];
        if (head &amp;&amp; entry.en) {
          function addAlt(lang, href) {
            var link = document.createElement('link');
            link.rel = 'alternate';
            link.hreflang = lang;
            link.href = href;
            head.appendChild(link);
          }
          addAlt('en', entry.en);
          addAlt('x-default', entry.en);
          for (var loc in entry.locales) addAlt(loc, entry.locales[loc]);
        }
        var langs = navigator.languages || (navigator.language ? [navigator.language] : []);
        for (var i = 0; i &lt; langs.length; i++) {
          var code = String(langs[i] || '').toLowerCase().split('-')[0];
          if (code &amp;&amp; code !== 'en' &amp;&amp; entry.locales[code]) {
            sessionStorage.setItem('yte-i18n-redir', '1');
            localStorage.setItem('yte-lang', code);
            location.replace(String(entry.locales[code]));
            return;
          }
        }
      })
      .catch(function () {});
  } catch (e) {}
})();
      </script>
${genericArticleHreflangXml()}`;
}

export function buildBloggerPocThemeFragment(frenchPublishable) {
  const inner = frenchPublishable ? readyManifestDrivenHreflangAndRedirectXml() : genericArticleHreflangXml();
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
  if (next !== current) writeFileSync(themePath, next);
  return next;
}
