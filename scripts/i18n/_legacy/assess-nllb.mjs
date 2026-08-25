#!/usr/bin/env node
/**
 * NLLB local provider assessment:
 * hardware, locale coverage, smoke test, one validation translation, runtime estimate.
 * STOPS with report if unsupported locale gaps exist (default).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./load-env.mjs";
import { detectHardware, selectNllbModel, estimateFullRolloutRuntime } from "./hardware-detect.mjs";
import { buildLocaleCoverage, FLORES_200 } from "./nllb-locale-map.mjs";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";
import { NON_EN_LOCALES } from "./translation-store.mjs";
import { providerConfigReport } from "./provider-config.mjs";
import { providerSmokeTest } from "./provider.mjs";
import { probeLocale } from "./provider-nllb.mjs";
import { extractStructuredSource } from "./extract-source.mjs";
import { translateStructuredPayload } from "./provider-nllb.mjs";
import { validateTranslationOutput } from "./translate-quality.mjs";
import { planTranslationWork } from "./translate-pipeline.mjs";
import { scanPublishability } from "./publish.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
loadDotEnv(join(ROOT, ".env"));
process.env.TRANSLATE_ENABLED = "1";
process.env.TRANSLATION_PROVIDER = process.env.TRANSLATION_PROVIDER || "local_nllb";

const OUT = join(ROOT, "tmp", "i18n-nllb-assessment.json");
const VALIDATION_LOCALE = process.env.NLLB_VALIDATION_LOCALE || "de";
const VALIDATION_ARTICLE = "11tik-share-links-thumb-vs-youtube";
const VALIDATION_SOURCE = "docs/blogger-pages/blog/11tik-share-links-thumb-vs-watch.html";

async function main() {
  const hw = detectHardware();
  const model = selectNllbModel(hw);
  const coverage = buildLocaleCoverage();
  const inventory = buildContentInventory();
  const localizable = localizableContent(inventory);
  const plan = planTranslationWork({ inventory, locales: coverage.supported.map((s) => s.locale) });
  const manifest = scanPublishability(inventory);

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "pre-rollout-assessment",
    hardware: hw,
    model,
    provider: providerConfigReport(),
    floresLanguageCount: FLORES_200.size,
    projectLocales: {
      totalIso6391IncludingEn: NON_EN_LOCALES.length + 1,
      nonEn: NON_EN_LOCALES.length,
    },
    coverage: {
      supportedByNllb: coverage.supported,
      unsupportedByNllb: coverage.unsupported,
      supportedCount: coverage.supportedCount,
      unsupportedCount: coverage.unsupportedCount,
    },
    content: {
      localizableItems: localizable.length,
      theoreticalPagesAllProjectLocales: localizable.length * NON_EN_LOCALES.length,
      theoreticalPagesNllbSupportedOnly: localizable.length * coverage.supportedCount,
      theoreticalPagesUnsupportedGap: localizable.length * coverage.unsupportedCount,
    },
    currentArtifacts: manifest.counts,
    queuedJobsIfNllbOnly: plan.queue.length,
    runtimeEstimateAllSupported: estimateFullRolloutRuntime({
      jobCount: plan.queue.length,
      avgSecondsPerJob: 120,
      modelLoadSeconds: 65,
    }),
    runtimeEstimateFull4185: estimateFullRolloutRuntime({
      jobCount: 4185,
      avgSecondsPerJob: 120,
      modelLoadSeconds: 65,
    }),
    smokeTest: null,
    localeProbes: null,
    validationTranslation: null,
    fallbackArchitecture: {
      tier1: "local_nllb (Xenova/nllb-200-distilled-600M) for mapped FLORES-200 locales",
      tier2:
        "For the 49 unsupported ISO hosts: add build-time Marian/OPUS-MT en→xx models (Helsinki-NLP) as provider-marian fallback, or defer those hosts until a second open-source engine is wired. Do NOT fabricate NLLB translations for unmapped locales.",
      tier3: "Keep English canonical + exclude unsupported locales from sitemap/hreflang until a verified translation exists.",
      recommendation:
        coverage.unsupportedCount > 0
          ? "STOP full 4186-page rollout until tier-2 fallback is implemented OR project explicitly accepts partial locale coverage."
          : "Proceed with full local NLLB rollout.",
    },
    proceedWithMassTranslation: false,
    blockers: [],
  };

  report.blockers.push(
    `NLLB-200 covers ${coverage.supportedCount}/${NON_EN_LOCALES.length} project non-English locales (${coverage.unsupportedCount} unsupported).`,
  );

  // Smoke test
  try {
    report.smokeTest = await providerSmokeTest();
  } catch (err) {
    report.smokeTest = { ok: false, error: String(err.message || err) };
    report.blockers.push(`Smoke test failed: ${report.smokeTest.error}`);
  }

  // Probe first 10 unsupported + 10 supported locales
  const probeSupported = coverage.supported.slice(0, 10);
  const probeUnsupported = coverage.unsupported.slice(0, 10);
  report.localeProbes = {
    supported: [],
    unsupported: probeUnsupported.map((u) => ({ ...u, probed: false, note: "mapping absent — skipped live probe" })),
  };
  for (const row of probeSupported) {
    report.localeProbes.supported.push(await probeLocale(row.locale, providerConfigReport()));
  }

  // One validation translation (German POC article) — does not overwrite FR ready artifact
  if (coverage.supported.some((s) => s.locale === VALIDATION_LOCALE)) {
    const t0 = Date.now();
    try {
      const raw = readFileSync(join(ROOT, VALIDATION_SOURCE), "utf8");
      const structured = extractStructuredSource(raw, { contentType: "article" });
      const payload = {
        title: structured.title,
        description: structured.description,
        h1: structured.h1,
        ogTitle: structured.ogTitle,
        ogDescription: structured.ogDescription,
        imageAlt: structured.imageAlt,
        faqHeading: structured.faqHeading,
        images: structured.images,
        sections: structured.sections.slice(0, 2),
        faq: structured.faq.slice(0, 2),
        conclusionHtml: structured.conclusionHtml,
        bioHtml: structured.bioHtml,
      };
      const { data } = await translateStructuredPayload(payload, {
        locale: VALIDATION_LOCALE,
        env: providerConfigReport(),
      });
      const quality = validateTranslationOutput(
        { ...data, contentId: VALIDATION_ARTICLE, locale: VALIDATION_LOCALE, sourceHash: "validation", status: "draft" },
        { ...structured, sections: structured.sections.slice(0, 2), faq: structured.faq.slice(0, 2) },
        { contentId: VALIDATION_ARTICLE, locale: VALIDATION_LOCALE, sourceHash: "validation", contentType: "article" },
      );
      report.validationTranslation = {
        locale: VALIDATION_LOCALE,
        article: VALIDATION_ARTICLE,
        truncated: true,
        runtimeMs: Date.now() - t0,
        qualityOk: quality.ok,
        qualityErrors: quality.errors,
        sampleH1: data.h1?.slice(0, 120),
        sampleDescription: data.description?.slice(0, 120),
      };
      if (!quality.ok) report.blockers.push(`Validation translation failed structural checks: ${quality.errors.join(", ")}`);
    } catch (err) {
      report.validationTranslation = { ok: false, error: String(err.message || err).slice(0, 300) };
      report.blockers.push(`Validation translation error: ${report.validationTranslation.error}`);
    }
  }

  if (coverage.unsupportedCount > 0) {
    report.proceedWithMassTranslation = false;
    report.blockers.push(
      "Policy: do not start 4,186-job mass rollout while 49 project locales lack verified NLLB mapping.",
    );
  } else if (report.smokeTest?.ok && report.validationTranslation?.qualityOk) {
    report.proceedWithMassTranslation = true;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${OUT}`);

  if (!report.proceedWithMassTranslation) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
