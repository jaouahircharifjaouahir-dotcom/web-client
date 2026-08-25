#!/usr/bin/env node
/**
 * Periodic rollout health check — writes tmp/i18n-rollout-monitor.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planTranslationWork } from "./translate-pipeline.mjs";
import { buildContentInventory } from "./content-inventory.mjs";
import { getTargetLocales } from "./target-languages.mjs";
import { loadTranslationArtifact } from "./translation-store.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STATS = join(ROOT, "tmp", "i18n-rollout-stats.json");
const OUT = join(ROOT, "tmp", "i18n-rollout-monitor.json");
const LOG = join(ROOT, "tmp", "i18n-rollout-log.jsonl");

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function recentFailures(sinceMs) {
  if (!existsSync(LOG)) return [];
  const lines = readFileSync(LOG, "utf8").trim().split("\n").slice(-500);
  const out = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e.skipped && e.status === "ready") continue;
      if (!e.ok && e.at && Date.parse(e.at) >= sinceMs) out.push(e);
    } catch {
      /* skip */
    }
  }
  return out;
}

function uniqueFailedArtifacts() {
  const inv = buildContentInventory();
  const locales = getTargetLocales();
  const failed = [];
  for (const item of inv.filter((i) => i.localizable)) {
    for (const locale of locales) {
      const a = loadTranslationArtifact(item.contentId, locale);
      if (a?.status === "failed") {
        failed.push({
          contentId: item.contentId,
          locale,
          errors: a.validationErrors || (a.error ? [a.error] : []),
        });
      }
    }
  }
  return failed;
}

const stats = readJson(STATS) || {};
const plan = planTranslationWork({ inventory: buildContentInventory(), locales: getTargetLocales() });
const since = Date.now() - 5 * 60 * 1000;
const recent = recentFailures(since);
const failedArtifacts = uniqueFailedArtifacts();

const report = {
  at: new Date().toISOString(),
  succeeded: stats.succeeded ?? 0,
  failedCounter: stats.failed ?? 0,
  remaining: stats.remaining ?? plan.queue.length,
  currentLocale: stats.currentLocale ?? plan.queue[0]?.locale ?? null,
  rolloutMode: stats.rolloutMode ?? plan.rolloutMode,
  queued: plan.queue.length,
  ready: plan.summary.ready,
  recentFailures5m: recent.length,
  recentFailureSamples: recent.slice(-5).map((e) => ({
    contentId: e.contentId,
    locale: e.locale,
    at: e.at,
  })),
  uniqueFailedArtifacts: failedArtifacts.length,
  failedByError: Object.fromEntries(
    [...failedArtifacts.reduce((m, f) => {
      const key = (f.errors?.[0] || "unknown").slice(0, 64);
      m.set(key, (m.get(key) || 0) + 1);
      return m;
    }, new Map())].sort((a, b) => b[1] - a[1]),
  ),
  healthy: recent.length === 0 && plan.queue.length > 0,
  complete: plan.queue.length === 0,
};

mkdirSync(join(ROOT, "tmp"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);
