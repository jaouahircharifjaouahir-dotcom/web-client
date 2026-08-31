/**
 * Split src/i18n/catalog.json into:
 * - src/i18n/catalog-en.json (bundled English UI only)
 * - public/i18n/ui/{locale}.json (runtime fetch for non-en locales)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(join(ROOT, "src", "i18n", "catalog.json"), "utf8"));

export function splitUiCatalog() {
  writeFileSync(join(ROOT, "src", "i18n", "catalog-en.json"), `${JSON.stringify(catalog.en, null, 2)}\n`);
  const outDir = join(ROOT, "public", "i18n", "ui");
  mkdirSync(outDir, { recursive: true });
  for (const [locale, pack] of Object.entries(catalog)) {
    if (locale === "en") continue;
    writeFileSync(join(outDir, `${locale}.json`), `${JSON.stringify(pack, null, 0)}\n`);
  }
  console.log(`[ui-catalog] en bundled; ${Object.keys(catalog).length - 1} locale file(s) → public/i18n/ui/`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  splitUiCatalog();
}
