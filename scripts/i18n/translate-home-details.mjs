#!/usr/bin/env node
/**
 * Translate homepage <details class="yte-panel"> (Copyright & Usage) for all target locales.
 * Seeds from existing pageString packs when complete; otherwise GTX from EN.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getTargetLocales } from "./target-languages.mjs";
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
const EN_PATH = join(TRANSLATIONS_ROOT, "home-details", "en.json");
const PUBLIC_DIR = join(ROOT, "public", "i18n", "home-details");
const PACK_PATH = join(ROOT, "src", "i18n", "home-details-pack.json");

function writeJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`);
}

export function loadHomeDetailsArtifact(locale) {
  const code = String(locale || "en").toLowerCase();
  if (code === "en") {
    return existsSync(EN_PATH) ? JSON.parse(readFileSync(EN_PATH, "utf8")) : null;
  }
  return loadTranslationArtifact("home-details", code);
}

function localizeArtifact(artifact, locale, inventory) {
  return {
    ...artifact,
    items: (artifact.items || []).map((row) => ({
      ...row,
      bodyHtml: localizeHomeFaqAnswerHtml(row.bodyHtml || "", locale, inventory),
    })),
  };
}

function artifactFromPageStrings(locale, pageString, en) {
  const summary = pageString(locale, "legalTitle");
  const items = [
    {
      id: "legal-q1",
      heading: pageString(locale, "legalQ1"),
      bodyHtml: pageString(locale, "legalA1"),
    },
    {
      id: "legal-q2",
      heading: pageString(locale, "legalQ2"),
      bodyHtml: pageString(locale, "legalA2"),
    },
    {
      id: "legal-q3",
      heading: pageString(locale, "legalQ3"),
      bodyHtml: pageString(locale, "legalA3"),
    },
  ];
  const qaEnglish = [0, 1, 2].filter(
    (i) =>
      items[i].heading === en.items[i].heading || items[i].bodyHtml === en.items[i].bodyHtml,
  ).length;
  return { summary, items, qaEnglish };
}

async function resolvePageString(options) {
  if (options.pageString) return options.pageString;
  try {
    const mod = await import(pathToFileURL(join(ROOT, "src/i18n/pages.ts")).href);
    return mod.pageString;
  } catch {
    return null;
  }
}

export async function translateHomeDetailsForLocale(locale, options = {}) {
  const en = JSON.parse(readFileSync(EN_PATH, "utf8"));
  const inventory = options.inventory || buildContentInventory();
  const force = Boolean(options.force);
  if (locale === "en") return en;

  const existing = loadTranslationArtifact("home-details", locale);
  if (!force && existing?.status === "ready" && existing.sourceHash === en.sourceHash) {
    return existing;
  }

  const pageString = await resolvePageString(options);
  if (pageString && !force) {
    const seeded = artifactFromPageStrings(locale, pageString, en);
    if (seeded.qaEnglish === 0) {
      const artifact = localizeArtifact(
        {
          contentId: "home-details",
          locale,
          status: "ready",
          sourceHash: en.sourceHash,
          blockId: en.blockId,
          order: en.order,
          summary: seeded.summary,
          items: seeded.items,
        },
        locale,
        inventory,
      );
      saveTranslationArtifact(artifact);
      return artifact;
    }
  }

  const payload = {
    contentId: "home-details",
    locale,
    summary: en.summary,
    items: en.items.map((row) => ({
      id: row.id,
      heading: row.heading,
      bodyHtml: row.bodyHtml,
    })),
  };

  const { data } = await translateWithProvider(payload, locale, options.env || readProviderEnv());
  const items = (data.items || en.items).map((row, i) => ({
    id: en.items[i].id,
    heading: String(row.heading || en.items[i].heading).trim(),
    bodyHtml: String(row.bodyHtml || en.items[i].bodyHtml).trim(),
  }));

  const artifact = localizeArtifact(
    {
      contentId: "home-details",
      locale,
      status: "ready",
      sourceHash: en.sourceHash,
      blockId: en.blockId,
      order: en.order,
      summary: String(data.summary || en.summary).trim(),
      items,
    },
    locale,
    inventory,
  );
  saveTranslationArtifact(artifact);
  return artifact;
}

export async function translateAllHomeDetails(options = {}) {
  const locales = options.locales || getTargetLocales();
  const inventory = options.inventory || buildContentInventory();
  const results = [];
  for (const locale of locales) {
    try {
      const artifact = await translateHomeDetailsForLocale(locale, { ...options, inventory });
      results.push({ locale, status: "ready", summary: artifact.summary });
      console.log(`[home-details] ${locale} ready`);
    } catch (err) {
      results.push({ locale, status: "error", error: String(err?.message || err) });
      console.error(`[home-details] ${locale} FAIL`, err);
    }
  }
  return results;
}

export function writeHomeDetailsPublicFiles() {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  const locales = ["en", ...getTargetLocales()];
  const pack = {};
  let count = 0;
  for (const locale of locales) {
    const artifact = loadHomeDetailsArtifact(locale);
    if (!artifact?.items?.length) continue;
    const doc = {
      blockId: artifact.blockId || "yte-home-details-legal",
      summary: artifact.summary,
      items: artifact.items.map((row) => ({
        id: row.id,
        heading: row.heading,
        bodyHtml: row.bodyHtml,
      })),
    };
    writeJson(join(PUBLIC_DIR, `${locale}.json`), doc);
    pack[locale] = {
      legalTitle: artifact.summary,
      legalQ1: artifact.items[0]?.heading || "",
      legalA1: String(artifact.items[0]?.bodyHtml || "").replace(/<[^>]+>/g, ""),
      legalQ2: artifact.items[1]?.heading || "",
      legalA2: String(artifact.items[1]?.bodyHtml || "").replace(/<[^>]+>/g, ""),
      legalQ3: artifact.items[2]?.heading || "",
      legalA3: String(artifact.items[2]?.bodyHtml || "").replace(/<[^>]+>/g, ""),
    };
    count += 1;
  }
  writeJson(PACK_PATH, pack);
  return { outDir: PUBLIC_DIR, packPath: PACK_PATH, count };
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("translate-home-details.mjs");
if (isMain) {
  const force = process.argv.includes("--force");
  const results = await translateAllHomeDetails({ force });
  const written = writeHomeDetailsPublicFiles();
  const failed = results.filter((r) => r.status !== "ready");
  console.log(
    JSON.stringify(
      { ready: results.length - failed.length, failed: failed.length, written, failedLocales: failed },
      null,
      2,
    ),
  );
  if (failed.length) process.exitCode = 1;
}
