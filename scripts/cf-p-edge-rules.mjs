/**
 * Phase 2 Cloudflare edge rule definitions (shared by CLI scripts + tests).
 * Each rule family uses an isolated description prefix — never a broad shared prefix.
 */
import { INDEXABLE_UTILITY_PATHS, SITE_ORIGIN, collectPAllowlistPaths } from "../workers/sitemap-canonicals.js";

/** Query canonicalization rules — one per indexable utility .html path. */
export const RULE_PREFIX_QUERY = "11tik-p2-query:";

/** Unknown /p/* hard 404 — single rule. */
export const RULE_PREFIX_404 = "11tik-p2-404:";

/** Phase 3 legal shortcuts — /about → /p/about.html, etc. */
export const RULE_PREFIX_LEGAL = "11tik-p3-legal:";

export const QUERY_PHASE = "http_request_dynamic_redirect";
export const UNKNOWN_404_PHASE = "http_request_firewall_custom";

/** www legal shortcut paths → indexable utility .html destinations. */
export const LEGAL_SHORTCUT_REDIRECTS = Object.freeze([
  { from: "/about", to: "/p/about.html", slug: "about" },
  { from: "/privacy", to: "/p/privacy.html", slug: "privacy" },
  { from: "/terms", to: "/p/terms-of-use.html", slug: "terms" },
  { from: "/contact", to: "/p/contact.html", slug: "contact" },
]);

export function buildLegalShortcutRules() {
  return LEGAL_SHORTCUT_REDIRECTS.map(({ from, to, slug }) => ({
    description: `${RULE_PREFIX_LEGAL}${slug}`,
    expression: `(http.host eq "www.11tik.com" and http.request.uri.path eq "${from}")`,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        preserve_query_string: false,
        target_url: {
          value: `${SITE_ORIGIN}${to}`,
        },
      },
    },
  }));
}

export function buildQueryCanonicalizeRules() {
  return INDEXABLE_UTILITY_PATHS.map((path) => {
    const slug = path.replace(/^\/p\//, "").replace(/\.html$/, "");
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
