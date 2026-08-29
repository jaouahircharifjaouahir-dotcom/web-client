import { describe, expect, it } from "vitest";
import {
  buildPhaseEntrypointPutBody,
  mergeRulesByDescription,
  ownedRules,
  planRulesetMerge,
} from "../../scripts/cf-api.mjs";
import {
  LEGAL_SHORTCUT_REDIRECTS,
  RULE_PREFIX_LEGAL,
  buildLegalShortcutRules,
  buildQueryCanonicalizeRules,
  isLegalOwnedRule,
  isQueryOwnedRule,
} from "../../scripts/cf-p-edge-rules.mjs";
import worker from "../../workers/11tik-edge.js";
import { matchesRunWorkerFirst, readWranglerConfig } from "./test-helpers/run-worker-first.ts";

const SITE = "https://www.11tik.com";

function unrelatedRule(description: string) {
  return { description, expression: "true", action: "log" };
}

/** Production path after Phase 3B deploy: CF edge redirect → direct static Asset (Worker-zero). */
function simulateLegalShortcutProduction(pathname: string, search = "") {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const shortcut = LEGAL_SHORTCUT_REDIRECTS.find((r) => r.from === clean);
  const workerFirst = matchesRunWorkerFirst(clean);
  if (!shortcut) {
    return { workerFirst, edgeRedirect: false, status: 0, destination: "", stripsQuery: false, destinationWorkerZero: false };
  }
  const rule = buildLegalShortcutRules().find((r) => r.description === `${RULE_PREFIX_LEGAL}${shortcut.slug}`);
  const preserveQuery = rule?.action_parameters.from_value.preserve_query_string ?? true;
  return {
    workerFirst,
    edgeRedirect: true,
    status: 301,
    destination: shortcut.to,
    stripsQuery: !preserveQuery && search.length > 0,
    destinationWorkerZero: !matchesRunWorkerFirst(shortcut.to),
  };
}

describe("Phase 3 — legal shortcut Single Redirect rules", () => {
  const legalRules = buildLegalShortcutRules();
  const queryRules = buildQueryCanonicalizeRules();

  it("defines exactly 4 rules with isolated prefix 11tik-p3-legal:", () => {
    expect(RULE_PREFIX_LEGAL).toBe("11tik-p3-legal:");
    expect(legalRules).toHaveLength(4);
    expect(legalRules.map((r) => r.description)).toEqual([
      "11tik-p3-legal:about",
      "11tik-p3-legal:privacy",
      "11tik-p3-legal:terms",
      "11tik-p3-legal:contact",
    ]);
    expect(legalRules.every((r) => r.description.startsWith(RULE_PREFIX_LEGAL))).toBe(true);
    expect(legalRules.some((r) => isQueryOwnedRule(r))).toBe(false);
  });

  it("maps exact paths to utility .html destinations with 301 and no query preservation", () => {
    for (const { from, to, slug } of LEGAL_SHORTCUT_REDIRECTS) {
      const rule = legalRules.find((r) => r.description === `${RULE_PREFIX_LEGAL}${slug}`);
      expect(rule, from).toBeDefined();
      expect(rule!.expression).toBe(
        `(http.host eq "www.11tik.com" and http.request.uri.path eq "${from}")`,
      );
      expect(rule!.action).toBe("redirect");
      expect(rule!.action_parameters.from_value.status_code).toBe(301);
      expect(rule!.action_parameters.from_value.preserve_query_string).toBe(false);
      expect(rule!.action_parameters.from_value.target_url.value).toBe(`${SITE}${to}`);
    }
  });

  it("terms shortcut targets /p/terms-of-use.html (not /p/terms.html)", () => {
    const terms = legalRules.find((r) => r.description === "11tik-p3-legal:terms");
    expect(terms?.action_parameters.from_value.target_url.value).toBe(`${SITE}/p/terms-of-use.html`);
  });

  it("merge is idempotent and --remove deletes only legal-owned rules", () => {
    const indexNow = unrelatedRule("IndexNow key");
    let rules = [...queryRules, indexNow];
    rules = mergeRulesByDescription(rules, legalRules, RULE_PREFIX_LEGAL);
    rules = mergeRulesByDescription(rules, legalRules, RULE_PREFIX_LEGAL);
    expect(ownedRules(rules, RULE_PREFIX_LEGAL)).toHaveLength(4);
    expect(rules.filter(isQueryOwnedRule)).toHaveLength(6);
    expect(rules).toContain(indexNow);

    const removed = mergeRulesByDescription(rules, [], RULE_PREFIX_LEGAL);
    expect(removed.filter(isLegalOwnedRule)).toHaveLength(0);
    expect(removed.filter(isQueryOwnedRule)).toHaveLength(6);
    expect(removed).toContain(indexNow);
  });

  it("legal apply does not touch 11tik-p2-query:* rules (cross-family simulation)", () => {
    const unrelated = unrelatedRule("customer: legacy");
    const existing = [...queryRules, unrelated];
    const merged = mergeRulesByDescription(existing, legalRules, RULE_PREFIX_LEGAL);
    expect(merged.filter(isQueryOwnedRule)).toHaveLength(6);
    expect(merged.filter(isLegalOwnedRule)).toHaveLength(4);
    expect(merged).toContain(unrelated);
  });

  it("PUT body is valid for http_request_dynamic_redirect entrypoint", () => {
    const merged = mergeRulesByDescription(queryRules, legalRules, RULE_PREFIX_LEGAL);
    const body = buildPhaseEntrypointPutBody({ rules: merged, defaultName: "Redirect rules ruleset" });
    expect(body.rules.filter(isLegalOwnedRule)).toHaveLength(4);
    expect(body.rules.filter(isQueryOwnedRule)).toHaveLength(6);
  });

  it("plan against live zone shape: legal rules are additive (plan only)", () => {
    const indexNow = unrelatedRule("IndexNow key");
    const existing = [...queryRules, indexNow];
    const plan = planRulesetMerge(existing, legalRules, RULE_PREFIX_LEGAL);
    expect(plan.toCreate.map((r) => r.description)).toEqual([
      "11tik-p3-legal:about",
      "11tik-p3-legal:privacy",
      "11tik-p3-legal:terms",
      "11tik-p3-legal:contact",
    ]);
    expect(plan.toRemove).toHaveLength(0);
    expect(plan.kept.filter(isQueryOwnedRule)).toHaveLength(6);
    expect(plan.kept).toContain(indexNow);
  });
});

describe("Phase 3B — legal shortcuts removed from RWF (Worker-zero after deploy)", () => {
  const wrangler = readWranglerConfig();
  const legalRules = buildLegalShortcutRules();

  it("RWF no longer lists /about, /privacy, /terms, /contact", () => {
    expect(wrangler.assets.run_worker_first).not.toContain("/about");
    expect(wrangler.assets.run_worker_first).not.toContain("/privacy");
    expect(wrangler.assets.run_worker_first).not.toContain("/terms");
    expect(wrangler.assets.run_worker_first).not.toContain("/contact");
  });

  it("documents post-deploy ordering: CF Single Redirect → .html Asset → Worker ZERO", () => {
    for (const { from, to } of LEGAL_SHORTCUT_REDIRECTS) {
      const route = simulateLegalShortcutProduction(from);
      expect(route.workerFirst, `${from} must not be Worker-first`).toBe(false);
      expect(route.edgeRedirect, `${from} CF legal rule`).toBe(true);
      expect(route.status).toBe(301);
      expect(route.destination).toBe(to);
      expect(route.destinationWorkerZero, `${to} direct Asset`).toBe(true);
    }
  });

  for (const { from, to } of LEGAL_SHORTCUT_REDIRECTS) {
    it(`${from} → not Worker-first; CF 301 → ${to}`, () => {
      expect(matchesRunWorkerFirst(from)).toBe(false);
      const route = simulateLegalShortcutProduction(from);
      expect(route.edgeRedirect).toBe(true);
      expect(route.destination).toBe(to);
      expect(matchesRunWorkerFirst(to)).toBe(false);
    });

    it(`${from}?x=1 → CF strips query → ${to}`, () => {
      const route = simulateLegalShortcutProduction(from, "x=1");
      expect(route.workerFirst).toBe(false);
      expect(route.stripsQuery).toBe(true);
      expect(route.destination).toBe(to);
      const rule = legalRules.find((r) => r.expression.includes(`path eq "${from}"`));
      expect(rule?.action_parameters.from_value.preserve_query_string).toBe(false);
    });
  }

  it("legalPageRedirect() remains in Worker as rollback fallback (direct Worker fetch)", async () => {
    const res = await worker.fetch(new Request(`${SITE}/about`), {});
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`${SITE}/p/about.html`);
  });
});

describe("Phase 3B — legal shortcuts regression guards", () => {
  const wrangler = readWranglerConfig();

  it("six /p/*.html utilities remain Worker-zero", () => {
    for (const path of [
      "/p/about.html",
      "/p/privacy.html",
      "/p/terms-of-use.html",
      "/p/contact.html",
      "/p/embed.html",
      "/p/keyword-tools.html",
    ]) {
      expect(matchesRunWorkerFirst(path)).toBe(false);
    }
  });

  it("/p/* unknown paths remain Worker-first (404 handler)", () => {
    expect(matchesRunWorkerFirst("/p/random.html")).toBe(true);
    expect(matchesRunWorkerFirst("/p/youtube-thumbnail-url.html")).toBe(true);
  });

  it("/p/about.html remains Worker-excluded direct Asset", () => {
    expect(matchesRunWorkerFirst("/p/about.html")).toBe(false);
    expect(wrangler.assets.run_worker_first).toContain("!/p/about.html");
  });

  it("/l/fr/ localized home and /l/fr/p/about.html remain /l/* Worker-first", () => {
    expect(matchesRunWorkerFirst("/l/fr/")).toBe(true);
    expect(matchesRunWorkerFirst("/l/fr/p/about.html")).toBe(true);
  });

  it("/thumb/* SPA and / homepage unchanged", () => {
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(false);
    expect(matchesRunWorkerFirst("/")).toBe(true);
    expect(wrangler.assets.run_worker_first).not.toContain("/thumb/*");
  });

  it("/copyright* remains Worker-first", () => {
    expect(wrangler.assets.run_worker_first).toContain("/copyright*");
    expect(matchesRunWorkerFirst("/copyright")).toBe(true);
  });

  it("Blogger /feeds/* and /search remain Worker-first", () => {
    expect(wrangler.assets.run_worker_first).toContain("/feeds/*");
    expect(wrangler.assets.run_worker_first).toContain("/search");
    expect(matchesRunWorkerFirst("/feeds/posts/default")).toBe(true);
    expect(matchesRunWorkerFirst("/search")).toBe(true);
  });

  it("SEO infra direct Assets; sitemap-pages.xml remains Worker-first", () => {
    expect(wrangler.assets.run_worker_first).not.toContain("/robots.txt");
    expect(wrangler.assets.run_worker_first).not.toContain("/llms.txt");
    expect(wrangler.assets.run_worker_first).not.toContain("/sitemap.xml");
    expect(wrangler.assets.run_worker_first).not.toContain("/r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt");
    expect(matchesRunWorkerFirst("/robots.txt")).toBe(false);
    expect(matchesRunWorkerFirst("/llms.txt")).toBe(false);
    expect(matchesRunWorkerFirst("/sitemap.xml")).toBe(false);
    expect(wrangler.assets.run_worker_first).toContain("/sitemap-pages.xml");
    expect(matchesRunWorkerFirst("/sitemap-pages.xml")).toBe(true);
  });

  it("apex 11tik.com routes unchanged (Worker HSTS/www redirect)", () => {
    expect(wrangler.routes.some((r: { pattern: string }) => r.pattern === "11tik.com")).toBe(true);
    expect(wrangler.routes.some((r: { pattern: string }) => r.pattern === "11tik.com/*")).toBe(true);
  });

  it("Phase 2 query rules unchanged (6 rules, distinct prefix)", () => {
    const queryRules = buildQueryCanonicalizeRules();
    expect(queryRules).toHaveLength(6);
    expect(queryRules.every((r) => r.description.startsWith("11tik-p2-query:"))).toBe(true);
    expect(queryRules.some((r) => isLegalOwnedRule(r))).toBe(false);
  });

  it("Cloudflare legal rules depend on live 11tik-p3-legal:* (not RWF)", () => {
    expect(buildLegalShortcutRules()).toHaveLength(4);
    expect(wrangler.assets.run_worker_first).not.toContain("/about");
  });
});
