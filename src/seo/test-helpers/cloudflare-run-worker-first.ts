/**
 * Cloudflare Static Assets `run_worker_first` pattern matcher.
 *
 * Aligns with Workers docs: glob patterns with `*` (including middle segments),
 * negative `!/` exclusions take precedence, order is insignificant.
 *
 * @see https://developers.cloudflare.com/workers/static-assets/binding/#run_worker_first
 */

/** Phase 7B utility negative; Phase R1 removed localized 2026 .html asset-first exclusion. */
export const PHASE7B_LOCALE_RWF_NEGATIVES = [
  "!/l/*/p/*.html",
] as const;

/** Phase 5 broad locale negatives (superseded — kept for regression contrast). */
export const PHASE5_BROAD_LOCALE_RWF_NEGATIVES = [
  "!/l/*/2026/*",
  "!/l/*/p/*",
] as const;

/** Pre-Phase-7B shared rules (through /2026/*). */
const SHARED_RUN_WORKER_FIRST = [
  "/",
  "/thumb/*",
  "/feeds/pages/*",
  "/feeds/comments/*",
  "/feeds/other/*",
  "/feeds/posts/default",
  "/sitemap-images.xml",
  "/sitemap-pages.xml",
  "/search",
  "/search/*",
  "/copyright*",
  "/p/*",
  "!/p/about.html",
  "!/p/privacy.html",
  "!/p/terms-of-use.html",
  "!/p/contact.html",
  "!/p/embed.html",
  "!/p/keyword-tools.html",
  "/2026/*",
] as const;

/** Production `run_worker_first` — matches live wrangler.jsonc after Phase 7B. */
export const PRODUCTION_RUN_WORKER_FIRST = [
  ...SHARED_RUN_WORKER_FIRST,
  "/l/*",
  ...PHASE7B_LOCALE_RWF_NEGATIVES,
] as const;

/** Live production routing (Phase 7B narrow locale negatives). */
export const PHASE7B_RUN_WORKER_FIRST = PRODUCTION_RUN_WORKER_FIRST;

/** Phase 5 broad canary (regression contrast only — blanket /l/* + broad negatives). */
export const PHASE5_BROAD_RUN_WORKER_FIRST = [
  ...SHARED_RUN_WORKER_FIRST,
  "/l/*",
  ...PHASE5_BROAD_LOCALE_RWF_NEGATIVES,
] as const;

/**
 * Split pathname into segments; trailing slash adds a final empty segment so
 * `/path/file.html/` does not match a `*.html` exclusion pattern.
 */
export function splitPathnameSegments(pathname: string): string[] {
  let path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const trailingSlash = path.length > 1 && path.endsWith("/");
  if (trailingSlash) path = path.slice(0, -1);
  const parts = path.split("/").filter((part) => part.length > 0);
  if (trailingSlash) parts.push("");
  return parts;
}

function segmentGlobMatch(segment: string, patternSegment: string): boolean {
  if (patternSegment === "*") return true;
  if (!patternSegment.includes("*")) return segment === patternSegment;
  const re = new RegExp(
    `^${patternSegment.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`,
  );
  return re.test(segment);
}

function matchSegmentGlobPathname(pathname: string, pattern: string): boolean {
  const pathParts = splitPathnameSegments(pathname);
  const patternParts = pattern.split("/").filter((part) => part.length > 0);
  if (pathParts.length !== patternParts.length) return false;
  for (let i = 0; i < patternParts.length; i++) {
    if (!segmentGlobMatch(pathParts[i]!, patternParts[i]!)) return false;
  }
  return true;
}

/**
 * Returns true when `pattern` (without leading `!`) matches `pathname`.
 */
export function cloudflarePathMatchesPattern(pathname: string, pattern: string): boolean {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const starCount = (pattern.match(/\*/g) ?? []).length;

  if (starCount === 0) {
    return normalized === pattern;
  }

  if (starCount === 1 && pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1);
    const base = prefix.slice(0, -1);
    return normalized === base || normalized.startsWith(prefix);
  }

  if (starCount === 1 && pattern.endsWith("*") && !pattern.endsWith("/*")) {
    return normalized.startsWith(pattern.slice(0, -1));
  }

  // Deep tail: e.g. /l/*/2026/* → /l/{locale}/2026/{rest…}
  if (pattern.endsWith("/*") && starCount > 1) {
    const head = pattern.slice(0, -2);
    const re = new RegExp(
      `^${head.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]+")}(?:/.*)?$`,
    );
    return re.test(normalized);
  }

  return matchSegmentGlobPathname(normalized, pattern);
}

/**
 * Simulates Cloudflare negative `run_worker_first`: any positive match and no
 * negative match → Worker runs before static assets.
 */
export function matchesRunWorkerFirstPatterns(pathname: string, patterns: readonly string[]): boolean {
  let positive = false;
  let negative = false;
  for (const rule of patterns) {
    if (rule.startsWith("!/")) {
      if (cloudflarePathMatchesPattern(pathname, rule.slice(1))) negative = true;
    } else if (cloudflarePathMatchesPattern(pathname, rule)) {
      positive = true;
    }
  }
  return positive && !negative;
}

export function matchesPhase7bRunWorkerFirst(pathname: string): boolean {
  return matchesRunWorkerFirstPatterns(pathname, PHASE7B_RUN_WORKER_FIRST);
}

export function matchesPhase5BroadRunWorkerFirst(pathname: string): boolean {
  return matchesRunWorkerFirstPatterns(pathname, PHASE5_BROAD_RUN_WORKER_FIRST);
}
