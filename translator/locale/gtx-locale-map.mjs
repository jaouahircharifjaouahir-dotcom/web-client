/**
 * Project ISO 639-1 → Google Translate Chrome extension (GTX) language codes.
 * Uses the same normLang rules embedded in translator/extension.
 */
import { ISO6391 } from "../../workers/iso6391.js";
import { NON_EN_LOCALES } from "../../scripts/i18n/translation-store.mjs";

/** Known GTX / translate-pa target codes (aligned with Google Translate web client). */
export const GTX_TARGET_CODES = new Set([
  "ab", "ace", "ach", "af", "sq", "alz", "am", "ar", "hy", "as", "awa", "ay", "az", "ban", "bm", "ba", "eu",
  "be", "bem", "bn", "bs", "br", "bg", "ca", "ceb", "ny", "zh", "zh-CN", "zh-TW", "cv", "co", "crh", "hr",
  "cs", "da", "dv", "dz", "en", "eo", "et", "ee", "fj", "fil", "tl", "fi", "fr", "fy", "ff", "gl", "lg", "ka",
  "de", "el", "gn", "gu", "ht", "ha", "haw", "he", "iw", "hi", "hmn", "hu", "is", "ig", "ilo", "id", "ga",
  "it", "ja", "jv", "jw", "kn", "kk", "km", "rw", "ko", "ku", "ckb", "ky", "lo", "la", "lv", "li", "ln", "lt",
  "lb", "mk", "mg", "ms", "ml", "mt", "mi", "mr", "mn", "my", "nl", "nr", "ne", "no", "nb", "nso", "oc", "or",
  "om", "ps", "fa", "pl", "pt", "pa", "qu", "ro", "rn", "ru", "sm", "sg", "sa", "gd", "sr", "st", "sd", "si",
  "sk", "sl", "sn", "so", "es", "su", "sw", "ss", "sv", "tg", "ta", "tt", "te", "th", "ti", "ts", "tn", "tr",
  "tk", "ak", "uk", "ur", "ug", "uz", "vi", "cy", "xh", "yi", "yo", "zu",
]);

/** Explicit overrides matching extension normLang + GTX quirks. */
export const ISO1_TO_GTX = Object.freeze({
  zh: "zh-CN",
  he: "iw",
  iw: "iw",
  tl: "tl",
  fil: "tl",
  nb: "no",
  nn: "no",
  no: "no",
  tw: "ak",
  jv: "jw",
  jw: "jw",
});

/** Same normalization as module$contents$gtx$utils_normLang in the extension. */
export function normLang(code) {
  let a = String(code || "")
    .toLowerCase()
    .replace("_", "-");
  if (a === "zh-cn") return "zh-CN";
  if (a === "zh-tw") return "zh-TW";
  const b = a.indexOf("-");
  a = b >= 0 ? a.substring(0, b) : a;
  if (a === "zh") return "zh-CN";
  if (a === "he") return "iw";
  return a;
}

export function gtxCodeForLocale(locale) {
  if (ISO1_TO_GTX[locale]) {
    const mapped = ISO1_TO_GTX[locale];
    return GTX_TARGET_CODES.has(mapped) || GTX_TARGET_CODES.has(mapped.split("-")[0]) ? mapped : null;
  }
  const normalized = normLang(locale);
  if (GTX_TARGET_CODES.has(normalized)) return normalized;
  if (GTX_TARGET_CODES.has(locale)) return locale;
  return null;
}

/** ISO 639-1 codes supported by the Chrome GTX engine (project subset). */
export function getGtxSupportedLocales() {
  return buildGtxLocaleCoverage().supported.map((s) => s.locale);
}

export function buildGtxLocaleCoverage() {
  const supported = [];
  const unsupported = [];
  for (const locale of NON_EN_LOCALES) {
    const gtxCode = gtxCodeForLocale(locale);
    const name = ISO6391.find(([c]) => c === locale)?.[1] || locale;
    if (gtxCode) supported.push({ locale, gtxCode, name });
    else unsupported.push({ locale, name });
  }
  return {
    supported,
    unsupported,
    supportedCount: supported.length,
    unsupportedCount: unsupported.length,
    totalProjectLocales: NON_EN_LOCALES.length,
  };
}
