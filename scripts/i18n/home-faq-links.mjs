/**
 * Localized guide URLs for homepage FAQ contextual links.
 */
import { buildContentInventory } from "./content-inventory.mjs";
import { localizedPublicUrl } from "./translation-store.mjs";

export const FAQ_GUIDE_CONTENT_IDS = Object.freeze({
  url: "youtube-thumbnail-url",
  shorts: "youtube-shorts-thumbnail-download",
  maxres: "what-is-maxresdefaultjpg-when-youtube",
});

const EN_PATHS = Object.freeze({
  url: "/youtube-thumbnail-url",
  shorts: "/youtube-shorts-thumbnail-download",
  maxres: "/what-is-maxresdefaultjpg-when-youtube",
});

export function faqGuideUrl(locale, contentId, inventory = buildContentInventory()) {
  const item = inventory.find((row) => row.contentId === contentId);
  if (!item) return null;
  const code = String(locale || "en").toLowerCase();
  return code === "en" ? item.canonicalUrl : localizedPublicUrl(item, code);
}

export function localizeHomeFaqAnswerHtml(html, locale, inventory = buildContentInventory()) {
  let out = String(html || "");
  const code = String(locale || "en").toLowerCase();
  for (const [key, contentId] of Object.entries(FAQ_GUIDE_CONTENT_IDS)) {
    const enUrl = `https://www.11tik.com${EN_PATHS[key]}`;
    const target = faqGuideUrl(code, contentId, inventory) || enUrl;
    out = out.split(enUrl).join(target);
  }
  return out;
}

export function assertFaqLinksSameLocale(html, locale) {
  const code = String(locale || "en").toLowerCase();
  if (code === "en") {
    if (/https:\/\/(fr|ar|de|es)\.11tik\.com/i.test(html)) return false;
    return true;
  }
  const host = `${code}.11tik.com`;
  const links = [...String(html).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  return links.every((href) => href.includes(host) || href.startsWith("/"));
}
