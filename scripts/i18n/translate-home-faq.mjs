#!/usr/bin/env node
/**
 * Translate homepage FAQ to all 37 target locales (semantic GTX + localized links).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getTargetLocales, isTargetLocale } from "./target-languages.mjs";
import {
  loadTranslationArtifact,
  saveTranslationArtifact,
  translationArtifactPath,
  TRANSLATIONS_ROOT,
} from "./translation-store.mjs";
import { translateWithProvider } from "./provider.mjs";
import { readProviderEnv } from "./provider-config.mjs";
import { localizeHomeFaqAnswerHtml } from "./home-faq-links.mjs";
import { buildContentInventory } from "./content-inventory.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EN_PATH = join(TRANSLATIONS_ROOT, "home-faq", "en.json");

function toHomeFaqDoc(artifact) {
  return {
    heading: artifact.faqHeading || "FAQ",
    items: (artifact.faq || []).map((row) => ({
      question: row.question,
      answerHtml: row.answerHtml || row.answer || "",
    })),
  };
}

export async function translateHomeFaqForLocale(locale, options = {}) {
  const en = JSON.parse(readFileSync(EN_PATH, "utf8"));
  const inventory = options.inventory || buildContentInventory();
  const force = Boolean(options.force);

  if (locale === "en") return en;

  const existing = loadTranslationArtifact("home-faq", locale);
  if (!force && existing?.status === "ready" && existing.sourceHash === en.sourceHash) {
    return existing;
  }

  const { data } = await translateWithProvider(structuredClone(en), locale, options.env || readProviderEnv());
  const artifact = {
    ...data,
    contentId: "home-faq",
    locale,
    status: "ready",
    sourceHash: en.sourceHash,
    faq: (data.faq || []).map((row) => ({
      ...row,
      answerHtml: localizeHomeFaqAnswerHtml(row.answerHtml || row.answer, locale, inventory),
      answer: localizeHomeFaqAnswerHtml(row.answer || "", locale, inventory).replace(/<[^>]+>/g, ""),
    })),
  };
  saveTranslationArtifact(artifact);
  return artifact;
}

export async function translateAllHomeFaqs(options = {}) {
  const locales = options.locales || getTargetLocales();
  const results = [];
  for (const locale of locales) {
    try {
      const artifact = await translateHomeFaqForLocale(locale, options);
      results.push({ locale, status: "ready", items: artifact.faq?.length ?? 0 });
      console.log(`home-faq: ${locale} ready (${artifact.faq?.length ?? 0} items)`);
    } catch (e) {
      results.push({ locale, status: "failed", error: String(e.message || e) });
      console.error(`home-faq: ${locale} FAILED`, e.message || e);
      if (!options.continueOnError) throw e;
    }
  }
  return results;
}

export function loadHomeFaqArtifact(locale) {
  const code = String(locale || "en").toLowerCase();
  if (code === "en") {
    return existsSync(EN_PATH) ? JSON.parse(readFileSync(EN_PATH, "utf8")) : null;
  }
  return loadTranslationArtifact("home-faq", code);
}

export function homeFaqDocForLocale(locale) {
  const code = String(locale || "en").toLowerCase();
  const artifact = loadHomeFaqArtifact(code);
  if (!artifact?.faq?.length) {
    if (code === "en") return null;
    if (isTargetLocale(code)) return homeFaqDocForLocale("en");
    return null;
  }
  return toHomeFaqDoc(artifact);
}

const isMain = process.argv[1]?.endsWith("translate-home-faq.mjs");
if (isMain) {
  if (process.env.TRANSLATE_ENABLED !== "1") {
    console.error("Set TRANSLATE_ENABLED=1 to run FAQ translation");
    process.exit(1);
  }
  translateAllHomeFaqs({ force: process.argv.includes("--force") }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
