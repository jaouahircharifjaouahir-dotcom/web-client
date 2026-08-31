import { describe, expect, it } from "vitest";
import { mergeRulesByDescription, ownedRules, planRulesetMerge } from "../../scripts/cf-api.mjs";
import {
  CSP_REPORT_ONLY,
  PERMISSIONS_POLICY,
  REFERRER_POLICY,
  RULE_PREFIX_SECURITY,
  X_CONTENT_TYPE_OPTIONS,
  buildCloudflareSecurityHeaderParameters,
  buildGlobalAssetsSecurityHeadersBlock,
  buildSecurityHeaderRules,
  isSecurityOwnedRule,
  validateSecurityHeaders,
} from "../../scripts/security-headers.mjs";

describe("Phase 11A — security headers", () => {
  it("defines expected header values", () => {
    expect(X_CONTENT_TYPE_OPTIONS).toBe("nosniff");
    expect(REFERRER_POLICY).toBe("strict-origin-when-cross-origin");
    expect(PERMISSIONS_POLICY).toContain("camera=()");
    expect(PERMISSIONS_POLICY).not.toContain("clipboard=()");
    expect(CSP_REPORT_ONLY).toContain("default-src 'self'");
    expect(CSP_REPORT_ONLY).toContain("analytics.ahrefs.com");
    expect(CSP_REPORT_ONLY).toContain("googletagmanager.com");
    expect(CSP_REPORT_ONLY).toContain("ytimg.com");
    expect(CSP_REPORT_ONLY).not.toContain("unsafe-eval");
  });

  it("buildGlobalAssetsSecurityHeadersBlock includes global path rule", () => {
    const block = buildGlobalAssetsSecurityHeadersBlock();
    expect(block).toMatch(/^\/\*\n/);
    expect(block).toContain("X-Content-Type-Options: nosniff");
    expect(block).toContain("Content-Security-Policy-Report-Only:");
  });

  it("validateSecurityHeaders passes complete header set", () => {
    const headers = {
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "content-security-policy-report-only": CSP_REPORT_ONLY,
      "strict-transport-security": "max-age=31536000; includeSubDomains",
    };
    expect(validateSecurityHeaders(headers)).toEqual([]);
  });

  it("validateSecurityHeaders rejects enforced CSP and global X-Frame-Options DENY", () => {
    const bad = {
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": PERMISSIONS_POLICY,
      "content-security-policy": "default-src 'self'",
      "x-frame-options": "DENY",
    };
    const issues = validateSecurityHeaders(bad);
    expect(issues.some((i) => i.includes("content-security-policy-report-only"))).toBe(true);
    expect(issues.some((i) => i.includes("X-Frame-Options"))).toBe(true);
    expect(issues.some((i) => i.includes("enforced Content-Security-Policy"))).toBe(true);
  });

  it("validateSecurityHeaders rejects clipboard blocking", () => {
    const issues = validateSecurityHeaders({
      "x-content-type-options": "nosniff",
      "referrer-policy": REFERRER_POLICY,
      "permissions-policy": "clipboard=()",
      "content-security-policy-report-only": CSP_REPORT_ONLY,
    });
    expect(issues.some((i) => i.includes("clipboard"))).toBe(true);
  });
});

describe("Phase 11A — Cloudflare security header rules", () => {
  const rules = buildSecurityHeaderRules();

  it("uses isolated description prefix and http_response_headers_transform shape", () => {
    expect(rules).toHaveLength(1);
    expect(rules[0].description).toBe(`${RULE_PREFIX_SECURITY}global response headers`);
    expect(rules[0].expression).toBe("true");
    expect(rules[0].action).toBe("rewrite");
    expect(rules[0].action_parameters.headers["X-Content-Type-Options"]).toEqual({
      operation: "set",
      value: "nosniff",
    });
  });

  it("buildCloudflareSecurityHeaderParameters sets all four headers", () => {
    const params = buildCloudflareSecurityHeaderParameters();
    expect(Object.keys(params).sort()).toEqual([
      "Content-Security-Policy-Report-Only",
      "Permissions-Policy",
      "Referrer-Policy",
      "X-Content-Type-Options",
    ]);
  });

  it("merge preserves unrelated transform rules", () => {
    const unrelated = { description: "customer: add header", expression: "true", action: "rewrite" };
    const merged = mergeRulesByDescription([unrelated], rules, RULE_PREFIX_SECURITY);
    expect(merged.filter(isSecurityOwnedRule)).toHaveLength(1);
    expect(merged).toContain(unrelated);
  });

  it("apply twice is idempotent", () => {
    let existing = [];
    existing = mergeRulesByDescription(existing, rules, RULE_PREFIX_SECURITY);
    existing = mergeRulesByDescription(existing, rules, RULE_PREFIX_SECURITY);
    expect(ownedRules(existing, RULE_PREFIX_SECURITY)).toHaveLength(1);
  });

  it("planRulesetMerge reports create on empty zone", () => {
    const plan = planRulesetMerge([], rules, RULE_PREFIX_SECURITY);
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toRemove).toHaveLength(0);
  });
});
