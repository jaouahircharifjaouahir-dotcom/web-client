/**
 * Phase 17.1 — historical URL families with no SEO equity.
 * Used by tests to block accidental recovery logic in build/link engines.
 */
export const HISTORICAL_NON_EQUITY_FAMILIES = Object.freeze([
  {
    id: "music-noise",
    pattern: /^\/music\//i,
    classification: "NOISE",
    action: "IGNORE",
    notes: "Legacy generated crawl debt; no proven traffic or RDs.",
  },
  {
    id: "platform-backlink-factory",
    pattern: /\/backlink\//i,
    classification: "NOISE",
    action: "IGNORE",
    notes: "Internal historical URL factory; path word backlink ≠ external backlink.",
  },
]);

export const FORBIDDEN_RECOVERY_ACTIONS = Object.freeze([
  "mass_301_to_homepage",
  "mass_301_to_unrelated_guide",
  "sitemap_include",
  "indexnow_include",
  "treat_as_backlink_evidence",
  "generate_replacement_content",
]);

export function isNonEquityHistoricalPath(pathOrUrl) {
  const s = String(pathOrUrl || "");
  return HISTORICAL_NON_EQUITY_FAMILIES.some((f) => f.pattern.test(s));
}

export function assertNoRecoveryTarget(pathOrUrl) {
  if (isNonEquityHistoricalPath(pathOrUrl)) {
    throw new Error(`Historical non-equity URL must not be a recovery target: ${pathOrUrl}`);
  }
}
