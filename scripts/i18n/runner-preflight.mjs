#!/usr/bin/env node
/**
 * Preflight for run-translations.bat / run-local-rollout.ps1
 * Writes tmp/i18n-runner-preflight.json — does not translate.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  targetLanguageSummary,
  assertAllTargetsHaveGtxMapping,
  getTargetLocales,
} from "./target-languages.mjs";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";
import { planTranslationWork } from "./translate-pipeline.mjs";
import { extensionPresent } from "../../translator/capture/gtx-client.mjs";
import { providerConfigReport } from "./provider-config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

assertAllTargetsHaveGtxMapping();
const summary = targetLanguageSummary();
const inventory = buildContentInventory();
const localizable = localizableContent(inventory);
const locales = getTargetLocales();
const plan = planTranslationWork({ inventory, locales });

const out = {
  ok: true,
  browserRequired: false,
  extensionPresent: extensionPresent(),
  provider: providerConfigReport(),
  targetLanguages: summary.targetCount,
  tier1: summary.tier1.length,
  tier2: summary.tier2.length,
  contentItems: localizable.length,
  theoreticalJobs: localizable.length * locales.length,
  rolloutMode: plan.rolloutMode,
  currentLocale: plan.queue[0]?.locale ?? null,
  ready: plan.summary.ready,
  queued: plan.queue.length,
  missing: plan.summary.missing,
  stale: plan.summary.stale,
  failed: plan.summary.failed,
};

mkdirSync(join(ROOT, "tmp"), { recursive: true });
writeFileSync(join(ROOT, "tmp", "i18n-runner-preflight.json"), `${JSON.stringify(out, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(out)}\n`);
