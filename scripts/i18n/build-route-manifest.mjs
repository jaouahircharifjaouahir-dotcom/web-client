/**
 * Build-time route manifest for future clean URL resolution.
 * Source of truth: buildContentInventory() + scanPublishability() — same pipeline as publishability.json.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentInventory, EN_ONLY_ARTICLE_IDS } from "./content-inventory.mjs";
import { scanPublishability } from "./publish.mjs";
import { localizedAssetRelPath } from "./translation-store.mjs";
import { enAssetRel, localizedLegacyArticlePath, localizedLegacyPagePath } from "./clean-urls.mjs";
import { getTargetLocales } from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ROUTE_MANIFEST_REL = join("web-client", "i18n", "route-manifest.json");
export const WORKER_ROUTE_MANIFEST_REL = join("workers", "route-manifest.json");

/** Copyright is emitted outside content inventory but is a valid EN clean page target. */
const COPYRIGHT_PAGE = Object.freeze({
  contentId: "copyright",
  type: "page",
  legacyPath: "/copyright/index.html",
  cleanPath: "/copyright",
});

/**
 * @param {ReturnType<typeof buildContentInventory>} [inventory]
 * @param {ReturnType<typeof scanPublishability>} [publishScan]
 */
export function buildRouteManifest(inventory = buildContentInventory(), publishScan = scanPublishability(inventory)) {
  const enArticles = {};
  const enPages = {};

  for (const item of inventory) {
    if (item.type === "homepage") continue;
    const legacyPath = item.legacyPath;
    const cleanPath = `/${item.contentId}`;
    const row = {
      contentId: item.contentId,
      type: item.type === "utility" ? "page" : "article",
      legacyPath,
      cleanPath,
      assetRel: item.assetRel || enAssetRel(item.contentId),
      localizable: Boolean(item.localizable),
    };
    if (item.type === "article") enArticles[item.contentId] = row;
    else if (item.type === "utility") enPages[item.contentId] = row;
  }

  enPages.copyright = { ...COPYRIGHT_PAGE, assetRel: "copyright/index.html" };

  const localized = {};
  for (const [contentId, entry] of Object.entries(publishScan.contents)) {
    const item = inventory.find((row) => row.contentId === contentId);
    if (!item || item.type === "homepage") continue;
    for (const [locale, row] of Object.entries(entry.locales)) {
      if (row.status !== "ready" || !row.url) continue;
      if (!localized[locale]) localized[locale] = {};
      localized[locale][contentId] = {
        contentId,
        type: item.type === "utility" ? "page" : "article",
        legacyPath:
          item.type === "utility"
            ? localizedLegacyPagePath(locale, contentId)
            : localizedLegacyArticlePath(locale, contentId),
        cleanPath: `/l/${locale}/${contentId}`,
        assetRel: localizedAssetRelPath(item, locale).split("\\").join("/"),
      };
    }
  }

  return {
    v: 1,
    generatedAt: new Date().toISOString(),
    targetLocales: getTargetLocales(),
    enOnly: [...EN_ONLY_ARTICLE_IDS],
    en: { articles: enArticles, pages: enPages },
    localized,
    counts: {
      enArticles: Object.keys(enArticles).length,
      enPages: Object.keys(enPages).length,
      localizedPairs: Object.values(localized).reduce((sum, localeMap) => sum + Object.keys(localeMap).length, 0),
      locales: Object.keys(localized).length,
    },
  };
}

export function writeRouteManifest(writeFileFn, staged, manifest = buildRouteManifest()) {
  const body = `${JSON.stringify(manifest)}\n`;
  writeFileFn(join(staged, ROUTE_MANIFEST_REL), body);
  writeWorkerRouteManifest(manifest);
  return manifest;
}

/** Worker bundle import — regenerated on every static site build. */
export function writeWorkerRouteManifest(manifest = buildRouteManifest()) {
  const abs = join(ROOT, WORKER_ROUTE_MANIFEST_REL);
  writeFileSync(abs, `${JSON.stringify(manifest)}\n`);
  return abs;
}

export function readWorkerRouteManifest() {
  const abs = join(ROOT, WORKER_ROUTE_MANIFEST_REL);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, "utf8"));
}
