#!/usr/bin/env node
/**
 * i18n CLI — inspect | validate | translate | generate | report | smoke | rollout
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./load-env.mjs";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";
import { scanPublishability } from "./publish.mjs";
import {
  inspectInventory,
  planTranslationWork,
  validateAllArtifacts,
  runProviderSmokeTest,
  runTranslationBatch,
  runFullTranslationRollout,
} from "./translate-pipeline.mjs";
import { providerConfigReport } from "./provider-config.mjs";
import { generateStaticSite } from "../generate-static-site.mjs";
import { getTargetLocales, targetLanguageSummary } from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
loadDotEnv(join(ROOT, ".env"));
const cmd = process.argv[2] || "report";

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = /^--([^=]+)(?:=(.+))?$/.exec(arg);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(3));

async function runInspect() {
  console.log(JSON.stringify({ ...inspectInventory(), targetLanguages: targetLanguageSummary() }, null, 2));
}

async function runValidate() {
  const inventory = buildContentInventory();
  const artifacts = validateAllArtifacts(inventory, getTargetLocales());
  const provider = providerConfigReport();
  console.log(JSON.stringify({ provider, artifacts, targetLanguages: targetLanguageSummary() }, null, 2));
  if (artifacts.issues.length) process.exitCode = 1;
}

async function runReport() {
  const inventory = buildContentInventory();
  const localizable = localizableContent(inventory);
  const targets = getTargetLocales();
  const manifest = scanPublishability(inventory);
  const plan = planTranslationWork({ inventory, locales: targets });
  const artifacts = validateAllArtifacts(inventory, targets);
  const provider = providerConfigReport();
  const theoretical = localizable.length * targets.length;

  const report = {
    generatedAt: new Date().toISOString(),
    content: {
      localizable: localizable.length,
      articles: localizable.filter((i) => i.type === "article").length,
      utilities: localizable.filter((i) => i.type === "utility").length,
    },
    targetLanguages: targetLanguageSummary(),
    theoreticalPages: theoretical,
    counts: {
      ready: manifest.counts.ready,
      stale: manifest.counts.stale,
      missing: manifest.counts.missing,
      failed: manifest.counts.failed + manifest.counts.invalid,
      draft: manifest.counts.draft,
    },
    provider,
    estimatedTranslationCalls: plan.apiCallsWouldBe,
    translationPlanSummary: plan.summary,
    blockers: [],
  };

  if (!provider.translateEnabled) {
    report.blockers.push("TRANSLATE_ENABLED is not 1");
  }
  if (provider.provider !== "chrome_gtx") {
    report.blockers.push("TRANSLATION_PROVIDER must be chrome_gtx");
  }
  if (plan.apiCallsWouldBe > 0) {
    report.blockers.push(`${plan.apiCallsWouldBe} TARGET_LANGUAGE jobs queued; run npm run i18n:pilot then approve mass rollout.`);
  }

  const outPath = join(ROOT, "tmp", "i18n-provider-report.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);
}

async function runTranslate() {
  if (process.env.TRANSLATE_ENABLED !== "1") {
    console.error("Refusing translate: set TRANSLATE_ENABLED=1");
    process.exit(1);
  }
  const limit = args.limit ? Number(args.limit) : undefined;
  const results = await runTranslationBatch({
    contentId: args.contentId,
    locale: args.locale,
    locales: args.locale ? undefined : getTargetLocales(),
    limit,
    force: args.force === true || args.force === "true",
  });
  console.log(JSON.stringify(results, null, 2));
}

async function runGenerate() {
  const staged = join(ROOT, "dist-assets-test");
  generateStaticSite(staged);
  console.log(JSON.stringify({ ok: true, staged }, null, 2));
}

async function runSmoke() {
  if (process.env.TRANSLATE_ENABLED !== "1") {
    console.error("Refusing smoke test: set TRANSLATE_ENABLED=1");
    process.exit(1);
  }
  console.log(JSON.stringify(await runProviderSmokeTest(), null, 2));
}

async function runRollout() {
  if (process.env.TRANSLATE_ENABLED !== "1") {
    console.error("Refusing rollout: set TRANSLATE_ENABLED=1");
    process.exit(1);
  }
  const stats = await runFullTranslationRollout({
    locales: getTargetLocales(),
    maxJobs: args.maxJobs ? Number(args.maxJobs) : Infinity,
  });
  console.log(JSON.stringify(stats, null, 2));
}

const handlers = {
  inspect: runInspect,
  validate: runValidate,
  report: runReport,
  translate: runTranslate,
  generate: runGenerate,
  smoke: runSmoke,
  rollout: runRollout,
};

const handler = handlers[cmd];
if (!handler) {
  console.error(`Unknown command: ${cmd}. Use inspect|validate|report|translate|generate|smoke|rollout`);
  process.exit(1);
}

await handler();
