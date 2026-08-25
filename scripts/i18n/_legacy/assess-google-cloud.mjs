#!/usr/bin/env node
/**
 * Pre-rollout assessment for Google Cloud Translation provider.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./load-env.mjs";
import { providerConfigReport, readProviderEnv } from "./provider-config.mjs";
import { buildLocaleCoverage } from "./google-locale-map.mjs";
import { estimateTranslationWorkload, formatCostConfirmationSummary } from "./workload-estimate.mjs";
import { smokeTestGoogleCloud } from "./provider-google-cloud.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "tmp", "i18n-google-assessment.json");

loadDotEnv(join(ROOT, ".env"));

async function main() {
  const env = readProviderEnv();
  const provider = providerConfigReport(env);
  const coverage = buildLocaleCoverage();
  const estimate = estimateTranslationWorkload({ env });

  const report = {
    generatedAt: new Date().toISOString(),
    provider: "google_cloud",
    providerConfig: provider,
    localeCoverage: coverage,
    workload: estimate,
    costConfirmation: formatCostConfirmationSummary(estimate),
    smokeTest: null,
    proceedWithMassTranslation: false,
    blockers: [],
  };

  if (!provider.translateEnabled) report.blockers.push("TRANSLATE_ENABLED is not 1");
  if (!provider.credentialsPresent) {
    report.blockers.push(
      "Missing Google Cloud credentials. Set GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS (service account JSON path) or use Application Default Credentials.",
    );
  }
  if (!provider.configurationValid) report.blockers.push(...provider.configurationErrors);
  if (coverage.unsupportedCount > 0 && process.env.TRANSLATE_ALLOW_PARTIAL !== "1") {
    report.blockers.push(
      `Google mapping missing for ${coverage.unsupportedCount} locales: ${coverage.unsupported.map((u) => u.locale).join(", ")}`,
    );
  }
  if (estimate.queuedJobs === 0) report.blockers.push("No translation jobs queued (all ready/current).");

  if (report.blockers.length === 0) {
    try {
      report.smokeTest = await smokeTestGoogleCloud(env);
      if (!report.smokeTest.ok) report.blockers.push("Smoke test failed");
    } catch (err) {
      report.smokeTest = { ok: false, error: String(err.message || err).slice(0, 300) };
      report.blockers.push(`Smoke test error: ${report.smokeTest.error}`);
    }
  }

  report.proceedWithMassTranslation = report.blockers.length === 0;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

  console.log(formatCostConfirmationSummary(estimate));
  console.log("\n" + JSON.stringify(report, null, 2));
  console.log(`\nWrote ${OUT}`);
  process.exit(report.proceedWithMassTranslation ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
