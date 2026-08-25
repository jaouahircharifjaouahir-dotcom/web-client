/**
 * Pre-rollout workload + cost estimation for Google Cloud Translation.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";
import { extractStructuredSource } from "./extract-source.mjs";
import { countPayloadCharacters } from "./dom-translate.mjs";
import { planTranslationWork } from "./translate-pipeline.mjs";
import { buildLocaleCoverage } from "./google-locale-map.mjs";
import { readProviderEnv } from "./provider-config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function buildPayloadFromStructured(structured) {
  return {
    title: structured.title,
    description: structured.description,
    h1: structured.h1,
    ogTitle: structured.ogTitle,
    ogDescription: structured.ogDescription,
    imageAlt: structured.imageAlt,
    faqHeading: structured.faqHeading,
    images: structured.images,
    sections: structured.sections,
    faq: structured.faq,
    conclusionHtml: structured.conclusionHtml,
    bioHtml: structured.bioHtml,
  };
}

export function estimateTranslationWorkload(options = {}) {
  const inventory = options.inventory ?? buildContentInventory();
  const items = localizableContent(inventory);
  const plan = planTranslationWork({ inventory });
  const coverage = buildLocaleCoverage();
  const env = options.env ?? readProviderEnv();

  const perItem = [];
  let totalSourceCharacters = 0;

  for (const item of items) {
    if (!item.sourceRel) continue;
    const abs = join(ROOT, item.sourceRel);
    if (!existsSync(abs)) continue;
    const raw = readFileSync(abs, "utf8");
    const structured = extractStructuredSource(raw, { contentType: item.type });
    const payload = buildPayloadFromStructured(structured);
    const chars = countPayloadCharacters(payload);
    perItem.push({ contentId: item.contentId, type: item.type, sourceCharacters: chars });
    totalSourceCharacters += chars;
  }

  const avgChars = perItem.length ? Math.round(totalSourceCharacters / perItem.length) : 0;
  const queuedJobs = plan.queue.length;
  const estimatedTranslationCharacters = totalSourceCharacters * queuedJobs / Math.max(perItem.length, 1);
  // Each job translates one content item once — multiply per-item chars by queued jobs
  const totalCharsAllJobs = perItem.reduce((sum, row) => {
    const jobsForItem = plan.queue.filter((q) => q.contentId === row.contentId).length;
    return sum + row.sourceCharacters * jobsForItem;
  }, 0);

  const pricePerMillion = Number(env.googlePricePerMillionChars || 20);
  const estimatedCostUsd = (totalCharsAllJobs / 1_000_000) * pricePerMillion;

  return {
    contentItems: items.length,
    itemsWithSource: perItem.length,
    projectLocales: coverage.totalProjectLocales,
    googleMappedLocales: coverage.supportedCount,
    unsupportedLocales: coverage.unsupportedCount,
    unsupportedLocaleList: coverage.unsupported.map((u) => u.locale),
    theoreticalPages: items.length * coverage.totalProjectLocales,
    theoreticalMappedPages: items.length * coverage.supportedCount,
    readySkipped: plan.summary.ready,
    queuedJobs,
    missing: plan.summary.missing,
    stale: plan.summary.stale,
    failed: plan.summary.failed,
    totalSourceCharactersUniqueEnglish: totalSourceCharacters,
    averageCharactersPerContentItem: avgChars,
    estimatedTranslationCharactersAllJobs: totalCharsAllJobs,
    pricing: {
      pricePerMillionCharactersUsd: pricePerMillion,
      note: "Approximate NMT list pricing; actual billing depends on Google Cloud account tier and model.",
    },
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(2)),
    perItem,
  };
}

export function formatCostConfirmationSummary(estimate) {
  return [
    "=== Google Cloud Translation cost confirmation ===",
    `Content items: ${estimate.contentItems}`,
    `Queued translation jobs: ${estimate.queuedJobs}`,
    `Ready/current skipped: ${estimate.readySkipped}`,
    `Unique English source characters: ${estimate.totalSourceCharactersUniqueEnglish.toLocaleString("en-US")}`,
    `Estimated translation characters (all jobs): ${estimate.estimatedTranslationCharactersAllJobs.toLocaleString("en-US")}`,
    `Pricing assumption: $${estimate.pricing.pricePerMillionCharactersUsd}/1M characters`,
    `Estimated cost (USD): $${estimate.estimatedCostUsd.toLocaleString()}`,
    `Google locale coverage: ${estimate.googleMappedLocales}/${estimate.projectLocales}`,
    estimate.unsupportedLocales
      ? `BLOCKED: ${estimate.unsupportedLocales} locales lack Google mapping: ${estimate.unsupportedLocaleList.join(", ")}`
      : "All project locales mapped.",
  ].join("\n");
}
