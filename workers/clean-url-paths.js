/**
 * Phase 53 — canonical clean URL paths and staged asset keys.
 * Single source for build scripts and Worker routing.
 */

/** @param {string} contentId */
export function enCleanPath(contentId) {
  return `/${String(contentId || "").replace(/^\/+/, "")}`;
}

/** Staged ASSETS key for English article/page HTML. */
export function enAssetRel(contentId) {
  const id = String(contentId || "");
  if (!id) throw new Error("enAssetRel requires contentId");
  if (id === "copyright") return "copyright/index.html";
  return `${id}.html`;
}

/** Legacy English article path (pre-migration). */
export function enLegacyArticlePath(contentId) {
  return `/2026/08/${contentId}.html`;
}

/** Legacy English utility path (pre-migration). */
export function enLegacyPagePath(contentId) {
  if (contentId === "copyright") return "/copyright/index.html";
  return `/p/${contentId}.html`;
}

/** @param {string} locale @param {string} contentId */
export function localizedCleanPath(locale, contentId) {
  return `/l/${locale}/${contentId}`;
}

/** Staged ASSETS key for localized article/page HTML. */
export function localizedAssetRel(locale, contentId) {
  return `l/${locale}/${contentId}.html`;
}

/** Legacy localized article path (pre-migration). */
export function localizedLegacyArticlePath(locale, contentId) {
  return `/l/${locale}/2026/08/${contentId}.html`;
}

/** Legacy localized utility path (pre-migration). */
export function localizedLegacyPagePath(locale, contentId) {
  return `/l/${locale}/p/${contentId}.html`;
}

export const INDEXABLE_UTILITY_IDS = Object.freeze([
  "about",
  "contact",
  "embed",
  "privacy",
  "terms-of-use",
  "keyword-tools",
]);

export const INDEXABLE_UTILITY_CLEAN_PATHS = Object.freeze(
  INDEXABLE_UTILITY_IDS.map((id) => enCleanPath(id)),
);
