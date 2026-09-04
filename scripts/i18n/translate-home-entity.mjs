#!/usr/bin/env node
/**
 * Translate homepage entity clarity keys into src/i18n/catalog.json for target locales.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
const CATALOG_PATH = join(ROOT, "src", "i18n", "catalog.json");
const EN_PATH = join(TRANSLATIONS_ROOT, "home-entity", "en.json");

export const ENTITY_UI_KEYS = [
  "entityHeading",
  "entityIntro",
  "entityDoesHeading",
  "entityDoes1",
  "entityDoes2",
  "entityDoes3",
  "entityDoesNotHeading",
  "entityDoesNot1",
  "entityDoesNot2",
  "entityDoesNot3",
  "entityDoesNot4",
];

function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`);
}

export function readEntityEnFromCatalog(catalog = null) {
  const cat = catalog || JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const ui = cat.en?.ui || {};
  const out = {
    contentId: "home-entity",
    locale: "en",
    status: "ready",
    sourceHash: "phase-mhps-entity-v1",
  };
  for (const key of ENTITY_UI_KEYS) out[key] = ui[key] || "";
  return out;
}

export function ensureEntityEnArtifact() {
  const en = readEntityEnFromCatalog();
  writeJson(EN_PATH, en);
  return en;
}

export async function translateHomeEntityForLocale(locale, options = {}) {
  const en = options.en || ensureEntityEnArtifact();
  const force = Boolean(options.force);
  if (locale === "en") return en;

  const existing = loadTranslationArtifact("home-entity", locale);
  if (!force && existing?.status === "ready" && existing.sourceHash === en.sourceHash) {
    return existing;
  }

  const payload = { contentId: "home-entity", locale };
  for (const key of ENTITY_UI_KEYS) payload[key] = en[key];

  const { data } = await translateWithProvider(payload, locale, options.env || readProviderEnv());
  const artifact = {
    contentId: "home-entity",
    locale,
    status: "ready",
    sourceHash: en.sourceHash,
  };
  for (const key of ENTITY_UI_KEYS) {
    let value = String(data[key] || en[key] || "").trim();
    value = value.replace(/\b11\s*tik\b/gi, "11tik");
    artifact[key] = value;
  }
  saveTranslationArtifact(artifact);
  return artifact;
}

export function applyHomeEntityToCatalog(artifact, catalog = null) {
  const cat = catalog || JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  const code = artifact.locale || "en";
  if (!cat[code]) cat[code] = { ui: {} };
  if (!cat[code].ui) cat[code].ui = {};
  for (const key of ENTITY_UI_KEYS) {
    if (artifact[key]) cat[code].ui[key] = artifact[key];
  }
  return cat;
}

export async function translateAndApplyAllHomeEntity(options = {}) {
  const en = ensureEntityEnArtifact();
  let catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  catalog = applyHomeEntityToCatalog(en, catalog);

  const locales = options.locales || getTargetLocales();
  const results = [];
  for (const locale of locales) {
    try {
      const artifact = await translateHomeEntityForLocale(locale, { ...options, en });
      catalog = applyHomeEntityToCatalog(artifact, catalog);
      results.push({ locale, status: "ready" });
      console.log(`home-entity: ${locale} ready`);
    } catch (e) {
      results.push({ locale, status: "failed", error: String(e.message || e) });
      console.error(`home-entity: ${locale} FAILED`, e.message || e);
      if (!options.continueOnError) throw e;
    }
  }
  writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  return { results, catalogPath: CATALOG_PATH };
}

const isMain = process.argv[1]?.endsWith("translate-home-entity.mjs");
if (isMain) {
  if (process.env.TRANSLATE_ENABLED !== "1") {
    console.error("Set TRANSLATE_ENABLED=1 to run entity translation");
    process.exit(1);
  }
  translateAndApplyAllHomeEntity({ force: process.argv.includes("--force"), continueOnError: true })
    .then(({ results }) => {
      const failed = results.filter((r) => r.status === "failed");
      console.log(`home-entity done: ${results.length - failed.length} ok, ${failed.length} failed`);
      if (failed.length) process.exit(1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
