#!/usr/bin/env node
/**
 * Controlled fallback benchmark — max 3 content × 3 locales.
 * Writes to tmp/i18n-fallback-benchmark/ only. No mass translation.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { buildContentInventory, localizableContent } from "../../scripts/i18n/content-inventory.mjs";
import { extractStructuredSource } from "../../scripts/i18n/extract-source.mjs";
import { validateTranslationOutput } from "../../scripts/i18n/translate-quality.mjs";
import { detectHardware, selectNllbModel } from "../../scripts/i18n/hardware-detect.mjs";
import { translatePayloadWithGtx } from "../capture/extract-translated.mjs";
import { buildFallbackCoverageMatrix } from "../../scripts/i18n/fallback-coverage-matrix.mjs";
import { OPUS_DIRECT_EN_MODELS } from "../../scripts/i18n/fallback-coverage-matrix.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "translator", "reports", "fallback-benchmark.json");
const TMP = join(ROOT, "tmp", "i18n-fallback-benchmark");

/** Representative GTX-gap locales across provider tiers. */
const BENCH_LOCALES = [
  { locale: "bo", provider: "local_nllb", label: "Tibetan complex script" },
  { locale: "wo", provider: "local_nllb", label: "Wolof low-resource NLLB" },
  { locale: "gv", provider: "opus_mt_direct", label: "Manx OPUS direct model" },
];

const BENCH_CONTENT = [
  { contentId: "11tik-share-links-thumb-vs-youtube", type: "article" },
  { contentId: "how-to-download-youtube-thumbnail", type: "article" },
  { contentId: "about", type: "utility" },
];

function buildPayload(structured) {
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

async function translateOpusDirect(payload, locale, env) {
  const modelId = OPUS_DIRECT_EN_MODELS[locale];
  if (!modelId) throw new Error(`No OPUS direct model for ${locale}`);
  const { pipeline } = await import("@huggingface/transformers");
  const { collectPayloadStrings, setPayloadString, translatePlainStrings, translateHtmlFragment } =
    await import("../../scripts/i18n/dom-translate.mjs");

  let translatorPromise = null;
  const getPipe = async () => {
    if (!translatorPromise) {
      translatorPromise = pipeline("translation", modelId);
    }
    return translatorPromise;
  };

  const out = structuredClone(payload);
  const entries = collectPayloadStrings(out);
  const t0 = performance.now();
  const pipe = await getPipe();

  const translateBatch = async (strings) => {
    const results = [];
    for (const s of strings) {
      const r = await pipe(s, { max_new_tokens: 512 });
      results.push(r?.[0]?.translation_text || r?.translation_text || "");
      if (env.rateLimitMs) await new Promise((r) => setTimeout(r, env.rateLimitMs));
    }
    return results;
  };

  for (const entry of entries.filter((e) => !e.path.includes("Html") && !e.path.endsWith("Html"))) {
    const [translated] = await translatePlainStrings([entry.value], translateBatch);
    setPayloadString(out, entry.path, translated);
  }
  for (const entry of entries.filter((e) => e.path.includes("Html") || e.path.endsWith("Html"))) {
    const html = await translateHtmlFragment(entry.value, translateBatch);
    setPayloadString(out, entry.path, html);
  }

  return {
    data: out,
    usage: { apiCalls: entries.length, runtimeMs: Math.round(performance.now() - t0) },
    modelId,
  };
}

async function translateNllb(payload, locale, env) {
  const { translateStructuredPayload } = await import("../../scripts/i18n/provider-nllb.mjs");
  const t0 = performance.now();
  const result = await translateStructuredPayload(payload, { locale, env });
  return { ...result, usage: { ...result.usage, runtimeMs: Math.round(performance.now() - t0) } };
}

async function runOne(item, benchLocale, inventory) {
  const inv = inventory.find((i) => i.contentId === item.contentId);
  if (!inv?.sourceRel) return { skipped: true, reason: "no-source" };
  const raw = readFileSync(join(ROOT, inv.sourceRel), "utf8");
  const structured = extractStructuredSource(raw, { contentType: inv.type });
  const payload = buildPayload(structured);
  const env = { rateLimitMs: 0, nllbDtype: "q8" };

  const t0 = performance.now();
  let providerResult;
  if (benchLocale.provider === "local_nllb") {
    providerResult = await translateNllb(payload, benchLocale.locale, env);
  } else if (benchLocale.provider === "opus_mt_direct") {
    providerResult = await translateOpusDirect(payload, benchLocale.locale, env);
  } else {
    return { skipped: true, reason: "unknown-provider" };
  }

  const translated = providerResult.data;
  const quality = validateTranslationOutput(translated, structured, {
    contentId: item.contentId,
    locale: benchLocale.locale,
    sourceHash: "bench",
    contentType: inv.type,
  });

  const record = {
    contentId: item.contentId,
    locale: benchLocale.locale,
    provider: benchLocale.provider,
    label: benchLocale.label,
    runtimeMs: Math.round(performance.now() - t0),
    providerRuntimeMs: providerResult.usage?.runtimeMs,
    qualityOk: quality.ok,
    qualityErrors: quality.errors?.slice(0, 10) || [],
    sample: {
      h1: translated.h1?.slice(0, 120),
      title: translated.title?.slice(0, 120),
    },
  };

  mkdirSync(TMP, { recursive: true });
  writeFileSync(
    join(TMP, `${item.contentId}__${benchLocale.locale}.json`),
    `${JSON.stringify({ ...record, translated }, null, 2)}\n`,
  );
  return record;
}

async function main() {
  const hw = detectHardware();
  const nllbModel = selectNllbModel(hw);
  const matrix = buildFallbackCoverageMatrix();
  const inventory = localizableContent(buildContentInventory());
  const results = [];

  for (const item of BENCH_CONTENT) {
    for (const benchLocale of BENCH_LOCALES) {
      process.stderr.write(`[bench] ${item.contentId}/${benchLocale.locale} (${benchLocale.provider})...\n`);
      try {
        results.push(await runOne(item, benchLocale, inventory));
      } catch (err) {
        results.push({
          contentId: item.contentId,
          locale: benchLocale.locale,
          provider: benchLocale.provider,
          qualityOk: false,
          error: String(err.message || err).slice(0, 300),
        });
      }
    }
  }

  const ok = results.filter((r) => r.qualityOk).length;
  const fail = results.filter((r) => r.qualityOk === false).length;
  const avgMs = results.filter((r) => r.runtimeMs).reduce((s, r) => s + r.runtimeMs, 0) / Math.max(1, results.filter((r) => r.runtimeMs).length);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "fallback-benchmark-3x3",
    hardware: hw,
    nllbModel,
    matrixSummary: matrix.summary,
    benchLocales: BENCH_LOCALES,
    benchContent: BENCH_CONTENT.map((c) => c.contentId),
    results,
    summary: { total: results.length, qualityOk: ok, failed: fail, avgRuntimeMs: Math.round(avgMs) },
    estimates: {
      fallbackJobs1081: {
        jobs: 23 * 47,
        avgSecondsPerJob: Math.round(avgMs / 1000),
        estimatedHours: Number(((23 * 47 * (avgMs / 1000)) / 3600).toFixed(1)),
      },
      allJobs4186: {
        jobs: 23 * 182,
        note: "GTX pilot ~73s/job for full articles; fallback likely slower on CPU",
        gtxPilotSecondsPerJob: 73,
        estimatedGtxHours: Number(((23 * 135 * 73) / 3600).toFixed(1)),
        estimatedFallbackHours: Number(((23 * 47 * (avgMs / 1000)) / 3600).toFixed(1)),
        estimatedCombinedHours: Number(((23 * 135 * 73 + 23 * 47 * (avgMs / 1000)) / 3600).toFixed(1)),
      },
    },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${OUT}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
