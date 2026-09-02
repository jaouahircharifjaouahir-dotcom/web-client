/**
 * Phase 54 — audit and migrate legacy internal links in translation JSON artifacts.
 * Rewrites /2026/ and /p/ public hrefs to Phase 53 clean URLs.
 *
 * Usage:
 *   node scripts/i18n/migrate-translation-internal-links.mjs audit
 *   node scripts/i18n/migrate-translation-internal-links.mjs apply
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const TRANSLATIONS_DIR = join(ROOT, "content", "translations");

const LEGACY_PATTERNS = [
  {
    name: "www-article",
    re: /https:\/\/www\.11tik\.com\/2026\/(?:\d{2}\/)?([a-z0-9-]+)\.html/gi,
    replace: "https://www.11tik.com/$1",
  },
  {
    name: "www-utility",
    re: /https:\/\/www\.11tik\.com\/p\/([a-z0-9-]+)\.html/gi,
    replace: "https://www.11tik.com/$1",
  },
  {
    name: "localized-article",
    re: /https:\/\/([a-z]{2})\.11tik\.com\/l\/\1\/2026\/(?:\d{2}\/)?([a-z0-9-]+)\.html/gi,
    replace: "https://$1.11tik.com/l/$1/$2",
  },
  {
    name: "localized-utility",
    re: /https:\/\/([a-z]{2})\.11tik\.com\/l\/\1\/p\/([a-z0-9-]+)\.html/gi,
    replace: "https://$1.11tik.com/l/$1/$2",
  },
];

function walkJsonFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkJsonFiles(full, out);
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

function countLegacyMatches(text) {
  let total = 0;
  const byPattern = {};
  for (const { name, re } of LEGACY_PATTERNS) {
    const matches = [...String(text).matchAll(new RegExp(re.source, re.flags))];
    byPattern[name] = matches.length;
    total += matches.length;
  }
  return { total, byPattern };
}

function migrateText(text) {
  let out = String(text);
  for (const { re, replace } of LEGACY_PATTERNS) {
    out = out.replace(new RegExp(re.source, re.flags), replace);
  }
  return out;
}

function audit() {
  const files = walkJsonFiles(TRANSLATIONS_DIR);
  let total = 0;
  const affected = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const counts = countLegacyMatches(text);
    if (counts.total > 0) {
      total += counts.total;
      affected.push({ file: file.replace(/\\/g, "/").replace(`${ROOT.replace(/\\/g, "/")}/`, ""), ...counts });
    }
  }
  return { filesScanned: files.length, legacyLinks: total, affected };
}

function apply() {
  const files = walkJsonFiles(TRANSLATIONS_DIR);
  let changed = 0;
  let linksFixed = 0;
  for (const file of files) {
    const before = readFileSync(file, "utf8");
    const beforeCount = countLegacyMatches(before).total;
    if (!beforeCount) continue;
    const after = migrateText(before);
    if (after !== before) {
      writeFileSync(file, after, "utf8");
      changed += 1;
      linksFixed += beforeCount;
    }
  }
  return { filesScanned: files.length, filesChanged: changed, linksFixed };
}

const mode = process.argv[2] || "audit";
if (mode === "apply") {
  const result = apply();
  console.log(JSON.stringify({ mode, ...result, after: audit() }, null, 2));
} else {
  console.log(JSON.stringify({ mode: "audit", ...audit() }, null, 2));
}
