/**
 * Single source of truth for multilingual rollout locales.
 * Reads config/target-languages.json — not the full ISO 639-1 table.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gtxCodeForLocale } from "../../translator/locale/gtx-locale-map.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST_PATH = join(ROOT, "config", "target-languages.json");

let cached = null;

export function loadTargetLanguageManifest() {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  cached = raw;
  return raw;
}

/** Reset cache (tests). */
export function resetTargetLanguageCache() {
  cached = null;
}

export function getTargetLanguageEntries({ enabledOnly = true } = {}) {
  const manifest = loadTargetLanguageManifest();
  return (manifest.languages || []).filter((row) => (enabledOnly ? row.enabled !== false : true));
}

/** Enabled non-English target locale codes (sorted). */
export function getTargetLocales() {
  return getTargetLanguageEntries()
    .map((row) => row.code)
    .sort();
}

export function isTargetLocale(code) {
  return getTargetLocales().includes(code);
}

export function getTargetLanguage(code) {
  return getTargetLanguageEntries({ enabledOnly: false }).find((row) => row.code === code) || null;
}

export function getTier1Locales() {
  return getTargetLanguageEntries()
    .filter((row) => row.tier === 1)
    .map((row) => row.code)
    .sort();
}

export function getTier2Locales() {
  return getTargetLanguageEntries()
    .filter((row) => row.tier === 2)
    .map((row) => row.code)
    .sort();
}

export function getUnsupportedTargetCandidates() {
  return loadTargetLanguageManifest().unsupportedTargetCandidates || [];
}

/** Verify every enabled target maps to GTX; throw if not. */
export function assertAllTargetsHaveGtxMapping() {
  const missing = [];
  for (const row of getTargetLanguageEntries()) {
    const gtx = gtxCodeForLocale(row.code) || row.googleTranslateCode;
    if (!gtxCodeForLocale(row.code)) {
      missing.push({ code: row.code, declared: row.googleTranslateCode });
    }
  }
  if (missing.length) {
    throw new Error(
      `TARGET_LANGUAGES missing GTX mapping: ${missing.map((m) => m.code).join(", ")}`,
    );
  }
  return true;
}

export function targetLanguageSummary() {
  const locales = getTargetLocales();
  return {
    sourceLanguage: loadTargetLanguageManifest().sourceLanguage || "en",
    targetCount: locales.length,
    tier1: getTier1Locales(),
    tier2: getTier2Locales(),
    locales,
    unsupportedCandidates: getUnsupportedTargetCandidates(),
  };
}
