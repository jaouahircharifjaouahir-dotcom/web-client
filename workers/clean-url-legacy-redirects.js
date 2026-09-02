/**
 * Phase 52.3 — atomic legacy → clean URL redirect map (migration-ready, not live).
 * Source of truth: route-manifest.json + LEGACY_P_REDIRECTS retarget rules.
 */
import { LEGACY_P_REDIRECTS } from "./sitemap-canonicals.js";
import { normalizePathname } from "./reserved-routes.js";
import bundledManifest from "./route-manifest.json" with { type: "json" };

const LOCALIZED_LEGACY_2026_RE = /^\/l\/([a-z]{2})\/2026\/(.+)$/i;
const LOCALIZED_LEGACY_P_RE = /^\/l\/([a-z]{2})\/p\/([^/]+\.html)$/i;
const PRIMARY_LEGACY_2026_RE = /^\/2026\/(.+)$/i;
const PRIMARY_LEGACY_P_RE = /^\/p\/([^/]+\.html)$/i;

/** Legal shortcuts on www that should 301 directly to clean utility slugs at migration. */
export const LEGAL_SHORTCUT_TO_CLEAN = Object.freeze({
  "/about": "/about",
  "/privacy": "/privacy",
  "/contact": "/contact",
  "/terms": "/terms-of-use",
  "/embed": "/embed",
});

/**
 * @param {string} legacyPath
 * @param {object} manifest
 * @returns {string} clean path or ""
 */
export function cleanPathForLegacyTarget(legacyPath, manifest = bundledManifest) {
  const path = normalizePathname(legacyPath);
  if (!path) return "";

  for (const row of Object.values(manifest.en?.articles || {})) {
    if (row.legacyPath === path) return row.cleanPath;
  }
  for (const row of Object.values(manifest.en?.pages || {})) {
    if (row.legacyPath === path) return row.cleanPath;
  }
  if (path === "/copyright" || path === "/copyright/index.html") return "/copyright";
  return "";
}

/**
 * Build migration-era LEGACY_P_REDIRECTS with clean URL targets (one hop from /p/*).
 * @param {object} [manifest]
 */
export function buildLegacyPRedirectsClean(manifest = bundledManifest) {
  const out = [];
  for (const rule of LEGACY_P_REDIRECTS) {
    if (rule.to === "/") {
      out.push({ from: rule.from, to: "/", source: "legacy-p-home" });
      continue;
    }
    const clean =
      rule.to.startsWith("/2026/") || rule.to.startsWith("/p/")
        ? cleanPathForLegacyTarget(rule.to, manifest)
        : rule.to;
    if (!clean) throw new Error(`No clean target for legacy /p/ redirect: ${rule.from} → ${rule.to}`);
    out.push({
      from: rule.from,
      to: clean,
      source: "legacy-p-retarget",
      legacyIntermediate: rule.to.startsWith("/2026/") || rule.to.startsWith("/p/") ? rule.to : undefined,
    });
  }
  return Object.freeze(out);
}

/**
 * @typedef {{ from: string, to: string, status: 301, source: string, locale?: string, contentId?: string, legacyIntermediate?: string }} AtomicRedirectRule
 */

/**
 * @param {object} [manifest]
 * @returns {AtomicRedirectRule[]}
 */
export function buildAtomicRedirectMap(manifest = bundledManifest) {
  /** @type {AtomicRedirectRule[]} */
  const rules = [];
  const fromSet = new Set();
  const enOnly = new Set(manifest.enOnly || []);

  function add(from, to, meta) {
    const sourcePath = normalizePathname(from);
    const targetPath = normalizePathname(to);
    if (!sourcePath || !targetPath) return;
    if (sourcePath === targetPath) return;
    if (fromSet.has(sourcePath)) {
      throw new Error(`Duplicate atomic redirect source: ${sourcePath}`);
    }
  if (targetPath.startsWith("/2026/") || targetPath.startsWith("/p/")) {
      throw new Error(`Atomic redirect target must be clean, not legacy: ${sourcePath} → ${targetPath}`);
    }
    rules.push({ from: sourcePath, to: targetPath, status: 301, ...meta });
    fromSet.add(sourcePath);
  }

  function addLegacyHtmlPair(legacyHtmlPath, cleanPath, meta) {
    add(legacyHtmlPath, cleanPath, meta);
    if (legacyHtmlPath.endsWith(".html")) {
      add(legacyHtmlPath.replace(/\.html$/i, ""), cleanPath, { ...meta, variant: "extensionless" });
    }
  }

  for (const [contentId, row] of Object.entries(manifest.en?.articles || {})) {
    addLegacyHtmlPair(row.legacyPath, row.cleanPath, {
      source: "manifest-en-article",
      contentId,
      locale: "en",
    });
  }

  for (const [contentId, row] of Object.entries(manifest.en?.pages || {})) {
    if (contentId === "copyright") continue;
    addLegacyHtmlPair(row.legacyPath, row.cleanPath, {
      source: "manifest-en-page",
      contentId,
      locale: "en",
    });
  }

  for (const { from, to, legacyIntermediate } of buildLegacyPRedirectsClean(manifest)) {
    add(from, to, { source: "legacy-p-retarget", legacyIntermediate });
  }

  for (const [shortcutFrom, cleanTo] of Object.entries(LEGAL_SHORTCUT_TO_CLEAN)) {
    add(shortcutFrom, cleanTo, { source: "legal-shortcut-clean" });
  }

  for (const [locale, entries] of Object.entries(manifest.localized || {})) {
    for (const [contentId, row] of Object.entries(entries)) {
      if (enOnly.has(contentId)) continue;
      addLegacyHtmlPair(row.legacyPath, row.cleanPath, {
        source: "manifest-localized",
        contentId,
        locale,
      });
    }
  }

  return rules.sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * @param {AtomicRedirectRule[]} rules
 */
export function createLegacyCleanRedirectResolver(rules = buildAtomicRedirectMap()) {
  const byPath = new Map(rules.map((rule) => [rule.from, rule]));
  const cleanTargets = new Set(rules.map((rule) => rule.to));

  function resolve(pathname) {
    const path = normalizePathname(pathname);
    if (!path) return null;
    if (cleanTargets.has(path)) return null;
    return byPath.get(path) || null;
  }

  return { rules, byPath, cleanTargets, resolve };
}

export const defaultLegacyCleanResolver = createLegacyCleanRedirectResolver();

/**
 * Resolve a migration-era legacy path to a clean pathname (no host).
 * Returns null when no redirect applies (caller serves 404 or passes through).
 */
export function resolveLegacyCleanRedirect(pathname) {
  return defaultLegacyCleanResolver.resolve(pathname);
}

/**
 * @param {AtomicRedirectRule[]} rules
 */
export function validateAtomicRedirectMap(rules = buildAtomicRedirectMap()) {
  const errors = [];
  const byFrom = new Map();
  const cleanTargets = new Set();

  for (const rule of rules) {
    if (rule.from === rule.to) errors.push(`self-redirect: ${rule.from}`);
    if (rule.from.startsWith("/2026/") === false && rule.from.startsWith("/p/") === false && !rule.from.startsWith("/l/") && !LEGAL_SHORTCUT_TO_CLEAN[rule.from]) {
      if (!rule.from.startsWith("/")) errors.push(`invalid from: ${rule.from}`);
    }
    if (rule.to.startsWith("/2026/") || rule.to.startsWith("/p/")) {
      errors.push(`legacy target not allowed: ${rule.from} → ${rule.to}`);
    }
    if (byFrom.has(rule.from)) errors.push(`duplicate from: ${rule.from}`);
    byFrom.set(rule.from, rule.to);
    cleanTargets.add(rule.to);
  }

  for (const rule of rules) {
    if (cleanTargets.has(rule.from)) {
      errors.push(`clean→redirect chain risk: ${rule.from} → ${rule.to}`);
    }
  }

  for (const rule of rules) {
    let cursor = rule.to;
    const seen = new Set([rule.from]);
    while (byFrom.has(cursor)) {
      if (seen.has(cursor)) {
        errors.push(`loop: ${rule.from} → … → ${cursor}`);
        break;
      }
      seen.add(cursor);
      cursor = byFrom.get(cursor);
    }
  }

  return { ok: errors.length === 0, errors, count: rules.length };
}

/** Count rules by category for reports. */
export function summarizeAtomicRedirectMap(rules = buildAtomicRedirectMap()) {
  let en = 0;
  let localized = 0;
  for (const rule of rules) {
    if (rule.from.startsWith("/l/")) localized += 1;
    else en += 1;
  }
  return { total: rules.length, en, localized };
}

export { LEGACY_P_REDIRECTS };
