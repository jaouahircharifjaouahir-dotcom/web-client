/**
 * Internal link localization for generated HTML.
 * Prefer localized URL when target locale is ready; else English canonical.
 * Phase 54: legacy /2026/ and /p/ hrefs map to clean canonical paths before lookup.
 */
import { SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";

const BLOCKED_PATH_PREFIXES = [
  "/search",
  "/feeds",
  "/api",
  "/web-client/hold-queue",
  "/web-client/__extracts",
  "/hold-queue",
];

const SKIP_HREF_PREFIXES = ["mailto:", "tel:", "javascript:", "#"];

/** Build path → { en, locales } from publishability manifest contents. */
export function buildPathLinkIndex(manifestContents) {
  const byPath = new Map();
  for (const entry of Object.values(manifestContents || {})) {
    const path = normalizeInternalPath(entry.canonicalPath);
    if (!path) continue;
    const locales = {};
    for (const [locale, row] of Object.entries(entry.locales || {})) {
      if (row.status === "ready" && row.url) locales[locale] = row.url;
    }
    byPath.set(path, { en: entry.canonicalUrl, locales });
  }
  return byPath;
}

/** @deprecated adapter — contentId-keyed index from tests/callers */
export function pathIndexFromContentIndex(contentIndex) {
  const byPath = new Map();
  for (const row of Object.values(contentIndex || {})) {
    const path = normalizeInternalPath(row.path);
    if (path) byPath.set(path, row);
  }
  return byPath;
}

export function normalizeInternalPath(pathname) {
  const path = String(pathname || "")
    .replace(/\/+$/, "")
    .trim();
  return path || "/";
}

/** Map legacy public path segments to Phase 53 clean canonical path. */
export function legacyPublicPathToCanonicalPath(pathname) {
  const path = normalizeInternalPath(pathname);
  const article = /^\/2026\/(?:\d{2}\/)?([a-z0-9-]+)\.html$/i.exec(path);
  if (article) return `/${article[1]}`;
  const page = /^\/p\/([a-z0-9-]+)\.html$/i.exec(path);
  if (page) return `/${page[1]}`;
  return path;
}

function localeHostCode(hostname) {
  const match = /^([a-z]{2})\.11tik\.com$/i.exec(String(hostname || "").toLowerCase());
  return match ? match[1].toLowerCase() : "";
}

function isBlockedPath(path) {
  return BLOCKED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function shouldSkipHref(href) {
  const h = String(href || "").trim();
  if (!h) return true;
  return SKIP_HREF_PREFIXES.some((p) => h.startsWith(p));
}

function resolvePathIndex(indexOrPathMap) {
  if (indexOrPathMap instanceof Map) return indexOrPathMap;
  return pathIndexFromContentIndex(indexOrPathMap);
}

/**
 * Rewrite one internal href for `{locale}` when English canonical matches inventory.
 * Preserves query string and hash fragment.
 */
export function rewriteInternalHref(href, locale, indexOrPathMap) {
  if (shouldSkipHref(href)) return href;

  const pathIndex = resolvePathIndex(indexOrPathMap);
  let url;
  try {
    url = new URL(href, SITE_ORIGIN);
  } catch {
    return href;
  }

  if (!url.hostname.endsWith("11tik.com")) return href;

  const canonPath = canonicalPathFromInternalHref(href);
  if (!canonPath || canonPath === "/" || isBlockedPath(canonPath)) return href;

  const row = pathIndex.get(canonPath);
  if (!row) return href;

  const hostLocale = localeHostCode(url.hostname);
  const targetLocale = hostLocale || locale;
  const localized = row.locales?.[targetLocale];
  const base = localized || row.en;
  if (!base) return href;

  try {
    const out = new URL(base);
    if (url.search) out.search = url.search;
    if (url.hash) out.hash = url.hash;
    return out.href;
  } catch {
    return href;
  }
}

/** Rewrite href attributes in an HTML fragment (body content only). */
export function localizeInternalLinksInHtml(html, locale, indexOrPathMap) {
  if (!html || typeof html !== "string") return html;
  return html.replace(/href=(["'])([^"']*)\1/gi, (full, quote, href) => {
    const next = rewriteInternalHref(href, locale, indexOrPathMap);
    if (next === href) return full;
    return `href=${quote}${next}${quote}`;
  });
}

/** Strip `/l/{locale}` prefix and normalize legacy segments to clean canonical paths. */
export function canonicalPathFromInternalHref(href) {
  try {
    const url = new URL(href, SITE_ORIGIN);
    const path = normalizeInternalPath(url.pathname);
    const localized = path.match(/^\/l\/[a-z]{2,3}(\/.+)$/i);
    return localized ? legacyPublicPathToCanonicalPath(localized[1]) : legacyPublicPathToCanonicalPath(path);
  } catch {
    return null;
  }
}

/** Classify internal 11tik links in page body HTML. */
export function classifyInternalLinksInHtml(html, locale, pathIndex) {
  const body = String(html || "").split("</head>")[1] || html || "";
  const counts = { localized: 0, englishFallback: 0, broken: 0, incorrect: 0, total: 0 };
  const samples = { broken: [], incorrect: [] };

  for (const m of body.matchAll(/href=(["'])([^"']*)\1/gi)) {
    const href = m[2];
    if (!href.includes("11tik.com") && !href.startsWith("/")) continue;
    if (shouldSkipHref(href)) continue;

    let hrefUrl;
    try {
      hrefUrl = new URL(href, SITE_ORIGIN);
    } catch {
      counts.broken += 1;
      if (samples.broken.length < 5) samples.broken.push({ href, reason: "parse" });
      continue;
    }
    if (!hrefUrl.hostname.endsWith("11tik.com")) continue;

    const canonPath = canonicalPathFromInternalHref(href);
    if (!canonPath || canonPath === "/") continue;

    const row = pathIndex.get(canonPath);
    if (!row) continue;

    counts.total += 1;
    const expectedLocalized = row.locales?.[locale];
    const expectedEnglish = row.en;

    if (expectedLocalized) {
      const expected = new URL(expectedLocalized);
      if (hrefUrl.search) expected.search = hrefUrl.search;
      if (hrefUrl.hash) expected.hash = hrefUrl.hash;
      if (href === expected.href) counts.localized += 1;
      else if (href === expectedEnglish || href.startsWith(String(expectedEnglish))) {
        counts.incorrect += 1;
        if (samples.incorrect.length < 5) samples.incorrect.push({ href, expected: expected.href });
      } else {
        counts.broken += 1;
        if (samples.broken.length < 5) samples.broken.push({ href, expected: expected.href });
      }
    } else if (href === expectedEnglish || href.startsWith(String(expectedEnglish))) {
      counts.englishFallback += 1;
    }
  }

  return { ...counts, samples };
}

export function buildReadyUrlIndex(compactManifestContents) {
  const index = {};
  for (const [contentId, entry] of Object.entries(compactManifestContents || {})) {
    index[contentId] = {
      path: entry.path,
      en: entry.en,
      locales: entry.locales || {},
    };
  }
  return index;
}
