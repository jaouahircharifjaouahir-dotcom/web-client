/**
 * Post-build audit: every static article/utility/locale-home HTML must include #yte-site-header.
 * Usage: node scripts/i18n/audit-site-header-coverage.mjs [dist-assets]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { getTargetLocales } from "./target-languages.mjs";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const staged = process.argv[2] ? join(ROOT, process.argv[2]) : join(ROOT, "dist-assets");

function walkHtml(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkHtml(abs, out);
    else if (name.endsWith(".html")) out.push(abs);
  }
  return out;
}

function hasHeader(html) {
  return /id=["']yte-site-header["']/.test(html);
}

const missing = [];
const present = [];
const inventory = localizableContent(buildContentInventory());

for (const item of inventory) {
  const rel = String(item.canonicalPath || "").replace(/^\//, "");
  const enPath = join(staged, rel);
  if (!existsSync(enPath)) {
    missing.push({ path: rel, reason: "english-file-missing" });
    continue;
  }
  const html = readFileSync(enPath, "utf8");
  if (hasHeader(html)) present.push(rel);
  else missing.push({ path: rel, reason: "english-no-header" });
}

for (const locale of getTargetLocales()) {
  const localeRoot = join(staged, "l", locale);
  const files = walkHtml(localeRoot);
  for (const abs of files) {
    const rel = relative(staged, abs).replace(/\\/g, "/");
    const html = readFileSync(abs, "utf8");
    if (hasHeader(html)) present.push(rel);
    else missing.push({ path: rel, reason: "locale-no-header" });
  }
}

for (const home of ["index.html", ...getTargetLocales().map((c) => `l/${c}/index.html`)]) {
  const abs = join(staged, home);
  if (!existsSync(abs)) {
    missing.push({ path: home, reason: "home-missing" });
    continue;
  }
  const html = readFileSync(abs, "utf8");
  if (hasHeader(html)) present.push(home);
  else missing.push({ path: home, reason: "home-no-header" });
}

// All locale SPA shells (ISO hosts), not only TARGET_LANGUAGES.
const localeShellDir = join(staged, "l");
if (existsSync(localeShellDir)) {
  for (const code of readdirSync(localeShellDir)) {
    const home = join(localeShellDir, code, "index.html");
    if (!existsSync(home)) continue;
    const rel = `l/${code}/index.html`;
    const html = readFileSync(home, "utf8");
    if (hasHeader(html)) present.push(rel);
    else missing.push({ path: rel, reason: "iso-home-no-header" });
  }
}

const uniquePresent = [...new Set(present)];
const uniqueMissing = missing.filter(
  (row, index, arr) => arr.findIndex((x) => x.path === row.path) === index,
);

const report = {
  staged: relative(ROOT, staged).replace(/\\/g, "/"),
  withHeader: uniquePresent.length,
  missingHeader: uniqueMissing.length,
  missing: uniqueMissing,
  ok: uniqueMissing.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
