/**
 * Phase 2 Cloudflare edge rule definitions (shared by CLI scripts + tests).
 * Each rule family uses an isolated description prefix — never a broad shared prefix.
 */
import { INDEXABLE_UTILITY_PATHS, SITE_ORIGIN, collectPAllowlistPaths } from "../workers/sitemap-canonicals.js";

/** Query canonicalization rules — one per indexable utility .html path. */
export const RULE_PREFIX_QUERY = "11tik-p2-query:";

/** Unknown /p/* hard 404 — single rule. */
export const RULE_PREFIX_404 = "11tik-p2-404:";

/** Phase 53: legal shortcuts — canonical clean paths; CF 11tik-p3-legal:* rules must be removed in production. */
export const RULE_PREFIX_LEGAL = "11tik-p3-legal:";

/** Phase 5.3 localized trailing-slash .html/ → strip slash on same host (legacy paths).
 *  With Phase 53 Worker-first (`run_worker_first: /*`), atomic legacy redirects usually handle
 *  `.html/` → clean URL in one hop before this CF rule runs. Rules remain defense-in-depth if
 *  RWF changes; production removal is optional — see Phase 54 runbook in legal-shortcuts.test.ts.
 */
export const RULE_PREFIX_LSLASH = "11tik-p5-lslash:";

export const QUERY_PHASE = "http_request_dynamic_redirect";
export const UNKNOWN_404_PHASE = "http_request_firewall_custom";

/** www legal shortcut paths and their canonical clean targets (Worker-served; no CF redirect). */
export const LEGAL_SHORTCUT_REDIRECTS = Object.freeze([
  { from: "/about", to: "/about", slug: "about" },
  { from: "/privacy", to: "/privacy", slug: "privacy" },
  { from: "/terms", to: "/terms-of-use", slug: "terms" },
  { from: "/contact", to: "/contact", slug: "contact" },
]);

/**
 * Phase 53: returns no CF edge rules — clean shortcuts are served by the Worker resolver.
 * Remove any live 11tik-p3-legal:* rules via `node scripts/cf-legal-shortcuts.mjs apply --confirm --remove`.
 */
export function buildLegalShortcutRules() {
  return [];
}

export function buildQueryCanonicalizeRules() {
  return INDEXABLE_UTILITY_PATHS.map((path) => {
    const slug = path.replace(/^\/p\//, "").replace(/\.html$/, "").replace(/^\//, "");
    return {
      description: `${RULE_PREFIX_QUERY}${slug}`,
      expression: `(http.host eq "www.11tik.com" and http.request.uri.path eq "${path}" and len(http.request.uri.query) > 0)`,
      action: "redirect",
      action_parameters: {
        from_value: {
          status_code: 301,
          preserve_query_string: false,
          target_url: {
            value: `${SITE_ORIGIN}${path}`,
          },
        },
      },
    };
  });
}

/** Phase 5.3: /l/{locale}/p/*.html/ and /l/{locale}/2026/…html/ → same-host clean .html */
export function buildLocalizedTrailingSlashRules() {
  const target = {
    expression: 'concat("https://", http.host, regex_replace(http.request.uri.path, "/$", ""))',
  };
  return [
    {
      description: `${RULE_PREFIX_LSLASH}util`,
      expression:
        '(ends_with(http.request.uri.path, ".html/") and http.request.uri.path matches "^/l/[a-z]{2}/p/[^/]+\\.html/$")',
      action: "redirect",
      action_parameters: {
        from_value: {
          status_code: 301,
          preserve_query_string: false,
          target_url: target,
        },
      },
    },
    {
      description: `${RULE_PREFIX_LSLASH}article`,
      expression:
        '(ends_with(http.request.uri.path, ".html/") and http.request.uri.path matches "^/l/[a-z]{2}/2026/.+\\.html/$")',
      action: "redirect",
      action_parameters: {
        from_value: {
          status_code: 301,
          preserve_query_string: false,
          target_url: target,
        },
      },
    },
  ];
}

export function buildUnknown404Rule() {
  const paths = collectPAllowlistPaths();
  const quoted = paths.map((p) => `"${p}"`).join(" ");
  return {
    description: `${RULE_PREFIX_404}unknown /p/* hard 404`,
    expression: `(http.host eq "www.11tik.com" and starts_with(http.request.uri.path, "/p/") and not http.request.uri.path in {${quoted}})`,
    action: "block",
    action_parameters: {
      response: {
        status_code: 404,
        content_type: "text/html",
        content:
          "<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>",
      },
    },
  };
}

export function isQueryOwnedRule(rule) {
  return String(rule?.description || "").startsWith(RULE_PREFIX_QUERY);
}

export function is404OwnedRule(rule) {
  return String(rule?.description || "").startsWith(RULE_PREFIX_404);
}

export function isLegalOwnedRule(rule) {
  return String(rule?.description || "").startsWith(RULE_PREFIX_LEGAL);
}

export function isLslashOwnedRule(rule) {
  return String(rule?.description || "").startsWith(RULE_PREFIX_LSLASH);
}
