#!/usr/bin/env node
/**
 * Move translation artifacts outside TARGET_LANGUAGES into content/translations-archive/.
 * Does not delete. Generation/sitemap ignore archived locales.
 */
import { existsSync, mkdirSync, renameSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTargetLocales } from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "content", "translations");
const ARCHIVE = join(ROOT, "content", "translations-archive");
const REPORT = join(ROOT, "tmp", "i18n-archive-out-of-target.json");

function main() {
  const targets = new Set(getTargetLocales());
  const moved = [];
  if (!existsSync(SRC)) {
    console.log(JSON.stringify({ moved: 0, note: "no translations dir" }));
    return;
  }

  for (const contentId of readdirSync(SRC)) {
    const dir = join(SRC, contentId);
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      const locale = name.replace(/\.json$/, "");
      if (targets.has(locale)) continue;
      const from = join(dir, name);
      const toDir = join(ARCHIVE, contentId);
      mkdirSync(toDir, { recursive: true });
      const to = join(toDir, name);
      if (existsSync(to)) {
        renameSync(to, join(toDir, `${locale}.prev-${Date.now()}.json`));
      }
      renameSync(from, to);
      moved.push({ contentId, locale, to: `content/translations-archive/${contentId}/${name}` });
    }
  }

  mkdirSync(dirname(REPORT), { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    targetLocales: [...targets].sort(),
    movedCount: moved.length,
    moved,
  };
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ movedCount: moved.length, report: REPORT }, null, 2));
}

main();
