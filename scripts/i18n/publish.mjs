import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";
import {
  loadTranslationArtifact,
  localizedAssetRelPath,
  localizedPublicUrl,
  readSourceHash,
} from "./translation-store.mjs";
import { resolvePublishState } from "./validate-artifact.mjs";
import { renderLocalizedHtml } from "./render-localized.mjs";
import { buildPathLinkIndex } from "./internal-links.mjs";
import { normalizeTrustedLocaleSitemapLoc } from "../../workers/sitemap-canonicals.js";
import { getTargetLocales } from "./target-languages.mjs";

export const PUBLISH_MANIFEST_REL = join("web-client", "i18n", "publishability.json");
export const PUBLISH_LOCALES = getTargetLocales();

export function scanPublishability(inventory = buildContentInventory()) {
  const items = localizableContent(inventory);
  const byContent = {};
  let ready = 0;
  let missing = 0;
  let stale = 0;
  let draft = 0;
  let failed = 0;
  let invalid = 0;

  for (const item of items) {
    const sourceHash = readSourceHash(item.sourceRel);
    const locales = {};
    for (const locale of PUBLISH_LOCALES) {
      const artifact = loadTranslationArtifact(item.contentId, locale);
      if (!artifact) {
        locales[locale] = { status: "missing", url: null, sourceHash: null };
        missing += 1;
        continue;
      }
      if (!sourceHash) {
        locales[locale] = {
          status: artifact.status || "draft",
          url: null,
          sourceHash: artifact.sourceHash || null,
          note: "no-english-source",
        };
        if (artifact.status === "failed") failed += 1;
        else draft += 1;
        continue;
      }
      const state = resolvePublishState(artifact, item.contentId, locale, sourceHash, item.type);
      if (state.publishable) {
        const url = localizedPublicUrl(item, locale);
        locales[locale] = { status: "ready", url, sourceHash };
        ready += 1;
      } else if (state.reason === "stale" || artifact.sourceHash !== sourceHash) {
        locales[locale] = { status: "stale", url: null, sourceHash: artifact.sourceHash };
        stale += 1;
      } else if (state.reason === "invalid") {
        locales[locale] = { status: "invalid", url: null, sourceHash: artifact.sourceHash, errors: state.errors };
        invalid += 1;
      } else if (artifact.status === "failed") {
        locales[locale] = { status: "failed", url: null, sourceHash: artifact.sourceHash };
        failed += 1;
      } else {
        locales[locale] = { status: artifact.status || "draft", url: null, sourceHash: artifact.sourceHash };
        draft += 1;
      }
    }
    byContent[item.contentId] = {
      type: item.type,
      canonicalUrl: item.canonicalUrl,
      canonicalPath: item.canonicalPath,
      sourceHash,
      locales,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    contentCount: items.length,
    localeCount: PUBLISH_LOCALES.length,
    theoreticalPages: items.length * PUBLISH_LOCALES.length,
    counts: { ready, missing, stale, draft, failed, invalid },
    contents: byContent,
  };
}

export function collectReadyLocaleLocs(manifest = scanPublishability()) {
  const locs = [];
  for (const entry of Object.values(manifest.contents)) {
    for (const [locale, row] of Object.entries(entry.locales)) {
      if (row.status !== "ready" || !row.url) continue;
      const loc = normalizeTrustedLocaleSitemapLoc(row.url);
      if (loc) locs.push(loc);
    }
  }
  return [...new Set(locs)].sort();
}

export function writePublishabilityManifest(writeFile, staged, manifest = scanPublishability()) {
  // Compact public manifest for Blogger/theme redirect (ready locales only).
  const compact = {};
  for (const [contentId, entry] of Object.entries(manifest.contents)) {
    const ready = {};
    for (const [locale, row] of Object.entries(entry.locales)) {
      if (row.status === "ready" && row.url) ready[locale] = row.url;
    }
    if (Object.keys(ready).length) {
      compact[contentId] = {
        path: entry.canonicalPath,
        en: entry.canonicalUrl,
        locales: ready,
      };
    }
  }
  writeFile(join(staged, PUBLISH_MANIFEST_REL), `${JSON.stringify({ v: 1, contents: compact }, null, 2)}\n`);
  // Keep POC-compatible single-article FR manifest for existing live redirect.
  const share = compact["11tik-share-links-thumb-vs-youtube"];
  const frUrl = share?.locales?.fr || null;
  writeFile(
    join(staged, "web-client", "i18n", "poc-share-links-fr.json"),
    `${JSON.stringify(
      {
        articleId: "11tik-share-links-thumb-vs-youtube",
        contentId: "11tik-share-links-thumb-vs-youtube",
        locale: "fr",
        ready: Boolean(frUrl),
        sourceHash: manifest.contents["11tik-share-links-thumb-vs-youtube"]?.sourceHash || null,
        url: frUrl,
      },
      null,
      2,
    )}\n`,
  );
  return compact;
}

export function writeReadyLocalizedPages(writeFile, staged, inventory = buildContentInventory()) {
  const manifest = scanPublishability(inventory);
  const pathLinkIndex = buildPathLinkIndex(manifest.contents);
  const written = [];
  const itemsById = Object.fromEntries(localizableContent(inventory).map((item) => [item.contentId, item]));

  for (const [contentId, entry] of Object.entries(manifest.contents)) {
    const item = itemsById[contentId];
    if (!item) continue;
    const readyAlternates = [{ locale: "en", url: item.canonicalUrl }];
    for (const [locale, row] of Object.entries(entry.locales)) {
      if (row.status === "ready" && row.url) readyAlternates.push({ locale, url: row.url });
    }
    for (const [locale, row] of Object.entries(entry.locales)) {
      if (row.status !== "ready" || !row.url) continue;
      const artifact = loadTranslationArtifact(contentId, locale);
      if (!artifact) continue;
      const rel = localizedAssetRelPath(item, locale);
      const html = renderLocalizedHtml(item, artifact, { alternates: readyAlternates, pathLinkIndex });
      writeFile(join(staged, rel), html);
      written.push({ contentId, locale, url: row.url, rel });
    }
  }

  return { manifest, written };
}

export function assertLocaleSitemapLocsHaveFiles(staged, locs) {
  const missing = [];
  for (const loc of locs) {
    const normalized = normalizeTrustedLocaleSitemapLoc(loc);
    if (!normalized) {
      missing.push(loc);
      continue;
    }
    const rel = new URL(normalized).pathname.replace(/^\//, "");
    if (!existsSync(join(staged, rel))) missing.push(loc);
  }
  if (missing.length) throw new Error(`Locale sitemap locs without generated files: ${missing.join(", ")}`);
}

export function shouldRedirectToLocale({
  pathname,
  savedLang,
  sessionRedirected,
  browserLanguages,
  readyLocales,
}) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  if (savedLang) return null;
  if (sessionRedirected) return null;
  const ready = readyLocales || {};
  const langs = Array.isArray(browserLanguages) ? browserLanguages : [];
  for (const lang of langs) {
    const code = String(lang || "")
      .toLowerCase()
      .split("-")[0];
    if (code && code !== "en" && ready[code]) return ready[code];
  }
  return null;
}

export function writeDryRunReport(path, report) {
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}
