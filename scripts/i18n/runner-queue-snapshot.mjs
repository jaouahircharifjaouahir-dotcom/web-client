#!/usr/bin/env node
/**
 * Live queue snapshot for run-local-rollout.ps1 progress display.
 * Writes tmp/i18n-rollout-queue.json and prints one JSON line to stdout.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentInventory } from "./content-inventory.mjs";
import { planTranslationWork } from "./translate-pipeline.mjs";
import { getTargetLocales } from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const inventory = buildContentInventory();
const plan = planTranslationWork({ inventory, locales: getTargetLocales() });

const snap = {
  queued: plan.queue.length,
  ready: plan.summary.ready,
  failed: plan.summary.failed,
  missing: plan.summary.missing,
  rolloutMode: plan.rolloutMode,
  currentLocale: plan.queue[0]?.locale ?? null,
  updatedAt: new Date().toISOString(),
};

mkdirSync(join(ROOT, "tmp"), { recursive: true });
writeFileSync(join(ROOT, "tmp", "i18n-rollout-queue.json"), `${JSON.stringify(snap, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(snap)}\n`);
