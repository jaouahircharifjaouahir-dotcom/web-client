/**
 * ISO 639-1 (project) → Google Cloud Translation language code mapping.
 * Authoritative offline set derived from Google NMT language support docs.
 */
import { ISO6391 } from "../../workers/iso6391.js";
import { NON_EN_LOCALES } from "./translation-store.mjs";

/** Google NMT target codes (ISO-639 / BCP-47 bases used as translation targets). */
export const GOOGLE_NMT_CODES = new Set([
  "ab", "ace", "ach", "af", "sq", "alz", "am", "ar", "hy", "as", "awa", "ay", "az", "ban", "bm", "ba", "eu",
  "be", "bem", "bn", "bs", "br", "bg", "ca", "ceb", "ny", "zh", "zh-CN", "zh-TW", "cv", "co", "crh", "hr",
  "cs", "da", "dv", "dz", "en", "eo", "et", "ee", "fj", "fil", "tl", "fi", "fr", "fy", "ff", "gl", "lg", "ka",
  "de", "el", "gn", "gu", "ht", "ha", "hi", "hu", "is", "ig", "id", "ga", "it", "ja", "jv", "jw", "kn", "kk",
  "km", "rw", "ko", "ku", "ckb", "ky", "lo", "la", "lv", "li", "ln", "lt", "lb", "mk", "mg", "ms", "ml", "mt",
  "mi", "mr", "mn", "my", "nl", "nr", "ne", "no", "nb", "oc", "or", "om", "ps", "fa", "pl", "pt", "pa", "qu", "ro",
  "rn", "ru", "sm", "sg", "sa", "gd", "sr", "st", "sd", "si", "sk", "sl", "sn", "so", "es", "su", "sw", "ss", "sv",
  "tg", "ta", "tt", "te", "th", "ti", "ts", "tn", "tr", "tk", "ak", "uk", "ur", "ug", "uz", "vi", "cy", "xh",
  "yi", "yo", "zu", "he", "iw",
]);

/** Explicit project locale → Google target code overrides. */
export const ISO1_TO_GOOGLE = Object.freeze({
  zh: "zh-CN",
  he: "he",
  iw: "he",
  tl: "tl",
  fil: "fil",
  nb: "no",
  nn: "no",
  no: "no",
  tw: "ak",
  jv: "jv",
  jw: "jv",
  pt: "pt",
  sr: "sr",
});

function googleAcceptsCode(code) {
  if (!code) return false;
  const base = code.split("-")[0];
  return GOOGLE_NMT_CODES.has(code) || GOOGLE_NMT_CODES.has(base);
}

/**
 * Resolve Google Cloud Translation target language code for a project locale.
 * Returns null when no valid mapping exists.
 */
export function googleCodeForLocale(locale) {
  if (ISO1_TO_GOOGLE[locale]) {
    const mapped = ISO1_TO_GOOGLE[locale];
    return googleAcceptsCode(mapped) ? mapped : null;
  }
  if (GOOGLE_NMT_CODES.has(locale)) return locale;
  return null;
}

export function buildLocaleCoverage() {
  const supported = [];
  const unsupported = [];
  for (const locale of NON_EN_LOCALES) {
    const googleCode = googleCodeForLocale(locale);
    const name = ISO6391.find(([c]) => c === locale)?.[1] || locale;
    if (googleCode) supported.push({ locale, googleCode, name });
    else unsupported.push({ locale, name, candidate: null });
  }
  return {
    supported,
    unsupported,
    supportedCount: supported.length,
    unsupportedCount: unsupported.length,
    totalProjectLocales: NON_EN_LOCALES.length,
  };
}

export function assertFullLocaleCoverage() {
  const coverage = buildLocaleCoverage();
  if (coverage.unsupportedCount > 0) {
    const list = coverage.unsupported.map((u) => u.locale).join(", ");
    throw new Error(
      `Google Cloud Translation mapping missing for ${coverage.unsupportedCount} project locales: ${list}`,
    );
  }
  return coverage;
}
