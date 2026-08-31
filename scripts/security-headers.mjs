/**
 * Phase 11A — shared security header constants for static _headers and Cloudflare edge rules.
 * Delivery priority: Cloudflare Response Header Rules → static _headers → Worker (avoid).
 */

/** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options */
export const X_CONTENT_TYPE_OPTIONS = "nosniff";

/** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy */
export const REFERRER_POLICY = "strict-origin-when-cross-origin";

/**
 * Minimal Permissions-Policy based on codebase audit (Phase 11A).
 * Clipboard is intentionally omitted — src/services/clipboard.ts uses navigator.clipboard.writeText.
 */
export const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

/**
 * Report-Only CSP — inventory from generate-static-site.mjs, site-header.mjs, ga-boot.js, config.ts.
 * Includes 'unsafe-inline' for theme boot IIFE + JSON-LD until hash/nonce refactor (Phase 11 audit).
 * frame-ancestors 'self' is report-only and does not block third-party embed of /?embed=1.
 */
export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://analytics.ahrefs.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.ytimg.com https://img.youtube.com https://blogger.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://analytics.ahrefs.com https://*.ytimg.com https://img.youtube.com",
  "frame-src 'self' https://www.11tik.com https://*.11tik.com",
  "frame-ancestors 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
].join("; ");

/** HSTS zone baseline — do not add preload in this phase. */
export const HSTS_ZONE_BASELINE = "max-age=31536000; includeSubDomains";

export const RULE_PREFIX_SECURITY = "11tik-p11-security:";

export const SECURITY_HEADERS_PHASE = "http_response_headers_transform";

/** Header names smoke tests assert (lowercase keys). */
export const SECURITY_SMOKE_HEADERS = Object.freeze({
  nosniff: "x-content-type-options",
  referrer: "referrer-policy",
  permissions: "permissions-policy",
  cspReportOnly: "content-security-policy-report-only",
  hsts: "strict-transport-security",
});

/**
 * @returns {Record<string, string>}
 */
export function securityHeaderMap() {
  return {
    "X-Content-Type-Options": X_CONTENT_TYPE_OPTIONS,
    "Referrer-Policy": REFERRER_POLICY,
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Content-Security-Policy-Report-Only": CSP_REPORT_ONLY,
  };
}

/**
 * Netlify/Pages-style block for dist-assets/_headers (Workers Static Assets).
 * @returns {string}
 */
export function buildGlobalAssetsSecurityHeadersBlock() {
  const lines = ["/*"];
  for (const [name, value] of Object.entries(securityHeaderMap())) {
    lines.push(`  ${name}: ${value}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Cloudflare http_response_headers_transform action_parameters.headers map.
 * @returns {Record<string, { operation: 'set', value: string }>}
 */
export function buildCloudflareSecurityHeaderParameters() {
  /** @type {Record<string, { operation: 'set', value: string }>} */
  const headers = {};
  for (const [name, value] of Object.entries(securityHeaderMap())) {
    headers[name] = { operation: "set", value };
  }
  return headers;
}

/** @returns {object[]} managed rules for http_response_headers_transform phase */
export function buildSecurityHeaderRules() {
  return [
    {
      description: `${RULE_PREFIX_SECURITY}global response headers`,
      expression: "true",
      action: "rewrite",
      action_parameters: {
        headers: buildCloudflareSecurityHeaderParameters(),
      },
    },
  ];
}

export function isSecurityOwnedRule(rule) {
  return String(rule?.description || "").startsWith(RULE_PREFIX_SECURITY);
}

/**
 * Validate response headers for production smoke (pure).
 * @param {Record<string, string>} headers lower-case keys
 * @param {{ requireCspReportOnly?: boolean, allowFrameDeny?: boolean }} [opts]
 * @returns {string[]} issues (empty = pass)
 */
export function validateSecurityHeaders(headers, { requireCspReportOnly = true, allowFrameDeny = false } = {}) {
  const issues = [];
  const h = headers ?? {};

  if (h[SECURITY_SMOKE_HEADERS.nosniff] !== X_CONTENT_TYPE_OPTIONS) {
    issues.push(`missing or wrong ${SECURITY_SMOKE_HEADERS.nosniff}=${h[SECURITY_SMOKE_HEADERS.nosniff] ?? ""}`);
  }
  if (h[SECURITY_SMOKE_HEADERS.referrer] !== REFERRER_POLICY) {
    issues.push(`missing or wrong ${SECURITY_SMOKE_HEADERS.referrer}=${h[SECURITY_SMOKE_HEADERS.referrer] ?? ""}`);
  }
  const pp = h[SECURITY_SMOKE_HEADERS.permissions] ?? "";
  if (!pp.includes("camera=()") || !pp.includes("microphone=()") || !pp.includes("geolocation=()")) {
    issues.push(`missing or incomplete ${SECURITY_SMOKE_HEADERS.permissions}=${pp}`);
  }
  if (pp.includes("clipboard=()")) {
    issues.push("permissions-policy must not block clipboard (product uses navigator.clipboard)");
  }
  if (requireCspReportOnly) {
    const csp = h[SECURITY_SMOKE_HEADERS.cspReportOnly] ?? "";
    if (!csp.includes("default-src 'self'")) {
      issues.push(`missing ${SECURITY_SMOKE_HEADERS.cspReportOnly}`);
    }
    if (csp.includes("Content-Security-Policy:") || h["content-security-policy"]) {
      issues.push("enforced Content-Security-Policy must not be present in Phase 11A");
    }
  }
  const xfo = (h["x-frame-options"] ?? "").toUpperCase();
  if (!allowFrameDeny && (xfo === "DENY" || xfo === "SAMEORIGIN")) {
    issues.push(`global X-Frame-Options=${xfo} would break embed product surfaces`);
  }
  const hsts = h[SECURITY_SMOKE_HEADERS.hsts] ?? "";
  if (hsts && !hsts.includes("max-age=31536000")) {
    issues.push(`HSTS unexpected: ${hsts}`);
  }
  return issues;
}
