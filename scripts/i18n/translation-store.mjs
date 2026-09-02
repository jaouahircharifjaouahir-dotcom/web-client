import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { localizedAssetRel, localizedCleanPath } from "./clean-urls.mjs";
import { ISO6391, ISO6391_CODES, RTL_CODES } from "../../workers/iso6391.js";
import { SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TRANSLATIONS_ROOT = join(ROOT, "content", "translations");
export const LEGACY_POC_FR = join(
  ROOT,
  "content",
  "articles",
  "11tik-share-links-thumb-vs-youtube",
  "fr.json",
);

export const NON_EN_LOCALES = ISO6391.map(([code]) => code).filter((code) => code !== "en");

/**
 * Normalize English source for hashing / staleness.
 * Strip Cloudflare email_off transport markers — they are non-semantic and
 * applied again at HTML emit via protectEmailsInHtml / wrapMailtoWithEmailOff.
 */
export function normalizeSource(raw) {
  return `${String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/<!--\s*\/?\s*email_off\s*-->/gi, "")
    .trim()}\n`;
}

export function hashSource(raw) {
  return createHash("sha256").update(normalizeSource(raw), "utf8").digest("hex");
}

export function readSourceHash(sourceRel) {
  if (!sourceRel) return null;
  const abs = join(ROOT, sourceRel);
  if (!existsSync(abs)) return null;
  return hashSource(readFileSync(abs, "utf8"));
}

export function translationArtifactPath(contentId, locale) {
  return join(TRANSLATIONS_ROOT, contentId, `${locale}.json`);
}

export function loadTranslationArtifact(contentId, locale) {
  const legacy =
    contentId === "11tik-share-links-thumb-vs-youtube" && locale === "fr" && existsSync(LEGACY_POC_FR)
      ? LEGACY_POC_FR
      : null;
  const path = translationArtifactPath(contentId, locale);
  const file = existsSync(path) ? path : legacy;
  if (!file) return null;
  const raw = JSON.parse(readFileSync(file, "utf8"));
  // Normalize legacy articleId → contentId
  if (!raw.contentId && raw.articleId) raw.contentId = raw.articleId;
  return raw;
}

export function listTranslationLocales(contentId) {
  const dir = join(TRANSLATIONS_ROOT, contentId);
  const locales = new Set();
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (name.endsWith(".json")) locales.add(name.replace(/\.json$/, ""));
    }
  }
  if (contentId === "11tik-share-links-thumb-vs-youtube" && existsSync(LEGACY_POC_FR)) {
    locales.add("fr");
  }
  return [...locales].sort();
}

export function saveTranslationArtifact(artifact) {
  const contentId = artifact.contentId || artifact.articleId;
  if (!contentId || !artifact.locale) throw new Error("artifact requires contentId and locale");
  const path = translationArtifactPath(contentId, artifact.locale);
  mkdirSync(dirname(path), { recursive: true });
  const out = { ...artifact, contentId, articleId: contentId };
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
  return path;
}

export function localizedPublicUrl(item, locale) {
  if (locale === "en") return item.canonicalUrl;
  if (item.type === "homepage") return `https://${locale}.11tik.com/l/${locale}/`;
  return `https://${locale}.11tik.com${localizedCleanPath(locale, item.contentId)}`;
}

export function localizedAssetRelPath(item, locale) {
  if (item.type === "homepage") return join("l", locale, "index.html");
  return localizedAssetRel(locale, item.contentId);
}

export function isRtl(locale) {
  return RTL_CODES.has(locale);
}

export function isSupportedLocale(locale) {
  return ISO6391_CODES.has(locale);
}

/** Locale is in the active TARGET_LANGUAGES publish set. */
export function isTargetPublishLocale(locale) {
  // Lazy import avoided — callers should use target-languages.mjs for lists.
  return Boolean(locale) && locale !== "en";
}

export function ogLocaleTag(locale) {
  return `${locale}_${locale.toUpperCase()}`;
}

export { SITE_ORIGIN, ISO6391, ISO6391_CODES, RTL_CODES };
