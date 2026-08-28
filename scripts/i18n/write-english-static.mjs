/**
 * Write shadow English static HTML for articles + utilities into dist-assets.
 * Does not change Worker routing.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INDEXABLE_UTILITY_PATHS,
  SITE_ORIGIN,
  collectCanonicalSitemapLocs,
  loadGuidePostHrefsFromFile,
} from "../../workers/sitemap-canonicals.js";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";
import { scanPublishability } from "./publish.mjs";
import { englishStaticAssetRel, renderEnglishStaticHtml } from "./render-english-static.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const POSTS_TS = join(ROOT, "src", "content", "posts.ts");

function guideTitlesByPath() {
  const text = readFileSync(POSTS_TS, "utf8");
  const map = new Map();
  const blockRe =
    /\{\s*title:\s*"((?:\\.|[^"\\])*)"\s*,\s*href:\s*"(https:\/\/www\.11tik\.com\/[^"]+)"/g;
  let m;
  while ((m = blockRe.exec(text))) {
    const title = m[1].replace(/\\"/g, '"');
    try {
      map.set(new URL(m[2]).pathname, title);
    } catch {
      /* ignore */
    }
  }
  return map;
}

function readyAlternatesForItem(item, manifestEntry) {
  const alternates = [{ locale: "en", url: item.canonicalUrl }];
  if (!manifestEntry?.locales) return alternates;
  for (const [locale, row] of Object.entries(manifestEntry.locales)) {
    if (row.status === "ready" && row.url) alternates.push({ locale, url: row.url });
  }
  return alternates;
}

/**
 * @returns {{ written: { contentId: string, rel: string, url: string, type: string }[], missingSource: string[], manifest: object }}
 */
export function writeEnglishStaticPages(writeFile, staged, inventory = buildContentInventory(), options = {}) {
  const manifest = options.manifest || scanPublishability(inventory);
  const items = localizableContent(inventory);
  const titles = guideTitlesByPath();
  const written = [];
  const missingSource = [];

  for (const item of items) {
    if (!item.sourceRel || !existsSync(join(ROOT, item.sourceRel))) {
      missingSource.push(item.contentId);
      continue;
    }
    const entry = manifest.contents[item.contentId];
    const alternates = readyAlternatesForItem(item, entry);
    const postTitle = titles.get(item.canonicalPath) || "";
    const html = renderEnglishStaticHtml(item, {
      alternates,
      postTitle,
      buildContext: options.buildContext || { inventory, manifest },
      crawlNavHtml: options.buildContext?.crawlNavByLocale?.en,
    });
    const rel = englishStaticAssetRel(item);
    writeFile(join(staged, rel), html);
    written.push({ contentId: item.contentId, rel, url: item.canonicalUrl, type: item.type });
  }

  return { written, missingSource, manifest };
}

/**
 * Fail if any GUIDE_POSTS / INDEXABLE_UTILITY_PATHS file is missing under staged.
 */
export function assertEnglishStaticCoverage(staged, inventory = buildContentInventory()) {
  const missing = [];
  for (const item of localizableContent(inventory)) {
    const rel = englishStaticAssetRel(item);
    if (!existsSync(join(staged, rel))) missing.push(`${item.canonicalUrl} → ${rel}`);
  }
  if (missing.length) {
    throw new Error(`English static coverage failed (missing files):\n${missing.join("\n")}`);
  }
}

/**
 * Shadow sitemap assessment only — does not write production sitemap.xml.
 */
export function assessShadowSitemap(inventory = buildContentInventory(), readyLocaleLocs = []) {
  const postHrefs = loadGuidePostHrefsFromFile(readFileSync(POSTS_TS, "utf8"));
  const englishLocs = collectCanonicalSitemapLocs({
    postHrefs,
    utilityPaths: INDEXABLE_UTILITY_PATHS,
  });
  const localeLocs = [...new Set(readyLocaleLocs)].sort();
  const all = [...new Set([...englishLocs, ...localeLocs])].sort();
  return {
    englishCanonicalCount: englishLocs.length,
    articleCount: postHrefs.length,
    utilityCount: INDEXABLE_UTILITY_PATHS.length,
    localizedCount: localeLocs.length,
    theoreticalTotal: all.length,
    englishLocs,
    note: "Shadow assessment only — production sitemap.xml unchanged by this helper.",
    siteOrigin: SITE_ORIGIN,
  };
}

export function countHreflangOnHtml(html) {
  const en = (String(html).match(/hreflang=["']en["']/gi) || []).length;
  const xDefault = (String(html).match(/hreflang=["']x-default["']/gi) || []).length;
  const all = (String(html).match(/hreflang=["'][^"']+["']/gi) || []).length;
  return { en, xDefault, all, otherLocales: Math.max(0, all - en - xDefault) };
}
