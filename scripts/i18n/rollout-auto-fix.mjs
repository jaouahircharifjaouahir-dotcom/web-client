#!/usr/bin/env node
/**
 * Reset failed translation artifacts that are fixable with current pipeline code.
 * Does NOT touch checkpoint or stats — only removes stale failed *.json files.
 */
import { existsSync, unlinkSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentInventory } from "./content-inventory.mjs";
import { getTargetLocales } from "./target-languages.mjs";
import {
  loadTranslationArtifact,
  readSourceHash,
  translationArtifactPath,
} from "./translation-store.mjs";
import { validateTranslationArtifact } from "./validate-artifact.mjs";
import { loadStructuredSourceFromItem } from "./extract-source.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOG = join(ROOT, "tmp", "i18n-rollout-log.jsonl");
const OUT = join(ROOT, "tmp", "i18n-rollout-autofix.json");

const FIXABLE_PREFIXES = ["preserve:missing-token:"];

function recentFailures(sinceMs) {
  if (!existsSync(LOG)) return [];
  const lines = readFileSync(LOG, "utf8").trim().split("\n").slice(-800);
  const out = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (!e.ok && e.at && Date.parse(e.at) >= sinceMs) out.push(e);
    } catch {
      /* skip */
    }
  }
  return out;
}

function hasRealImages(artifact) {
  return Array.isArray(artifact?.images) && artifact.images.some((img) => String(img?.src || "").trim());
}

/** Would current extract-source produce a non-empty description? */
function sourceDescriptionOk(item) {
  try {
    const loaded = loadStructuredSourceFromItem(item);
    return Boolean(String(loaded?.structured?.description || "").trim());
  } catch {
    return false;
  }
}

function isFixable(artifact, item, errors) {
  if (!errors?.length) return false;
  const onlyFixable = errors.every((e) => {
    if (e === "missing-imageAlt") return !hasRealImages(artifact);
    if (e === "empty-description") return sourceDescriptionOk(item);
    if (FIXABLE_PREFIXES.some((p) => e.startsWith(p))) return true;
    return false;
  });
  return onlyFixable;
}

function resetArtifact(contentId, locale) {
  const path = translationArtifactPath(contentId, locale);
  if (existsSync(path)) {
    unlinkSync(path);
    return true;
  }
  return false;
}

const inventory = buildContentInventory();
const byId = new Map(inventory.map((i) => [i.contentId, i]));
const locales = getTargetLocales();
const since = Date.now() - 5 * 60 * 1000;
const recent = recentFailures(since);

const reset = [];
const skipped = [];
const unknownRecent = [];

for (const item of inventory.filter((i) => i.localizable)) {
  for (const locale of locales) {
    const artifact = loadTranslationArtifact(item.contentId, locale);
    if (artifact?.status !== "failed") continue;

    const errors = artifact.validationErrors || (artifact.error ? [artifact.error] : []);
    const sourceHash = readSourceHash(item.sourceRel);
    const validation = validateTranslationArtifact(artifact, {
      contentId: item.contentId,
      locale,
      currentSourceHash: sourceHash,
      contentType: item.type === "article" ? "article" : "utility",
    });
    const allErrors = [...new Set([...errors, ...validation.errors])];

    if (isFixable(artifact, item, allErrors)) {
      if (resetArtifact(item.contentId, locale)) {
        reset.push({ contentId: item.contentId, locale, errors: allErrors.slice(0, 3) });
      }
    } else {
      skipped.push({ contentId: item.contentId, locale, errors: allErrors.slice(0, 3) });
    }
  }
}

for (const f of recent) {
  const item = byId.get(f.contentId);
  if (!item) continue;
  const artifact = loadTranslationArtifact(f.contentId, f.locale);
  if (!artifact || artifact.status !== "failed") continue;
  const errors = artifact.validationErrors || (artifact.error ? [artifact.error] : []);
  if (!isFixable(artifact, item, errors)) {
    unknownRecent.push({ contentId: f.contentId, locale: f.locale, at: f.at, errors: errors.slice(0, 3) });
  }
}

const report = {
  at: new Date().toISOString(),
  resetCount: reset.length,
  skippedCount: skipped.length,
  recentFailures5m: recent.length,
  unknownRecentCount: unknownRecent.length,
  reset: reset.slice(0, 50),
  unknownRecent: unknownRecent.slice(0, 20),
};

mkdirSync(join(ROOT, "tmp"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);
