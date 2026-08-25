#!/usr/bin/env node
/**
 * Dry-run multilingual inventory + publishability report.
 * Does NOT call translation APIs. Does NOT deploy.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";
import { scanPublishability, writeDryRunReport } from "./publish.mjs";
import { planTranslationWork } from "./translate-pipeline.mjs";
import { providerConfigReport } from "./provider-config.mjs";
import { getTargetLocales, targetLanguageSummary } from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(ROOT, "tmp");
mkdirSync(outDir, { recursive: true });

const inventory = buildContentInventory();
const localizable = localizableContent(inventory);
const targets = getTargetLocales();
const manifest = scanPublishability(inventory);
const plan = planTranslationWork({ inventory, locales: targets });
const avgHtmlBytes = 20_000;
const theoreticalPages = localizable.length * targets.length;

const report = {
  generatedAt: manifest.generatedAt,
  architecture: {
    generalized: true,
    urlPattern: "https://{lang}.11tik.com/l/{lang}{canonicalPath}",
    translationRoot: "content/translations/<contentId>/<locale>.json",
    targetManifest: "config/target-languages.json",
    provider: "chrome_gtx",
    statuses: ["draft", "ready", "stale", "failed"],
    publishRule: "status=ready AND sourceHash=current AND structural validation",
    workerFirst: "localized /l/{lang}/… pages remain outside run_worker_first",
  },
  inventory: {
    total: inventory.length,
    localizable: localizable.length,
    articles: localizable.filter((i) => i.type === "article").length,
    utilities: localizable.filter((i) => i.type === "utility").length,
    items: localizable.map((i) => ({
      contentId: i.contentId,
      type: i.type,
      canonicalPath: i.canonicalPath,
      sourceRel: i.sourceRel,
      hasSource: Boolean(i.sourceRel),
    })),
  },
  targetLanguages: targetLanguageSummary(),
  theoretical: {
    localizedPages: theoreticalPages,
    estimatedHtmlBytesIfAllReady: theoreticalPages * avgHtmlBytes,
    estimatedHtmlMiBIfAllReady: Number(((theoreticalPages * avgHtmlBytes) / (1024 * 1024)).toFixed(1)),
  },
  dryRunGeneration: {
    readyTranslations: manifest.counts.ready,
    staleTranslations: manifest.counts.stale,
    missingTranslations: manifest.counts.missing,
    draftTranslations: manifest.counts.draft,
    failedTranslations: manifest.counts.failed,
    invalidTranslations: manifest.counts.invalid,
    generatedPagesWouldBe: manifest.counts.ready,
    skippedPagesWouldBe: theoreticalPages - manifest.counts.ready,
    apiCallsWouldBe: plan.apiCallsWouldBe,
  },
  publishability: manifest.counts,
  provider: providerConfigReport(),
  translationPlan: {
    apiCallsWouldBe: plan.apiCallsWouldBe,
    summary: plan.summary,
  },
  recommendation: "Run npm run i18n:pilot (1 article × all TARGET_LANGUAGES), then approve mass rollout.",
};

const outPath = join(outDir, "i18n-dry-run-report.json");
writeDryRunReport(outPath, report);
console.log(JSON.stringify(report, null, 2));
console.log(`\nWrote ${outPath}`);
