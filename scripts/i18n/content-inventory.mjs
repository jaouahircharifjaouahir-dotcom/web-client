import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP,
  SITE_ORIGIN,
  loadGuidePostHrefsFromFile,
} from "../../workers/sitemap-canonicals.js";
import {
  INDEXABLE_UTILITY_IDS,
  enAssetRel,
  enCleanPath,
  enLegacyArticlePath,
  enLegacyPagePath,
} from "./clean-urls.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const POSTS_TS = join(ROOT, "src", "content", "posts.ts");

/**
 * Optional English HTML source overrides when filename ≠ URL slug.
 * Keys = contentId (URL slug without .html).
 */
export const ARTICLE_SOURCE_OVERRIDES = Object.freeze({
  "11tik-share-links-thumb-vs-youtube": "docs/blogger-pages/blog/11tik-share-links-thumb-vs-watch.html",
  "youtube-thumbnail-not-appearing-private": "docs/blogger-pages/blog/youtube-thumbnail-not-appearing.html",
  "what-is-maxresdefaultjpg-when-youtube": "docs/blogger-pages/blog/maxresdefault-explained.html",
  "how-to-batch-download-youtube": "docs/blogger-pages/blog/batch-download-youtube-thumbnails.html",
  "screenshot-vs-real-youtube-thumbnail": "docs/blogger-pages/blog/screenshots-vs-real-thumbnails.html",
  "how-to-save-youtube-thumbnail-on-iphone": "docs/blogger-pages/blog/save-youtube-thumbnail-iphone-android.html",
  "how-to-use-youtube-thumbnail-as-blog": "docs/blogger-pages/blog/youtube-thumbnail-blog-open-graph.html",
  "how-to-extract-thumbnails-from-youtube": "docs/blogger-pages/blog/extract-thumbnails-youtube-channel.html",
  "webp-vs-jpeg-youtube-thumbnails-which": "docs/blogger-pages/blog/youtube-thumbnail-webp-vs-jpeg.html",
});

/** English-only research articles — indexed on www but excluded from locale translation rollout. */
export const EN_ONLY_ARTICLE_IDS = Object.freeze(["youtube-thumbnail-sizes-resolutions-study"]);

export const UTILITY_SOURCE_MAP = Object.freeze({
  about: "docs/blogger-pages/about.html",
  contact: "docs/blogger-pages/contact.html",
  embed: "docs/blogger-pages/embed.html",
  privacy: "docs/blogger-pages/privacy.html",
  "terms-of-use": "docs/blogger-pages/terms.html",
  "keyword-tools": "docs/blogger-pages/keyword-tools.html",
});

export function contentIdFromWwwPath(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  const base = path.split("/").pop() || "";
  return base.replace(/\.html$/i, "") || path.replace(/^\//, "").replace(/\//g, "--");
}

export function resolveArticleSourceRel(contentId, canonicalPath) {
  if (ARTICLE_SOURCE_OVERRIDES[contentId]) return ARTICLE_SOURCE_OVERRIDES[contentId];
  const slug = contentId;
  const candidates = [
    `docs/blogger-pages/blog/${slug}.html`,
    `docs/blogger-pages/${slug}.html`,
  ];
  for (const rel of candidates) {
    if (existsSync(join(ROOT, rel))) return rel;
  }
  return null;
}

/**
 * Authoritative localizable content inventory.
 * Homepage locale shells already generated separately — marked localizable=false for translation pipeline.
 */
export function buildContentInventory(options = {}) {
  const postsTs = options.postsTsContents ?? readFileSync(POSTS_TS, "utf8");
  const postHrefs = options.postHrefs ?? loadGuidePostHrefsFromFile(postsTs);
  const utilityIds = options.utilityIds ?? INDEXABLE_UTILITY_IDS;
  const items = [];

  items.push({
    contentId: "home",
    type: "homepage",
    canonicalPath: "/",
    canonicalUrl: `${SITE_ORIGIN}/`,
    legacyPath: "/",
    assetRel: null,
    title: "11tik homepage",
    sourceRel: null,
    indexable: true,
    localizable: false,
    note: "Locale homes already emitted as /l/{lang}/ SPA shells; not translation-pipeline HTML.",
  });

  for (const href of postHrefs) {
    const url = new URL(href);
    const contentId = contentIdFromWwwPath(url.pathname);
    const canonicalPath = enCleanPath(contentId);
    const sourceRel = resolveArticleSourceRel(contentId, canonicalPath);
    items.push({
      contentId,
      type: "article",
      canonicalPath,
      canonicalUrl: href,
      legacyPath: enLegacyArticlePath(contentId),
      assetRel: enAssetRel(contentId),
      title: contentId,
      sourceRel,
      indexable: true,
      localizable: !EN_ONLY_ARTICLE_IDS.includes(contentId),
    });
  }

  for (const contentId of utilityIds) {
    const canonicalPath = enCleanPath(contentId);
    items.push({
      contentId,
      type: "utility",
      canonicalPath,
      canonicalUrl: `${SITE_ORIGIN}${canonicalPath}`,
      legacyPath: enLegacyPagePath(contentId),
      assetRel: enAssetRel(contentId),
      title: contentId,
      sourceRel: UTILITY_SOURCE_MAP[contentId] || null,
      indexable: true,
      localizable: true,
    });
  }

  return items;
}

export function localizableContent(inventory = buildContentInventory()) {
  return inventory.filter((item) => item.localizable && item.indexable);
}

export { LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP };
