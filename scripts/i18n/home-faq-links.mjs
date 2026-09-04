/**
 * Localized guide URLs for homepage FAQ / caps / hubs contextual links.
 * Uses publishable locale permalinks when ready; otherwise EN www fallback.
 * Never invents URLs. Never uses /blog/ Study path.
 */
import { buildContentInventory, EN_ONLY_ARTICLE_IDS } from "./content-inventory.mjs";
import { localizedPublicUrl, loadTranslationArtifact, readSourceHash } from "./translation-store.mjs";
import { resolvePublishState } from "./validate-artifact.mjs";

/** All guide contentIds referenced from homepage FAQ / caps / hubs. */
export const FAQ_GUIDE_CONTENT_IDS = Object.freeze({
  url: "youtube-thumbnail-url",
  shorts: "youtube-shorts-thumbnail-download",
  maxres: "what-is-maxresdefaultjpg-when-youtube",
  study: "youtube-thumbnail-sizes-resolutions-study",
  batch: "how-to-batch-download-youtube",
  howto: "how-to-download-youtube-thumbnail",
});

const EN_PATHS = Object.freeze({
  url: "/youtube-thumbnail-url",
  shorts: "/youtube-shorts-thumbnail-download",
  maxres: "/what-is-maxresdefaultjpg-when-youtube",
  study: "/youtube-thumbnail-sizes-resolutions-study",
  batch: "/how-to-batch-download-youtube",
  howto: "/how-to-download-youtube-thumbnail",
});

const SITE = "https://www.11tik.com";

function isPublishableLocaleGuide(item, locale) {
  const code = String(locale || "en").toLowerCase();
  if (code === "en") return true;
  if (!item) return false;
  if (EN_ONLY_ARTICLE_IDS.includes(item.contentId)) return false;
  const sourceHash = readSourceHash(item.sourceRel);
  const artifact = loadTranslationArtifact(item.contentId, code);
  if (!artifact || !sourceHash) return false;
  const state = resolvePublishState(artifact, item.contentId, code, sourceHash, item.type);
  return Boolean(state.publishable);
}

/**
 * Resolve the correct public URL for a guide contentId in a locale.
 * EN-only and unpublished locale pages fall back to the English canonical URL.
 */
export function faqGuideUrl(locale, contentId, inventory = buildContentInventory()) {
  const item = inventory.find((row) => row.contentId === contentId);
  if (!item) return null;
  const code = String(locale || "en").toLowerCase();
  if (code === "en") return item.canonicalUrl;
  if (EN_ONLY_ARTICLE_IDS.includes(contentId)) return item.canonicalUrl;
  if (isPublishableLocaleGuide(item, code)) return localizedPublicUrl(item, code);
  return item.canonicalUrl;
}

/** Locale homepage URL (or EN www for English). */
export function localeHomePublicUrl(locale) {
  const code = String(locale || "en").toLowerCase();
  if (code === "en") return `${SITE}/`;
  return `https://${code}.11tik.com/l/${code}/`;
}

/**
 * Rewrite EN www guide hrefs in HTML to locale-appropriate permalinks.
 * Also rewrites homepage brand links to the locale home when not EN.
 */
export function localizeHomeFaqAnswerHtml(html, locale, inventory = buildContentInventory()) {
  let out = String(html || "");
  const code = String(locale || "en").toLowerCase();

  for (const [key, contentId] of Object.entries(FAQ_GUIDE_CONTENT_IDS)) {
    const enUrl = `${SITE}${EN_PATHS[key]}`;
    const target = faqGuideUrl(code, contentId, inventory) || enUrl;
    out = out.split(enUrl).join(target);
  }

  // Brand homepage href (www.11tik.com/) stays on www — official product URL.
  // Hard ban legacy Study blog path
  out = out
    .split(`${SITE}/blog/youtube-thumbnail-sizes-resolutions-study`)
    .join(`${SITE}/youtube-thumbnail-sizes-resolutions-study`);

  return out;
}

export function assertFaqLinksSameLocale(html, locale) {
  const code = String(locale || "en").toLowerCase();
  const links = [...String(html).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  if (code === "en") {
    return links.every(
      (href) =>
        href.startsWith("/") ||
        href.includes("www.11tik.com") ||
        href.includes("addons.mozilla.org"),
    );
  }
  const host = `${code}.11tik.com`;
  return links.every((href) => {
    if (href.startsWith("/")) return true;
    if (href.includes("addons.mozilla.org")) return true;
    if (href.includes(host)) return true;
    // Allowed EN fallbacks for unpublished / EN-only guides
    if (href.includes("www.11tik.com")) return true;
    return false;
  });
}
