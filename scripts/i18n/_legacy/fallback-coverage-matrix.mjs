/**
 * Forensic coverage matrix: GTX gap locales × local/free MT candidates.
 * Investigation only — no translation pipeline changes.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildGtxLocaleCoverage } from "../../translator/locale/gtx-locale-map.mjs";
import { candidateNllbCode, FLORES_200 } from "./nllb-locale-map.mjs";
import { ISO6391 } from "../../workers/iso6391.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "translator", "reports", "fallback-coverage-matrix.json");

/** OPUS-MT en-mul target ISO codes (from Helsinki-NLP/opus-mt-en-mul model card). */
export const OPUS_EN_MUL_TARGETS = new Set([
  "en", "ca", "es", "os", "eo", "ro", "fy", "cy", "is", "lb", "su", "an", "sq", "fr", "ht", "rm", "cv", "ig",
  "am", "eu", "tr", "ps", "af", "ny", "ch", "uk", "sl", "lt", "tk", "sg", "ar", "lg", "bg", "be", "ka", "gd",
  "ja", "si", "br", "mh", "km", "th", "ty", "rw", "te", "mk", "or", "wo", "kl", "mr", "ru", "yo", "hu", "fo",
  "zh", "ti", "co", "ee", "oc", "sn", "mt", "ts", "pl", "gl", "nb", "bn", "tt", "bo", "lo", "id", "gn", "nv",
  "hy", "kn", "to", "io", "so", "vi", "da", "fj", "gv", "sm", "nl", "mi", "pt", "hi", "se", "as", "ta", "et",
  "kw", "ga", "sv", "ln", "na", "mn", "gu", "wa", "lv", "jv", "el", "my", "ba", "it", "hr", "ur", "ce", "nn",
  "fi", "mg", "rn", "xh", "ab", "de", "cs", "he", "zu", "yi", "ml", "mul",
]);

/** Direct Helsinki-NLP opus-mt-en-XX models verified on HuggingFace (2026-08 investigation). */
export const OPUS_DIRECT_EN_MODELS = Object.freeze({
  bi: "Helsinki-NLP/opus-mt-en-bi",
  gv: "Helsinki-NLP/opus-mt-en-gv",
  ho: "Helsinki-NLP/opus-mt-en-ho",
  kg: "Helsinki-NLP/opus-mt-en-kg",
  kj: "Helsinki-NLP/opus-mt-en-kj",
  lu: "Helsinki-NLP/opus-mt-en-lu",
  mh: "Helsinki-NLP/opus-mt-en-mh",
  ng: "Helsinki-NLP/opus-mt-en-ng",
  to: "Helsinki-NLP/opus-mt-en-to",
  ty: "Helsinki-NLP/opus-mt-en-ty",
});

/** Argos/LibreTranslate typical package langs — not exhaustive; most gap langs absent. */
export const LIBRETRANSLATE_TYPICAL = new Set([
  "ar", "az", "be", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "eo", "es", "et", "fa", "fi", "fr", "ga",
  "he", "hi", "hu", "id", "it", "ja", "ko", "lt", "lv", "ms", "nb", "nl", "pl", "pt", "ro", "ru", "sk", "sl",
  "sq", "sv", "th", "tl", "tr", "uk", "ur", "vi", "zh",
]);

/** SeamlessM4T v2 major langs — gap overlap limited; marked conservatively. */
export const SEAMLESSM4T_V2 = new Set([
  "af", "am", "ar", "as", "az", "be", "bn", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es", "et", "fa",
  "fi", "fr", "ga", "gu", "he", "hi", "hr", "hu", "hy", "id", "is", "it", "ja", "jv", "ka", "kk", "km", "kn",
  "ko", "lt", "lv", "mk", "ml", "mn", "mr", "ms", "mt", "my", "nb", "ne", "nl", "no", "pa", "pl", "pt", "ro",
  "ru", "sk", "sl", "so", "sq", "sr", "sv", "sw", "ta", "te", "th", "tl", "tr", "uk", "ur", "vi", "yo", "zh",
]);

function nameFor(locale) {
  return ISO6391.find(([c]) => c === locale)?.[1] || locale;
}

function pickBest(row) {
  if (row.gtx) return { provider: "chrome_gtx", note: "primary" };
  if (row.nllb) return { provider: "local_nllb", model: row.nllbCode, confidence: "high" };
  if (row.opusDirect) return { provider: "opus_mt_direct", model: row.opusDirect, confidence: "medium" };
  if (row.opusEnMul) return { provider: "opus_mt_en_mul", model: "Helsinki-NLP/opus-mt-en-mul", confidence: "medium-low" };
  if (row.seamless) return { provider: "seamlessm4t", confidence: "low-unverified" };
  return { provider: null, status: "NO VERIFIED LOCAL MT MODEL" };
}

export function buildFallbackCoverageMatrix() {
  const gtx = buildGtxLocaleCoverage();
  const gap = gtx.unsupported.map((u) => u.locale);

  const rows = gap.map((locale) => {
    const nllbCode = candidateNllbCode(locale);
    const nllb = Boolean(nllbCode && FLORES_200.has(nllbCode));
    const opusEnMul = OPUS_EN_MUL_TARGETS.has(locale);
    const opusDirect = OPUS_DIRECT_EN_MODELS[locale] || null;
    const libre = LIBRETRANSLATE_TYPICAL.has(locale);
    const seamless = SEAMLESSM4T_V2.has(locale);
    const row = {
      locale,
      name: nameFor(locale),
      gtx: false,
      nllb,
      nllbCode: nllb ? nllbCode : null,
      opusEnMul,
      opusDirect,
      libre,
      seamless,
    };
    row.best = pickBest(row);
    return row;
  });

  const verified = rows.filter((r) => r.best.provider);
  const impossible = rows.filter((r) => !r.best.provider);

  return {
    generatedAt: new Date().toISOString(),
    gtxSupported: gtx.supportedCount,
    gtxGap: gtx.unsupportedCount,
    gapLocales: gap,
    rows,
    summary: {
      nllbCoversGap: rows.filter((r) => r.nllb).length,
      opusEnMulCoversGap: rows.filter((r) => r.opusEnMul).length,
      opusDirectCoversGap: rows.filter((r) => r.opusDirect).length,
      libreCoversGap: rows.filter((r) => r.libre).length,
      seamlessCoversGap: rows.filter((r) => r.seamless).length,
      bestVerifiedCoverage: verified.length,
      stillImpossible: impossible.length,
      impossibleLocales: impossible.map((r) => r.locale),
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const matrix = buildFallbackCoverageMatrix();
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(matrix, null, 2)}\n`);
  console.log(JSON.stringify(matrix.summary, null, 2));
  console.log(`\nWrote ${OUT}`);
}
