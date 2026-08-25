/**
 * Cross-language internal link validation for ready artifacts.
 */
import { loadTranslationArtifact } from "./translation-store.mjs";
import { buildReadyUrlIndex } from "./internal-links.mjs";
import { scanPublishability } from "./publish.mjs";

const HREF_RE = /href=["']([^"']+)["']/gi;

export function scanInternalLinks(manifest = scanPublishability()) {
  const index = buildReadyUrlIndex(
    Object.fromEntries(
      Object.entries(manifest.contents)
        .filter(([, entry]) =>
          Object.values(entry.locales).some((row) => row.status === "ready" && row.url),
        )
        .map(([contentId, entry]) => {
          const ready = {};
          for (const [locale, row] of Object.entries(entry.locales)) {
            if (row.status === "ready" && row.url) ready[locale] = row.url;
          }
          return [
            contentId,
            { path: entry.canonicalPath, en: entry.canonicalUrl, locales: ready },
          ];
        }),
    ),
  );

  let totalLinks = 0;
  let localizedLinks = 0;
  let englishFallbackLinks = 0;
  const broken = [];

  for (const [contentId, entry] of Object.entries(manifest.contents)) {
    for (const [locale, row] of Object.entries(entry.locales)) {
      if (row.status !== "ready" || !row.url) continue;
      const artifact = loadTranslationArtifact(contentId, locale);
      if (!artifact) continue;
      const blob = JSON.stringify(artifact);
      for (const match of blob.matchAll(HREF_RE)) {
        const href = match[1];
        if (!href.includes("11tik.com")) continue;
        totalLinks += 1;
        try {
          const url = new URL(href, "https://www.11tik.com");
          const path = url.pathname.replace(/\/+$/, "") || "/";
          const target = Object.values(index).find((r) => r.path === path);
          if (!target) continue;
          if (target.locales[locale]) {
            if (href === target.locales[locale]) localizedLinks += 1;
            else broken.push({ contentId, locale, href, expected: target.locales[locale] });
          } else {
            englishFallbackLinks += 1;
          }
        } catch {
          broken.push({ contentId, locale, href, reason: "parse-error" });
        }
      }
    }
  }

  return { totalLinks, localizedLinks, englishFallbackLinks, broken, brokenCount: broken.length };
}
