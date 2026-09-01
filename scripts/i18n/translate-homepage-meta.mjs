#!/usr/bin/env node
/**
 * Translate homepage SEO metadata (title, description, hero copy) for en + 37 target locales.
 * Applies to workers/locale-meta.json and src/i18n/catalog.json (target locales only).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getTargetLocales } from "./target-languages.mjs";
import {
  loadTranslationArtifact,
  saveTranslationArtifact,
  TRANSLATIONS_ROOT,
} from "./translation-store.mjs";
import { translateWithProvider } from "./provider.mjs";
import { readProviderEnv } from "./provider-config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EN_PATH = join(TRANSLATIONS_ROOT, "home-meta", "en.json");
const LOCALE_META_PATH = join(ROOT, "workers", "locale-meta.json");
const CATALOG_PATH = join(ROOT, "src", "i18n", "catalog.json");

export const HOME_META_EN = JSON.parse(readFileSync(EN_PATH, "utf8"));

/** Ensure brand suffix stays literal 11tik (GTX sometimes corrupts it). */
export function ensureBrandSuffix(title) {
  let t = String(title || "")
    .trim()
    .replace(/\|\s*\[\[[^\]]+\]\]\s*$/i, "")
    .replace(/\|\s*11\s*tik\s*$/i, " | 11tik")
    .trim();
  if (!/\|\s*11tik\s*$/i.test(t)) t = `${t} | 11tik`;
  return t.replace(/\s+/g, " ").trim();
}

/** Derive visible H1/intro from localized SEO title + description. */
export function normalizeHeroFromMeta(artifact) {
  const title = ensureBrandSuffix(artifact?.title || "");
  const description = String(artifact?.description || "").trim();
  const brandRe = /\s*\|\s*11tik\s*$/i;
  const core = title.replace(brandRe, "").trim();
  const heroTitle = core.split(/\s[—–-]\s/)[0]?.trim() || core || artifact?.heroTitle || "";
  return {
    ...artifact,
    title,
    heroTitle,
    heroIntro: description || artifact?.heroIntro || "",
  };
}

export function loadHomeMetaArtifact(locale) {
  const code = String(locale || "en").toLowerCase();
  if (code === "en") return HOME_META_EN;
  return loadTranslationArtifact("home-meta", code);
}

export async function translateHomeMetaForLocale(locale, options = {}) {
  const en = HOME_META_EN;
  const force = Boolean(options.force);
  if (locale === "en") return en;

  const existing = loadTranslationArtifact("home-meta", locale);
  if (!force && existing?.status === "ready" && existing.sourceHash === en.sourceHash) {
    return existing;
  }

  const payload = {
    contentId: "home-meta",
    locale,
    title: en.title,
    description: en.description,
    heroTitle: en.heroTitle,
    heroIntro: en.heroIntro,
  };
  const { data } = await translateWithProvider(payload, locale, options.env || readProviderEnv());
  const artifact = normalizeHeroFromMeta({
    ...data,
    contentId: "home-meta",
    locale,
    status: "ready",
    sourceHash: en.sourceHash,
  });
  saveTranslationArtifact(artifact);
  return artifact;
}

export function applyHomeMetaToLocaleMeta(artifact, localeMeta = null) {
  const meta = localeMeta || JSON.parse(readFileSync(LOCALE_META_PATH, "utf8"));
  const code = artifact.locale || "en";
  if (!meta[code]) return meta;
  meta[code] = {
    ...meta[code],
    title: artifact.title,
    description: artifact.description,
  };
  return meta;
}

export function applyHomeMetaToCatalog(artifact, catalog = null) {
  const cat = catalog || JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const code = artifact.locale || "en";
  if (!cat[code]?.ui) return cat;
  const normalized = normalizeHeroFromMeta(artifact);
  cat[code].ui.heroTitle = normalized.heroTitle;
  cat[code].ui.heroIntro = normalized.heroIntro;
  return cat;
}

export async function translateAndApplyAllHomeMeta(options = {}) {
  const locales = ["en", ...getTargetLocales()];
  let localeMeta = JSON.parse(readFileSync(LOCALE_META_PATH, "utf8"));
  let catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const results = [];

  for (const locale of locales) {
    try {
      const artifact = normalizeHeroFromMeta(
        locale === "en" ? HOME_META_EN : await translateHomeMetaForLocale(locale, options),
      );
      localeMeta = applyHomeMetaToLocaleMeta(artifact, localeMeta);
      if (locale === "en" || getTargetLocales().includes(locale)) {
        catalog = applyHomeMetaToCatalog(artifact, catalog);
      }
      results.push({ locale, status: "ready", titleLen: artifact.title?.length ?? 0 });
      console.log(`home-meta: ${locale} applied`);
    } catch (e) {
      results.push({ locale, status: "failed", error: String(e.message || e) });
      console.error(`home-meta: ${locale} FAILED`, e.message || e);
      if (!options.continueOnError) throw e;
    }
  }

  if (!options.dryRun) {
    writeFileSync(LOCALE_META_PATH, `${JSON.stringify(localeMeta, null, 2)}\n`);
    writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  }
  return results;
}

const isMain = process.argv[1]?.endsWith("translate-homepage-meta.mjs");
if (isMain) {
  if (process.env.TRANSLATE_ENABLED !== "1") {
    console.error("Set TRANSLATE_ENABLED=1 to run homepage meta translation");
    process.exit(1);
  }
  translateAndApplyAllHomeMeta({ force: process.argv.includes("--force") }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
