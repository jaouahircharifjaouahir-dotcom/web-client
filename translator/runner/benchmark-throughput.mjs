#!/usr/bin/env node
/**
 * Compare sequential vs parallel GTX throughput on pilot workload (3 articles × 4 locales).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { loadDotEnv } from "../../scripts/i18n/load-env.mjs";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { runTranslationBatch } from "../../scripts/i18n/translate-pipeline.mjs";
import { readProviderEnv } from "../../scripts/i18n/provider-config.mjs";
import { resetSharedGtxGate } from "../../scripts/i18n/rate-limiter.mjs";
import { extensionPresent, smokeTestGtx } from "../capture/gtx-client.mjs";
import { buildGtxLocaleCoverage } from "../locale/gtx-locale-map.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPORT = join(ROOT, "translator", "reports", "throughput-benchmark.json");
loadDotEnv(join(ROOT, ".env"));

const PILOT_LOCALES = ["fr", "es", "de", "ar"];
const PILOT_CONTENT = [
  "11tik-share-links-thumb-vs-youtube",
  "how-to-download-youtube-thumbnail",
  "youtube-thumbnail-url",
];

function pickPilotArticles(inventory) {
  const articles = localizableContent(inventory).filter((i) => i.type === "article" && i.sourceRel);
  return PILOT_CONTENT.map((id) => articles.find((a) => a.contentId === id)).filter(Boolean);
}

function memMiB() {
  return Math.round(process.memoryUsage().rss / (1024 * 1024));
}

async function runMode(label, envOverrides, { force = true } = {}) {
  resetSharedGtxGate();
  const env = { ...readProviderEnv(), ...envOverrides };
  const inventory = buildContentInventory();
  const items = pickPilotArticles(inventory);
  const t0 = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    const batch = await runTranslationBatch({
      inventory,
      contentId: item.contentId,
      locales: PILOT_LOCALES,
      limit: PILOT_LOCALES.length,
      env,
      concurrency: env.concurrency,
      force,
    });
    processed += batch.processed;
    succeeded += batch.succeeded;
    failed += batch.failed;
  }

  const runtimeMs = Date.now() - t0;
  const jobs = items.length * PILOT_LOCALES.length;
  return {
    label,
    runtimeMs,
    runtimeSec: Number((runtimeMs / 1000).toFixed(1)),
    jobs,
    processed,
    succeeded,
    failed,
    secPerJob: Number((runtimeMs / 1000 / jobs).toFixed(2)),
    jobsPerSec: Number((jobs / (runtimeMs / 1000)).toFixed(3)),
    ramPeakMiB: memMiB(),
    env: {
      concurrency: env.concurrency,
      gtxConcurrency: env.gtxConcurrency,
      rateLimitMs: env.rateLimitMs,
    },
  };
}

async function main() {
  if (!extensionPresent()) {
    console.error("translator/extension missing");
    process.exit(1);
  }
  const smoke = await smokeTestGtx();
  if (!smoke.ok) {
    console.error("GTX smoke failed", smoke);
    process.exit(1);
  }

  process.env.TRANSLATE_ENABLED = "1";
  process.env.TRANSLATION_PROVIDER = "chrome_gtx";

  const baselineMs = 808546; // prior pilot-3x4.json sequential ~13.5 min

  process.stderr.write("[bench] sequential mode (concurrency=1)...\n");
  const sequential = await runMode("sequential", {
    concurrency: 1,
    gtxConcurrency: 1,
    rateLimitMs: 300,
  });

  process.stderr.write("[bench] parallel mode (concurrency=4, gtx=8)...\n");
  const parallel = await runMode("parallel", {
    concurrency: 4,
    gtxConcurrency: 8,
    rateLimitMs: 80,
  });

  const speedupVsSequential = Number((sequential.runtimeMs / parallel.runtimeMs).toFixed(2));
  const speedupVsBaseline = Number((baselineMs / parallel.runtimeMs).toFixed(2));

  const coverage = buildGtxLocaleCoverage();
  const localizable = localizableContent(buildContentInventory());
  const totalJobs = localizable.length * coverage.supportedCount;

  const report = {
    generatedAt: new Date().toISOString(),
    hardware: {
      cpus: os.cpus().length,
      ramGiB: Math.round(os.totalmem() / 1024 ** 3),
      cpuModel: os.cpus()[0]?.model,
    },
    pilot: { contentIds: PILOT_CONTENT, locales: PILOT_LOCALES, jobs: 12 },
    baselinePilotMs: baselineMs,
    sequential,
    parallel,
    speedup: {
      parallelVsSequential: speedupVsSequential,
      parallelVsBaselinePilot: speedupVsBaseline,
      percentFasterVsSequential: Number(((1 - parallel.runtimeMs / sequential.runtimeMs) * 100).toFixed(1)),
      percentFasterVsBaseline: Number(((1 - parallel.runtimeMs / baselineMs) * 100).toFixed(1)),
    },
    rolloutEstimate: {
      gtxLocales: coverage.supportedCount,
      contentItems: localizable.length,
      totalJobs,
      estimatedHoursSequential: Number(((totalJobs * sequential.secPerJob) / 3600).toFixed(1)),
      estimatedHoursParallel: Number(((totalJobs * parallel.secPerJob) / 3600).toFixed(1)),
    },
    recommendation:
      speedupVsSequential >= 1.5
        ? "parallel architecture approved for mass rollout"
        : "parallel speedup below 1.5× — tune TRANSLATE_CONCURRENCY / TRANSLATE_GTX_CONCURRENCY",
  };

  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${REPORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
