/**
 * Count generated localized HTML files and measure size.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { RTL_CODES } from "../../workers/iso6391.js";
import { scanPublishability } from "./publish.mjs";
import { localizedAssetRelPath } from "./translation-store.mjs";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";

export function auditGeneratedFiles(stagedDir) {
  const manifest = scanPublishability();
  const itemsById = Object.fromEntries(localizableContent().map((i) => [i.contentId, i]));
  let expected = 0;
  let present = 0;
  let missing = 0;
  let rtlPages = 0;
  let totalBytes = 0;
  let hreflangLinks = 0;
  const missingFiles = [];

  for (const [contentId, entry] of Object.entries(manifest.contents)) {
    const item = itemsById[contentId];
    if (!item) continue;
    for (const [locale, row] of Object.entries(entry.locales)) {
      if (row.status !== "ready" || !row.url) continue;
      expected += 1;
      const rel = localizedAssetRelPath(item, locale);
      const abs = join(stagedDir, rel);
      if (!existsSync(abs)) {
        missing += 1;
        missingFiles.push({ contentId, locale, rel });
        continue;
      }
      present += 1;
      totalBytes += statSync(abs).size;
      if (RTL_CODES.has(locale)) rtlPages += 1;
      const html = readFileSync(abs, "utf8");
      hreflangLinks += (html.match(/hreflang="/g) || []).length;
    }
  }

  return {
    expected,
    present,
    missing,
    missingFiles,
    rtlPages,
    totalBytes,
    totalMiB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    hreflangLinks,
  };
}

export function countLocaleHtmlFiles(stagedDir) {
  let count = 0;
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) walk(p);
      else if (name.name.endsWith(".html") && dir.includes(`${join("l", "")}`)) count += 1;
    }
  }
  walk(join(stagedDir, "l"));
  return count;
}
