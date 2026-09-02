/**
 * Phase 52.1 — authoritative clean URL lookup for future migration routing.
 * Does not change current public URLs; consumed by tests and future Worker handlers.
 */
import { ISO6391_CODES } from "./iso6391.js";
import {
  classifyReservedRoute,
  isLegacyContentPath,
  isLocaleHomePath,
  isThumbShareSpaPath,
  normalizePathname,
} from "./reserved-routes.js";
import bundledManifest from "./route-manifest.json" with { type: "json" };

export const ROUTE_LOOKUP_STATUS = Object.freeze({
  EXISTS: "EXISTS",
  MISSING: "MISSING",
  INVALID_LOCALE: "INVALID_LOCALE",
  NOT_PUBLISHED: "NOT_PUBLISHED",
  NOT_GENERATED: "NOT_GENERATED",
  RESERVED_ROUTE: "RESERVED_ROUTE",
  INVALID_PATH: "INVALID_PATH",
});

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const MAX_SLUG_LEN = 120;

export function isValidContentSlug(slug) {
  const value = String(slug || "");
  if (!value || value.length > MAX_SLUG_LEN) return false;
  if (value.includes("..") || value.includes("/") || value.includes("\\")) return false;
  return SLUG_RE.test(value);
}

/**
 * @param {string} pathname
 * @param {string} [host]
 */
export function parseCleanUrlRequest(pathname, host = "www.11tik.com") {
  const path = normalizePathname(pathname);
  if (!path) return { pattern: "invalid" };

  const hostLocaleMatch = /^([a-z]{2})\.11tik\.com$/i.exec(String(host || "").toLowerCase());
  const hostLocale = hostLocaleMatch?.[1]?.toLowerCase() || "";
  const segments = path.split("/").filter(Boolean);

  if (path === "/") return { pattern: "homepage" };

  if (hostLocale) {
    if (segments.length === 2 && segments[0] === "l" && segments[1].toLowerCase() === hostLocale) {
      return { pattern: "locale-home", locale: hostLocale };
    }
    if (segments.length === 3 && segments[0] === "l" && segments[1].toLowerCase() === hostLocale) {
      return {
        pattern: "localized-content",
        locale: hostLocale,
        slug: segments[2],
      };
    }
    return { pattern: "invalid" };
  }

  if (segments.length === 1) {
    return { pattern: "en-content", slug: segments[0] };
  }

  if (segments.length === 3 && segments[0] === "l" && ISO6391_CODES.has(segments[1].toLowerCase())) {
    return {
      pattern: "localized-content",
      locale: segments[1].toLowerCase(),
      slug: segments[2],
    };
  }

  return { pattern: "invalid" };
}

/**
 * @typedef {object} RouteManifest
 * @property {number} v
 * @property {string[]} [targetLocales]
 * @property {string[]} [enOnly]
 * @property {{ articles: Record<string, object>, pages: Record<string, object> }} en
 * @property {Record<string, Record<string, object>>} localized
 */

/**
 * @param {RouteManifest} manifest
 */
export function createRouteResolver(manifest) {
  const enArticles = manifest?.en?.articles || {};
  const enPages = manifest?.en?.pages || {};
  const localized = manifest?.localized || {};
  const enOnly = new Set(manifest?.enOnly || []);
  const targetLocales = new Set(manifest?.targetLocales || Object.keys(localized));

  const enArticleSlugs = new Set(Object.keys(enArticles));
  const enPageSlugs = new Set(Object.keys(enPages));

  const localizedReady = new Map();
  for (const [locale, entries] of Object.entries(localized)) {
    for (const [slug, entry] of Object.entries(entries)) {
      localizedReady.set(`${locale}:${slug}`, entry);
    }
  }

  function lookupEnglish(slug) {
    if (!isValidContentSlug(slug)) {
      return { status: ROUTE_LOOKUP_STATUS.INVALID_PATH };
    }
    if (enArticleSlugs.has(slug)) {
      return {
        status: ROUTE_LOOKUP_STATUS.EXISTS,
        contentId: slug,
        type: "article",
        locale: "en",
        entry: enArticles[slug],
        legacyPath: enArticles[slug].legacyPath,
        cleanPath: enArticles[slug].cleanPath,
        assetRel: enArticles[slug].assetRel,
        localizable: Boolean(enArticles[slug].localizable),
      };
    }
    if (enPageSlugs.has(slug)) {
      return {
        status: ROUTE_LOOKUP_STATUS.EXISTS,
        contentId: slug,
        type: "page",
        locale: "en",
        entry: enPages[slug],
        legacyPath: enPages[slug].legacyPath,
        cleanPath: enPages[slug].cleanPath,
        assetRel: enPages[slug].assetRel,
        localizable: slug !== "copyright",
      };
    }
    return { status: ROUTE_LOOKUP_STATUS.MISSING, locale: "en", slug };
  }

  function lookupLocalized(locale, slug) {
    if (!isValidContentSlug(slug)) {
      return { status: ROUTE_LOOKUP_STATUS.INVALID_PATH, locale, slug };
    }
    if (!ISO6391_CODES.has(locale)) {
      return { status: ROUTE_LOOKUP_STATUS.INVALID_LOCALE, locale, slug };
    }
    if (!targetLocales.has(locale)) {
      return { status: ROUTE_LOOKUP_STATUS.INVALID_LOCALE, locale, slug };
    }

    const enKnown = enArticleSlugs.has(slug) || enPageSlugs.has(slug);
    if (!enKnown) {
      return { status: ROUTE_LOOKUP_STATUS.MISSING, locale, slug };
    }

    if (enOnly.has(slug)) {
      return { status: ROUTE_LOOKUP_STATUS.NOT_PUBLISHED, locale, slug, contentId: slug };
    }

    const ready = localizedReady.get(`${locale}:${slug}`);
    if (ready) {
      return {
        status: ROUTE_LOOKUP_STATUS.EXISTS,
        contentId: slug,
        type: ready.type,
        locale,
        entry: ready,
        legacyPath: ready.legacyPath,
        cleanPath: ready.cleanPath,
        assetRel: ready.assetRel,
      };
    }

    const enLocalizable =
      (enArticles[slug] && enArticles[slug].localizable !== false) ||
      (enPages[slug] && enPages[slug].localizable !== false);
    if (!enLocalizable) {
      return { status: ROUTE_LOOKUP_STATUS.NOT_PUBLISHED, locale, slug, contentId: slug };
    }

    return { status: ROUTE_LOOKUP_STATUS.NOT_PUBLISHED, locale, slug, contentId: slug };
  }

  /**
   * @param {string} pathname
   * @param {{ host?: string }} [options]
   */
  function resolveCleanUrl(pathname, options = {}) {
    const host = String(options.host || "www.11tik.com").toLowerCase();
    const path = normalizePathname(pathname);
    if (!path) {
      return { status: ROUTE_LOOKUP_STATUS.INVALID_PATH };
    }

    const reserved = classifyReservedRoute(path);
    const parsed = parseCleanUrlRequest(path, host);

    if (parsed.pattern === "homepage") {
      return { status: ROUTE_LOOKUP_STATUS.RESERVED_ROUTE, kind: "homepage" };
    }
    if (parsed.pattern === "locale-home") {
      return { status: ROUTE_LOOKUP_STATUS.RESERVED_ROUTE, kind: "locale-home", locale: parsed.locale };
    }
    if (isThumbShareSpaPath(path)) {
      return { status: ROUTE_LOOKUP_STATUS.RESERVED_ROUTE, kind: "thumb" };
    }
    if (isLegacyContentPath(path) || reserved.kind === "legacy-content" || reserved.kind === "legacy-localized-content") {
      return { status: ROUTE_LOOKUP_STATUS.RESERVED_ROUTE, kind: reserved.kind || "legacy-content" };
    }
    if (reserved.reserved && reserved.kind !== "legal-shortcut") {
      return { status: ROUTE_LOOKUP_STATUS.RESERVED_ROUTE, kind: reserved.kind };
    }

    if (parsed.pattern === "en-content") {
      const result = lookupEnglish(parsed.slug);
      if (result.status === ROUTE_LOOKUP_STATUS.EXISTS && reserved.kind === "legal-shortcut") {
        return { ...result, legalShortcut: true };
      }
      return result;
    }

    if (parsed.pattern === "localized-content") {
      return lookupLocalized(parsed.locale, parsed.slug);
    }

    return { status: ROUTE_LOOKUP_STATUS.MISSING };
  }

  return {
    manifest,
    resolveCleanUrl,
    lookupEnglish,
    lookupLocalized,
    enArticleSlugs,
    enPageSlugs,
    localizedReady,
    enOnly,
    targetLocales,
  };
}

export const defaultRouteResolver = createRouteResolver(bundledManifest);

export function resolveCleanUrl(pathname, options = {}) {
  return defaultRouteResolver.resolveCleanUrl(pathname, options);
}

export {
  classifyReservedRoute,
  isLegacyContentPath,
  isLocaleHomePath,
  isThumbShareSpaPath,
};
