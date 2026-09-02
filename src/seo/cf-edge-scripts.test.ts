import { describe, expect, it } from "vitest";
import { mergeRulesByDescription, ownedRules, planRulesetMerge } from "../../scripts/cf-api.mjs";
import {
  RULE_PREFIX_404,
  RULE_PREFIX_QUERY,
  buildQueryCanonicalizeRules,
  buildUnknown404Rule,
  is404OwnedRule,
  isQueryOwnedRule,
} from "../../scripts/cf-p-edge-rules.mjs";

function unrelatedRule(description: string) {
  return { description, expression: "true", action: "log" };
}

describe("Phase 2A.1 — Cloudflare edge script rule ownership", () => {
  const queryRules = buildQueryCanonicalizeRules();
  const unknown404Rule = buildUnknown404Rule();

  it("uses isolated description prefixes", () => {
    expect(RULE_PREFIX_QUERY).toBe("11tik-p2-query:");
    expect(RULE_PREFIX_404).toBe("11tik-p2-404:");
    expect(RULE_PREFIX_QUERY).not.toBe(RULE_PREFIX_404);
    expect(queryRules.every((r) => r.description.startsWith(RULE_PREFIX_QUERY))).toBe(true);
    expect(unknown404Rule.description.startsWith(RULE_PREFIX_404)).toBe(true);
    expect(queryRules.some((r) => is404OwnedRule(r))).toBe(false);
    expect(isQueryOwnedRule(unknown404Rule)).toBe(false);
  });

  it("query rules target www + six clean utility paths with query required", () => {
    expect(queryRules).toHaveLength(6);
    for (const rule of queryRules) {
      expect(rule.expression).toContain('http.host eq "www.11tik.com"');
      expect(rule.expression).not.toContain('"/p/');
      expect(rule.expression).toContain("len(http.request.uri.query) > 0");
      expect(rule.action).toBe("redirect");
      expect(rule.action_parameters.from_value.status_code).toBe(301);
      expect(rule.action_parameters.from_value.preserve_query_string).toBe(false);
    }
  });

  it("unknown 404 rule targets www /p/* with allowlist and fixed 404", () => {
    expect(unknown404Rule.expression).toContain('http.host eq "www.11tik.com"');
    expect(unknown404Rule.expression).toContain('starts_with(http.request.uri.path, "/p/")');
    expect(unknown404Rule.expression).toContain("not http.request.uri.path in {");
    expect(unknown404Rule.action).toBe("block");
    expect(unknown404Rule.action_parameters.response.status_code).toBe(404);
  });

  it("404-script apply does not delete query rules (cross-phase simulation)", () => {
    const unrelated = unrelatedRule("customer: block bots");
    const existingRedirectPhase = [...queryRules, unrelated];
    const merged404Phase = mergeRulesByDescription(existingRedirectPhase, [unknown404Rule], RULE_PREFIX_404);

    expect(merged404Phase.filter(isQueryOwnedRule)).toHaveLength(6);
    expect(merged404Phase.filter(is404OwnedRule)).toHaveLength(1);
    expect(merged404Phase).toContain(unrelated);
  });

  it("query-script apply does not delete 404 rules (cross-phase simulation)", () => {
    const unrelated = unrelatedRule("customer: block bots");
    const existingFirewallPhase = [unknown404Rule, unrelated];
    const mergedQueryPhase = mergeRulesByDescription(existingFirewallPhase, queryRules, RULE_PREFIX_QUERY);

    expect(mergedQueryPhase.filter(is404OwnedRule)).toHaveLength(1);
    expect(mergedQueryPhase.filter(isQueryOwnedRule)).toHaveLength(6);
    expect(mergedQueryPhase).toContain(unrelated);
  });

  it("query-script apply twice is idempotent (no duplicate owned rules)", () => {
    const unrelated = unrelatedRule("customer: legacy redirect");
    let rules = [unrelated];
    rules = mergeRulesByDescription(rules, queryRules, RULE_PREFIX_QUERY);
    rules = mergeRulesByDescription(rules, queryRules, RULE_PREFIX_QUERY);

    expect(ownedRules(rules, RULE_PREFIX_QUERY)).toHaveLength(6);
    expect(rules.filter((r) => r.description.startsWith(RULE_PREFIX_QUERY)).length).toBe(6);
    expect(rules).toContain(unrelated);
  });

  it("404-script apply twice is idempotent (no duplicate owned rules)", () => {
    const unrelated = unrelatedRule("customer: allow office");
    let rules = [unrelated];
    rules = mergeRulesByDescription(rules, [unknown404Rule], RULE_PREFIX_404);
    rules = mergeRulesByDescription(rules, [unknown404Rule], RULE_PREFIX_404);

    expect(ownedRules(rules, RULE_PREFIX_404)).toHaveLength(1);
    expect(rules).toContain(unrelated);
  });

  it("query --remove deletes only query-owned rules", () => {
    const unrelated = unrelatedRule("customer: keep me");
    const existing = [...queryRules, unknown404Rule, unrelated];
    const merged = mergeRulesByDescription(existing, [], RULE_PREFIX_QUERY);

    expect(merged.filter(isQueryOwnedRule)).toHaveLength(0);
    expect(merged.filter(is404OwnedRule)).toHaveLength(1);
    expect(merged).toContain(unrelated);
  });

  it("404 --remove deletes only 404-owned rules", () => {
    const unrelated = unrelatedRule("customer: keep me");
    const existing = [...queryRules, unknown404Rule, unrelated];
    const merged = mergeRulesByDescription(existing, [], RULE_PREFIX_404);

    expect(merged.filter(is404OwnedRule)).toHaveLength(0);
    expect(merged.filter(isQueryOwnedRule)).toHaveLength(6);
    expect(merged).toContain(unrelated);
  });

  it("remove both families preserves unrelated rules", () => {
    const unrelated = unrelatedRule("customer: keep me");
    let rules = [...queryRules, unknown404Rule, unrelated];
    rules = mergeRulesByDescription(rules, [], RULE_PREFIX_QUERY);
    rules = mergeRulesByDescription(rules, [], RULE_PREFIX_404);

    expect(rules).toEqual([unrelated]);
  });

  it("planRulesetMerge reports create/update/remove for greenfield and update", () => {
    const greenfield = planRulesetMerge([], queryRules, RULE_PREFIX_QUERY);
    expect(greenfield.toCreate).toHaveLength(6);
    expect(greenfield.toUpdate).toHaveLength(0);
    expect(greenfield.toRemove).toHaveLength(0);

    const update = planRulesetMerge(queryRules, queryRules, RULE_PREFIX_QUERY);
    expect(update.toCreate).toHaveLength(0);
    expect(update.toUpdate).toHaveLength(6);
    expect(update.toRemove).toHaveLength(0);

    const removePlan = planRulesetMerge(queryRules, [], RULE_PREFIX_QUERY);
    expect(removePlan.toCreate).toHaveLength(0);
    expect(removePlan.toUpdate).toHaveLength(0);
    expect(removePlan.toRemove).toHaveLength(6);
  });

  it("new prefixes do not match each other or legacy broad 11tik-p2:", () => {
    const queryDesc = queryRules[0]!.description;
    const unknownDesc = unknown404Rule.description;

    expect(queryDesc.startsWith("11tik-p2:")).toBe(false);
    expect(unknownDesc.startsWith("11tik-p2:")).toBe(false);
    expect(queryDesc.startsWith(RULE_PREFIX_404)).toBe(false);
    expect(unknownDesc.startsWith(RULE_PREFIX_QUERY)).toBe(false);

    const legacyQueryDesc = "11tik-p2: query strip about";
    expect(legacyQueryDesc.startsWith("11tik-p2:")).toBe(true);

    const existing = [...queryRules, unknown404Rule];
    const safe404Apply = mergeRulesByDescription(existing, [unknown404Rule], RULE_PREFIX_404);
    expect(safe404Apply.filter(isQueryOwnedRule)).toHaveLength(6);
    expect(safe404Apply.filter(is404OwnedRule)).toHaveLength(1);

    const safeQueryApply = mergeRulesByDescription(existing, queryRules, RULE_PREFIX_QUERY);
    expect(safeQueryApply.filter(is404OwnedRule)).toHaveLength(1);
    expect(safeQueryApply.filter(isQueryOwnedRule)).toHaveLength(6);
  });
});

describe("Phase 2A.2 — WAF entrypoint PUT payload", () => {
  const unknown404Rule = buildUnknown404Rule();
  const unrelated = { description: "customer: keep", expression: "true", action: "log" };

  it("buildPhaseEntrypointPutBody omits invalid kind and phase fields", async () => {
    const { buildPhaseEntrypointPutBody, assertValidPhaseEntrypointPutBody, INVALID_PHASE_ENTRYPOINT_PUT_FIELDS } =
      await import("../../scripts/cf-api.mjs");
    const { UNKNOWN_404_PHASE } = await import("../../scripts/cf-p-edge-rules.mjs");

    expect(INVALID_PHASE_ENTRYPOINT_PUT_FIELDS).toEqual(["kind", "phase"]);

    const merged = mergeRulesByDescription([unrelated], [unknown404Rule], RULE_PREFIX_404);
    const body = buildPhaseEntrypointPutBody({
      rules: merged,
      entry: { name: "default", description: "zone custom", kind: "root", phase: UNKNOWN_404_PHASE },
      defaultName: "Custom rules ruleset",
    });

    expect(body).toEqual({
      name: "default",
      description: "zone custom",
      rules: merged,
    });
    expect(body).not.toHaveProperty("kind");
    expect(body).not.toHaveProperty("phase");
    expect(() => assertValidPhaseEntrypointPutBody(body)).not.toThrow();
    expect(() => assertValidPhaseEntrypointPutBody({ ...body, kind: "zone" })).toThrow(/invalid entrypoint PUT field: kind/);
  });

  it("404 apply payload has exactly one owned rule and preserves unrelated rules", async () => {
    const { buildPhaseEntrypointPutBody } = await import("../../scripts/cf-api.mjs");
    const { UNKNOWN_404_PHASE } = await import("../../scripts/cf-p-edge-rules.mjs");

    const merged = mergeRulesByDescription([unrelated], [unknown404Rule], RULE_PREFIX_404);
    const body = buildPhaseEntrypointPutBody({ rules: merged, entry: null, defaultName: "Custom rules ruleset" });

    expect(body.rules.filter(is404OwnedRule)).toHaveLength(1);
    expect(body.rules.filter((r) => r.description === unrelated.description)).toHaveLength(1);
    expect(unknown404Rule.expression).toContain('http.host eq "www.11tik.com"');
    expect(unknown404Rule.action).toBe("block");
    expect(unknown404Rule.action_parameters.response.status_code).toBe(404);
    expect(UNKNOWN_404_PHASE).toBe("http_request_firewall_custom");
  });
});

describe("Phase 2A.3 — Single Redirect entrypoint PUT payload", () => {
  const queryRules = buildQueryCanonicalizeRules();
  const unknown404Rule = buildUnknown404Rule();
  const unrelated = { description: "customer: keep", expression: "true", action: "log" };

  it("Dynamic Redirect PUT body has no kind or phase", async () => {
    const { buildPhaseEntrypointPutBody, assertValidPhaseEntrypointPutBody } = await import("../../scripts/cf-api.mjs");
    const { QUERY_PHASE } = await import("../../scripts/cf-p-edge-rules.mjs");

    const merged = mergeRulesByDescription([unrelated], queryRules, RULE_PREFIX_QUERY);
    const body = buildPhaseEntrypointPutBody({
      rules: merged,
      entry: { name: "Redirect rules ruleset", kind: "root", phase: QUERY_PHASE },
      defaultName: "Redirect rules ruleset",
    });

    expect(body).not.toHaveProperty("kind");
    expect(body).not.toHaveProperty("phase");
    expect(() => assertValidPhaseEntrypointPutBody(body)).not.toThrow();
  });

  it("creates exactly 6 query rules and preserves unrelated + 404 rules", async () => {
    const { buildPhaseEntrypointPutBody } = await import("../../scripts/cf-api.mjs");

    const merged = mergeRulesByDescription([unrelated, unknown404Rule], queryRules, RULE_PREFIX_QUERY);
    const body = buildPhaseEntrypointPutBody({ rules: merged, entry: null, defaultName: "Redirect rules ruleset" });

    expect(body.rules.filter(isQueryOwnedRule)).toHaveLength(6);
    expect(body.rules.filter(is404OwnedRule)).toHaveLength(1);
    expect(body.rules.filter((r) => r.description === unrelated.description)).toHaveLength(1);
  });

  it("query rule definitions unchanged", () => {
    const slugs = ["about", "contact", "embed", "privacy", "terms-of-use", "keyword-tools"];
    expect(queryRules.map((r) => r.description.replace(RULE_PREFIX_QUERY, "")).sort()).toEqual(slugs.sort());
    for (const rule of queryRules) {
      expect(rule.expression).toContain('http.host eq "www.11tik.com"');
      expect(rule.expression).toContain('len(http.request.uri.query) > 0');
      expect(rule.action).toBe("redirect");
      expect(rule.action_parameters.from_value.status_code).toBe(301);
      expect(rule.action_parameters.from_value.preserve_query_string).toBe(false);
    }
  });

  it("query --remove and double-apply remain idempotent", () => {
    let rules = [unrelated, unknown404Rule, ...queryRules];
    rules = mergeRulesByDescription(rules, [], RULE_PREFIX_QUERY);
    expect(rules.filter(isQueryOwnedRule)).toHaveLength(0);
    expect(rules.filter(is404OwnedRule)).toHaveLength(1);
    expect(rules).toContain(unrelated);

    let redirectPhase = [unrelated];
    redirectPhase = mergeRulesByDescription(redirectPhase, queryRules, RULE_PREFIX_QUERY);
    redirectPhase = mergeRulesByDescription(redirectPhase, queryRules, RULE_PREFIX_QUERY);
    expect(redirectPhase.filter(isQueryOwnedRule)).toHaveLength(6);

    const plan1 = planRulesetMerge([], queryRules, RULE_PREFIX_QUERY);
    const plan2 = planRulesetMerge([], queryRules, RULE_PREFIX_QUERY);
    expect(plan1.toCreate).toEqual(plan2.toCreate);
    expect(plan1.toCreate).toHaveLength(6);
  });
});

describe("Phase 2A.4 — WAF fixed-response content_type", () => {
  const queryRules = buildQueryCanonicalizeRules();
  const unknown404Rule = buildUnknown404Rule();

  it("404 response content_type is exactly text/html", () => {
    const ct = unknown404Rule.action_parameters.response.content_type;
    expect(ct).toBe("text/html");
    expect(ct).not.toContain("charset");
  });

  it("404 rule keeps status 404, expression, allowlist, and prefix", async () => {
    const { collectPAllowlistPaths } = await import("../../workers/sitemap-canonicals.js");

    expect(unknown404Rule.action_parameters.response.status_code).toBe(404);
    expect(unknown404Rule.description).toBe(`${RULE_PREFIX_404}unknown /p/* hard 404`);
    expect(unknown404Rule.expression).toContain('http.host eq "www.11tik.com"');
    expect(unknown404Rule.expression).toContain('starts_with(http.request.uri.path, "/p/")');
    expect(collectPAllowlistPaths()).toHaveLength(23);
    expect(unknown404Rule.expression).toContain(`"${collectPAllowlistPaths()[0]}"`);
  });

  it("query rules unchanged and prefixes isolated from 404", () => {
    expect(queryRules).toHaveLength(6);
    expect(queryRules.every((r) => r.description.startsWith(RULE_PREFIX_QUERY))).toBe(true);
    expect(unknown404Rule.description.startsWith(RULE_PREFIX_404)).toBe(true);
    expect(RULE_PREFIX_QUERY).not.toBe(RULE_PREFIX_404);
    expect(queryRules[0]!.action_parameters.from_value.preserve_query_string).toBe(false);
  });
});
