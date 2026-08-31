/**
 * Phase 17.1 — build-time indexation safety checks (no live mutations).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP,
  LEGACY_P_REDIRECTS,
  loadGuidePostHrefsFromFile,
} from "../../workers/sitemap-canonicals.js";
import { isBlockedInternalTarget, isHistoricalNonEquityUrl } from "../i18n/contextual-internal-links.mjs";
import { isNonEquityHistoricalPath } from "./historical-url-firewall.mjs";

const ROOT = process.cwd();

export function loadCurrentGuideHrefs() {
  const postsTs = readFileSync(join(ROOT, "src/content/posts.ts"), "utf8");
  return loadGuidePostHrefsFromFile(postsTs);
}

export function assertInternalLinkTargetsSafe(targets) {
  const errors = [];
  for (const target of targets) {
    if (isBlockedInternalTarget(target)) errors.push(`blocked internal target: ${target}`);
    if (isHistoricalNonEquityUrl(target)) errors.push(`historical non-equity target: ${target}`);
  }
  return errors;
}

export function assertSitemapHasNoRetiredOrJunk(sitemapLocs) {
  const errors = [];
  const retired = new Set(LEGACY_GUIDE_PATHS_EXCLUDED_FROM_SITEMAP);
  for (const loc of sitemapLocs) {
    let path;
    try {
      path = new URL(loc).pathname;
    } catch {
      errors.push(`invalid sitemap loc: ${loc}`);
      continue;
    }
    if (retired.has(path)) errors.push(`retired path in sitemap: ${path}`);
    if (isNonEquityHistoricalPath(path)) errors.push(`non-equity path in sitemap: ${path}`);
  }
  return errors;
}

export function assertNoRedirectSourcesAsLinkTargets(targets) {
  const redirectSources = new Set(LEGACY_P_REDIRECTS.map((r) => r.from));
  return targets.filter((t) => {
    try {
      return redirectSources.has(new URL(t, "https://www.11tik.com").pathname);
    } catch {
      return false;
    }
  });
}

export function assertAllCurrentGuidesDiscoverable(guideHrefs, sitemapLocs) {
  const set = new Set(sitemapLocs);
  return guideHrefs.filter((href) => !set.has(href));
}

export function runIndexationSafetyChecks({ sitemapLocs = [], internalLinkTargets = [] } = {}) {
  return {
    blockedTargets: assertInternalLinkTargetsSafe(internalLinkTargets),
    sitemapRetiredOrJunk: assertSitemapHasNoRetiredOrJunk(sitemapLocs),
    redirectSourceLinks: assertNoRedirectSourcesAsLinkTargets(internalLinkTargets),
    missingGuides: assertAllCurrentGuidesDiscoverable(loadCurrentGuideHrefs(), sitemapLocs),
  };
}
