/**
 * Build-time localized content catalogs for Posts UI.
 * Source of truth: GUIDE_POSTS order + translation artifacts + publishability readiness.
 * Output: dist-assets/web-client/i18n/catalog/{locale}.json
 */
import { join } from "node:path";
import { buildContentInventory, localizableContent, EN_ONLY_ARTICLE_IDS, contentIdFromWwwPath, resolveArticleSourceRel } from "./content-inventory.mjs";
import { loadTranslationArtifact, localizedPublicUrl, readSourceHash } from "./translation-store.mjs";
import { resolvePublishState } from "./validate-artifact.mjs";
import { getTargetLocales } from "./target-languages.mjs";
import { readFileSync } from "node:fs";
import { dirname, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = pathJoin(dirname(fileURLToPath(import.meta.url)), "..", "..");
const POSTS_TS = pathJoin(ROOT, "src", "content", "posts.ts");

function stripSiteSuffix(title) {
  return String(title || "")
    .replace(/\s*\|\s*11tik\s*$/i, "")
    .trim();
}

/** Parse GUIDE_POSTS title/summary/href from posts.ts without importing TS. */
function loadGuidePostFields() {
  const src = readFileSync(POSTS_TS, "utf8");
  const posts = [];
  const blockRe =
    /\{\s*title:\s*"((?:\\.|[^"\\])*)"\s*,\s*href:\s*"((?:\\.|[^"\\])*)"\s*,\s*summary:\s*"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = blockRe.exec(src))) {
    const unesc = (s) => s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    posts.push({
      title: unesc(match[1]),
      href: unesc(match[2]),
      summary: unesc(match[3]),
    });
  }
  return posts;
}

export function buildLocaleCatalogDoc(locale, options = {}) {
  const inventory = options.inventory || buildContentInventory();
  const guides = loadGuidePostFields();
  const items = [];
  const articleItems = localizableContent(inventory).filter((row) => row.type === "article");
  const byPath = new Map(articleItems.map((row) => [row.canonicalPath, row]));

  for (const guide of guides) {
    const path = new URL(guide.href).pathname;
    const contentId = contentIdFromWwwPath(path);
    const item = byPath.get(path);
    if (!item) {
      if (locale === "en" && EN_ONLY_ARTICLE_IDS.includes(contentId)) {
        items.push({
          contentId,
          type: "article",
          url: guide.href,
          title: guide.title,
          description: guide.summary,
          ready: true,
          sourceHash: readSourceHash(resolveArticleSourceRel(contentId, path)) || null,
        });
      }
      continue;
    }

    const enTitle = guide.title;
    const enDescription = guide.summary;
    const enUrl = item.canonicalUrl;

    if (locale === "en") {
      items.push({
        contentId: item.contentId,
        type: "article",
        url: enUrl,
        title: enTitle,
        description: enDescription,
        ready: true,
        sourceHash: readSourceHash(item.sourceRel) || null,
      });
      continue;
    }

    const sourceHash = readSourceHash(item.sourceRel);
    const artifact = loadTranslationArtifact(item.contentId, locale);
    const state =
      artifact && sourceHash
        ? resolvePublishState(artifact, item.contentId, locale, sourceHash, item.type)
        : { publishable: false };

    if (state.publishable && artifact) {
      items.push({
        contentId: item.contentId,
        type: "article",
        url: localizedPublicUrl(item, locale),
        title: stripSiteSuffix(artifact.h1 || artifact.title) || enTitle,
        description: String(artifact.description || artifact.ogDescription || enDescription).trim(),
        ready: true,
        sourceHash: artifact.sourceHash || sourceHash,
      });
    } else {
      items.push({
        contentId: item.contentId,
        type: "article",
        url: enUrl,
        title: enTitle,
        description: enDescription,
        ready: false,
        sourceHash: artifact?.sourceHash || null,
      });
    }
  }

  return {
    v: 1,
    locale,
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
}

export function writeLocaleCatalogs(writeFile, staged) {
  const inventory = buildContentInventory();
  const locales = ["en", ...getTargetLocales()];
  const written = [];
  for (const locale of locales) {
    const doc = buildLocaleCatalogDoc(locale, { inventory });
    const rel = join("web-client", "i18n", "catalog", `${locale}.json`);
    writeFile(join(staged, rel), `${JSON.stringify(doc)}\n`);
    written.push({ locale, path: rel, count: doc.count, ready: doc.items.filter((i) => i.ready).length });
  }
  return written;
}
