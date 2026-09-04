#!/usr/bin/env node
/**
 * Translate homepage caps + hubs sections for all target locales.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getTargetLocales, isTargetLocale } from "./target-languages.mjs";
import {
  loadTranslationArtifact,
  saveTranslationArtifact,
  TRANSLATIONS_ROOT,
} from "./translation-store.mjs";
import { translateWithProvider } from "./provider.mjs";
import { readProviderEnv } from "./provider-config.mjs";
import { localizeHomeFaqAnswerHtml } from "./home-faq-links.mjs";
import { buildContentInventory } from "./content-inventory.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EN_PATH = join(TRANSLATIONS_ROOT, "home-caps-hubs", "en.json");
const PUBLIC_DIR = join(ROOT, "public", "i18n", "home-caps-hubs");

function localizeArtifactHtml(artifact, locale, inventory) {
  const mapItems = (items) =>
    (items || []).map((row) => ({
      ...row,
      html: localizeHomeFaqAnswerHtml(row.html || "", locale, inventory),
    }));
  return {
    ...artifact,
    capsItems: mapItems(artifact.capsItems),
    hubsItems: mapItems(artifact.hubsItems),
  };
}

export function loadHomeCapsHubsArtifact(locale) {
  const code = String(locale || "en").toLowerCase();
  if (code === "en") {
    return existsSync(EN_PATH) ? JSON.parse(readFileSync(EN_PATH, "utf8")) : null;
  }
  return loadTranslationArtifact("home-caps-hubs", code);
}

export async function translateHomeCapsHubsForLocale(locale, options = {}) {
  const en = JSON.parse(readFileSync(EN_PATH, "utf8"));
  const inventory = options.inventory || buildContentInventory();
  const force = Boolean(options.force);
  if (locale === "en") return en;

  const existing = loadTranslationArtifact("home-caps-hubs", locale);
  if (!force && existing?.status === "ready" && existing.sourceHash === en.sourceHash) {
    return existing;
  }

  const { data } = await translateWithProvider(structuredClone(en), locale, options.env || readProviderEnv());
  const artifact = localizeArtifactHtml(
    {
      ...data,
      contentId: "home-caps-hubs",
      locale,
      status: "ready",
      sourceHash: en.sourceHash,
    },
    locale,
    inventory,
  );
  saveTranslationArtifact(artifact);
  return artifact;
}

export async function translateAllHomeCapsHubs(options = {}) {
  const locales = options.locales || getTargetLocales();
  const inventory = options.inventory || buildContentInventory();
  const results = [];
  for (const locale of locales) {
    try {
      const artifact = await translateHomeCapsHubsForLocale(locale, { ...options, inventory });
      results.push({
        locale,
        status: "ready",
        caps: artifact.capsItems?.length ?? 0,
        hubs: artifact.hubsItems?.length ?? 0,
      });
      console.log(`home-caps-hubs: ${locale} ready`);
    } catch (e) {
      results.push({ locale, status: "failed", error: String(e.message || e) });
      console.error(`home-caps-hubs: ${locale} FAILED`, e.message || e);
      if (!options.continueOnError) throw e;
    }
  }
  return results;
}

function toPublicDoc(artifact) {
  if (!artifact?.capsItems?.length || !artifact?.hubsItems?.length) return null;
  return {
    capsHeading: artifact.capsHeading || "",
    capsItems: artifact.capsItems.map((row) => ({ html: row.html || "" })),
    hubsHeading: artifact.hubsHeading || "",
    hubsItems: artifact.hubsItems.map((row) => ({ html: row.html || "" })),
  };
}

export function writeHomeCapsHubsPublicFiles() {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  const locales = ["en", ...getTargetLocales()];
  let count = 0;
  for (const locale of locales) {
    const artifact = loadHomeCapsHubsArtifact(locale);
    const doc = toPublicDoc(artifact);
    if (!doc) {
      if (locale !== "en" && isTargetLocale(locale)) {
        const enDoc = toPublicDoc(loadHomeCapsHubsArtifact("en"));
        if (enDoc) {
          writeFileSync(join(PUBLIC_DIR, `${locale}.json`), `${JSON.stringify(enDoc, null, 2)}\n`);
          count += 1;
        }
      }
      continue;
    }
    writeFileSync(join(PUBLIC_DIR, `${locale}.json`), `${JSON.stringify(doc, null, 2)}\n`);
    count += 1;
  }
  return { outDir: PUBLIC_DIR, count };
}

const isMain = process.argv[1]?.endsWith("translate-home-caps-hubs.mjs");
if (isMain) {
  if (process.env.TRANSLATE_ENABLED !== "1") {
    console.error("Set TRANSLATE_ENABLED=1 to run caps/hubs translation");
    process.exit(1);
  }
  translateAllHomeCapsHubs({ force: process.argv.includes("--force"), continueOnError: true })
    .then((results) => {
      writeHomeCapsHubsPublicFiles();
      const failed = results.filter((r) => r.status === "failed");
      console.log(`home-caps-hubs done: ${results.length - failed.length} ok, ${failed.length} failed`);
      if (failed.length) process.exit(1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
