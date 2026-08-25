#!/usr/bin/env node
/**
 * Pilot: ONE article × ALL TARGET_LANGUAGES via Chrome GTX.
 * Does NOT run mass rollout. Does NOT deploy/commit/push.
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "../../scripts/i18n/load-env.mjs";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { runTranslationBatch, validateAllArtifacts } from "../../scripts/i18n/translate-pipeline.mjs";
import { readProviderEnv, providerConfigReport } from "../../scripts/i18n/provider-config.mjs";
import { generateStaticSite } from "../../scripts/generate-static-site.mjs";
import { scanPublishability, collectReadyLocaleLocs } from "../../scripts/i18n/publish.mjs";
import { auditGeneratedFiles } from "../../scripts/i18n/audit-generated.mjs";
import { scanInternalLinks } from "../../scripts/i18n/validate-internal-links.mjs";
import { smokeTestGtx, extensionPresent } from "../capture/gtx-client.mjs";
import { browserAutomationStatus } from "../browser/chrome-profile.mjs";
import { RTL_CODES } from "../../workers/iso6391.js";
import {
  assertAllTargetsHaveGtxMapping,
  getTargetLocales,
  getTier1Locales,
  getTier2Locales,
  targetLanguageSummary,
} from "../../scripts/i18n/target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
loadDotEnv(join(ROOT, ".env"));

process.env.TRANSLATE_ENABLED = "1";
process.env.TRANSLATION_PROVIDER = "chrome_gtx";
process.env.TRANSLATE_RATE_LIMIT_MS = process.env.TRANSLATE_RATE_LIMIT_MS || "80";
process.env.TRANSLATE_CONCURRENCY = process.env.TRANSLATE_CONCURRENCY || "4";
process.env.TRANSLATE_GTX_CONCURRENCY = process.env.TRANSLATE_GTX_CONCURRENCY || "8";

const PILOT_CONTENT_ID = "11tik-share-links-thumb-vs-youtube";
const STAGED = join(ROOT, "dist-assets-pilot");
const REPORT = join(ROOT, "translator", "reports", "pilot-target-languages.json");

function dirSizeBytes(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  const walk = (p) => {
    for (const name of readdirSync(p)) {
      const full = join(p, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else total += st.size;
    }
  };
  walk(dir);
  return total;
}

async function main() {
  const t0 = Date.now();
  assertAllTargetsHaveGtxMapping();
  const targetLocales = getTargetLocales();
  const inventory = buildContentInventory();
  const allLocalizable = localizableContent(inventory);
  const env = readProviderEnv();

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "pilot-1-article-x-all-target-languages",
    provider: providerConfigReport(env),
    extension: browserAutomationStatus(),
    targetLanguages: targetLanguageSummary(),
    inventory: {
      articles: allLocalizable.filter((i) => i.type === "article").length,
      utilities: allLocalizable.filter((i) => i.type === "utility").length,
      localizable: allLocalizable.length,
      targetLocales: targetLocales.length,
      theoreticalAll: allLocalizable.length * targetLocales.length,
    },
    pilot: {
      contentId: PILOT_CONTENT_ID,
      locales: targetLocales,
      tier1: getTier1Locales(),
      tier2: getTier2Locales(),
      jobsPlanned: targetLocales.length,
    },
    smoke: null,
    translation: null,
    generation: null,
    validation: null,
    productionIsolation: null,
    readyForMass: false,
    blockers: [],
  };

  if (!extensionPresent()) {
    report.blockers.push("translator/extension missing");
    writeReport(report);
    process.exit(1);
  }

  try {
    report.smoke = await smokeTestGtx();
    if (!report.smoke.ok) report.blockers.push("GTX smoke test failed");
  } catch (err) {
    report.smoke = { ok: false, error: String(err.message || err).slice(0, 300) };
    report.blockers.push(`smoke: ${report.smoke.error}`);
  }

  if (report.blockers.length) {
    writeReport(report);
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const tt0 = Date.now();
  process.stderr.write(`[pilot] ${PILOT_CONTENT_ID} × ${targetLocales.length} locales (concurrency=${env.concurrency})...\n`);
  const batch = await runTranslationBatch({
    inventory,
    contentId: PILOT_CONTENT_ID,
    locales: targetLocales,
    limit: targetLocales.length,
    env,
    concurrency: env.concurrency,
  });

  report.translation = {
    runtimeMs: Date.now() - tt0,
    processed: batch.processed,
    succeeded: batch.succeeded,
    failed: batch.failed,
    skipped: batch.skipped,
    items: batch.items,
    secPerJob: batch.processed ? Number((Date.now() - tt0) / 1000 / batch.processed).toFixed(2) : null,
  };

  const g0 = Date.now();
  generateStaticSite(STAGED);
  const manifest = scanPublishability(inventory);
  const files = auditGeneratedFiles(STAGED);
  const links = scanInternalLinks(manifest);
  const localeLocs = collectReadyLocaleLocs(manifest);

  report.generation = {
    runtimeMs: Date.now() - g0,
    staged: STAGED,
    generatedBytes: dirSizeBytes(STAGED),
    files,
    sitemapLocalized: localeLocs.length,
    internalLinks: links,
    rtlPages: files.rtlPages,
    rtlLocalesInPilot: targetLocales.filter((l) => RTL_CODES.has(l)),
  };

  report.validation = validateAllArtifacts(inventory, targetLocales);

  const { execSync } = await import("node:child_process");
  const isolation = { ok: true, checks: [] };
  for (const c of [
    { name: "no-gtx-in-staged", cmd: `rg -l "translate-pa.googleapis|provider-chrome-gtx|getApiKey" "${STAGED}" || exit 0` },
    { name: "no-extension-js-in-staged", cmd: `rg -l "bubble_compiled|popup_compiled|gtx-content" "${STAGED}" || exit 0` },
  ]) {
    try {
      const out = execSync(c.cmd, { cwd: ROOT, encoding: "utf8", shell: true }).trim();
      const hit = Boolean(out);
      isolation.checks.push({ name: c.name, leaked: hit, detail: out.slice(0, 200) });
      if (hit) isolation.ok = false;
    } catch {
      isolation.checks.push({ name: c.name, leaked: false });
    }
  }
  report.productionIsolation = isolation;

  const pilotFailed = batch.items.filter((i) => i.ok === false && !i.skipped).length;
  report.summary = {
    pilotJobs: targetLocales.length,
    succeeded: batch.succeeded,
    skippedReady: batch.skipped,
    failed: batch.failed,
    pilotFailed,
    totalRuntimeMs: Date.now() - t0,
  };

  if (pilotFailed > 0) report.blockers.push(`${pilotFailed} pilot translations failed`);
  if (!isolation.ok) report.blockers.push("production isolation leak detected");

  report.readyForMass = report.blockers.length === 0 && batch.failed === 0;
  report.massEstimate = {
    contentItems: allLocalizable.length,
    targetLocales: targetLocales.length,
    theoreticalJobs: allLocalizable.length * targetLocales.length,
    remainingJobs:
      allLocalizable.length * targetLocales.length - (report.validation?.ready || 0),
    note: "Mass rollout NOT started — await approval after this report.",
  };

  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${REPORT}`);
  process.exit(report.readyForMass ? 0 : 3);
}

function writeReport(report) {
  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
