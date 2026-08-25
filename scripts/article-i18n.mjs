/**
 * Backward-compatible facade over the generalized i18n system.
 * New code should import from scripts/i18n/*.
 */
export {
  SHARE_LINKS_ARTICLE_ID,
  SHARE_LINKS_EN_HREF,
  SHARE_LINKS_EN_SOURCE_REL,
  articleDir,
  normalizeArticleSource,
  hashArticleSource,
  readEnglishSourceHash,
  loadLocaleArtifact,
  resolveLocalePublishState,
  localeArticlePublicUrl,
  localeArticleAssetRelPath,
  renderLocalizedArticleHtml,
  collectPublishableLocaleArticleLocs,
  writePublishableLocaleArticles,
  POC_FR_MANIFEST_REL,
  BLOGGER_POC_BEGIN,
  BLOGGER_POC_END,
  buildPocFrReadinessManifest,
  writePocFrReadinessManifest,
  localeArticleLocToAssetRel,
  assertLocaleSitemapLocsHaveFiles,
  shouldRedirectEnArticleToFr,
  buildBloggerPocThemeFragment,
  applyBloggerPocTheme,
  syncBloggerThemePoc,
} from "./i18n/compat-poc.mjs";
