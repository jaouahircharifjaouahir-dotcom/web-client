import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { matchesRunWorkerFirst, readWranglerConfig } from "./test-helpers/run-worker-first.ts";

const SITE = "https://www.11tik.com";

function unrelatedRule(description: string) {
  return { description, expression: "true", action: "log" };
}

/** Phase 53: no CF edge redirect; Worker serves canonical clean path directly. */
function simulateLegalShortcutProduction(pathname: string) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const shortcut = LEGAL_SHORTCUT_REDIRECTS.find((r) => r.from === clean);
  if (!shortcut) {
    return { workerFirst: matchesRunWorkerFirst(clean), edgeRedirect: false, destination: "" };
  }
  return {
    workerFirst: matchesRunWorkerFirst(clean),
    edgeRedirect: false,
    destination: shortcut.to,
  };
}

function assetsEnv(onFetch: (pathname: string) => Response | Promise<Response>) {
  const seen: string[] = [];
  return {
    seen,
    env: {
      ASSETS: {
        fetch(req: Request) {
          seen.push(new URL(req.url).pathname);
          return onFetch(new URL(req.url).pathname);
        },
      },
    },
  };
}

describe("Phase 53 — legal shortcut CF rules retired", () => {
  const queryRules = buildQueryCanonicalizeRules();

  it("buildLegalShortcutRules returns no CF edge redirects", () => {
    expect(buildLegalShortcutRules()).toEqual([]);
  });

  it("LEGAL_SHORTCUT_REDIRECTS documents clean canonical targets only", () => {
    expect(LEGAL_SHORTCUT_REDIRECTS).toEqual([
      { from: "/about", to: "/about", slug: "about" },
      { from: "/privacy", to: "/privacy", slug: "privacy" },
      { from: "/terms", to: "/terms-of-use", slug: "terms" },
      { from: "/contact", to: "/contact", slug: "contact" },
    ]);
    for (const { to } of LEGAL_SHORTCUT_REDIRECTS) {
      expect(to.startsWith("/p/")).toBe(false);
      expect(to.includes(".html")).toBe(false);
    }
  });

  it("merge --remove deletes only legal-owned rules without touching query rules", () => {
    const legacyLegal = [
      {
        description: "11tik-p3-legal:about",
        expression: '(http.host eq "www.11tik.com" and http.request.uri.path eq "/about")',
        action: "redirect",
        action_parameters: {
          from_value: {
            status_code: 301,
            target_url: { value: `${SITE}/p/about.html` },
          },
        },
      },
    ];
    const indexNow = unrelatedRule("IndexNow key");
    let rules = [...queryRules, indexNow, ...legacyLegal];
    rules = mergeRulesByDescription(rules, [], RULE_PREFIX_LEGAL);
    expect(rules.filter(isLegalOwnedRule)).toHaveLength(0);
    expect(rules.filter(isQueryOwnedRule)).toHaveLength(6);
    expect(rules).toContain(indexNow);
  });

  it("plan against live zone shape: apply removes legacy 11tik-p3-legal:* rules", () => {
    const legacyLegal = [
      {
        description: "11tik-p3-legal:about",
        expression: "true",
        action: "redirect",
      },
    ];
    const plan = planRulesetMerge(legacyLegal, buildLegalShortcutRules(), RULE_PREFIX_LEGAL);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toRemove.map((r) => r.description)).toEqual(["11tik-p3-legal:about"]);
  });

  it("PUT body with empty legal rules is valid for http_request_dynamic_redirect entrypoint", () => {
    const merged = mergeRulesByDescription(queryRules, buildLegalShortcutRules(), RULE_PREFIX_LEGAL);
    const body = buildPhaseEntrypointPutBody({ rules: merged, defaultName: "Redirect rules ruleset" });
    expect(body.rules.filter(isLegalOwnedRule)).toHaveLength(0);
    expect(body.rules.filter(isQueryOwnedRule)).toHaveLength(6);
  });
});

describe("Phase 53 — legal shortcuts served by Worker (no CF hop)", () => {
  for (const { from, to } of LEGAL_SHORTCUT_REDIRECTS) {
    it(`${from} is Worker-first with no CF edge redirect`, () => {
      const route = simulateLegalShortcutProduction(from);
      expect(route.edgeRedirect).toBe(false);
      expect(route.workerFirst).toBe(true);
      expect(route.destination).toBe(to);
    });
  }

  it("/about → 200 clean HTML (no /p/about.html hop)", async () => {
    const dir = getStagedStaticSite();
    const body = readFileSync(join(dir, "about.html"), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/about.html" ? new Response(body, { status: 200 }) : new Response("x", { status: 404 }),
    );
    const res = await worker.fetch(new Request(`${SITE}/about`), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/about.html"]);
    expect(await res.text()).toContain('rel="canonical" href="https://www.11tik.com/about"');
  });

  it("/embed → 200 clean HTML (no /p/embed.html hop)", async () => {
    const dir = getStagedStaticSite();
    const body = readFileSync(join(dir, "embed.html"), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/embed.html" ? new Response(body, { status: 200 }) : new Response("x", { status: 404 }),
    );
    const res = await worker.fetch(new Request(`${SITE}/embed`), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/embed.html"]);
  });

  it("/terms → one-hop atomic 301 to /terms-of-use then 200", async () => {
    const dir = getStagedStaticSite();
    const termsBody = readFileSync(join(dir, "terms-of-use.html"), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/terms-of-use.html"
        ? new Response(termsBody, { status: 200 })
        : new Response("x", { status: 404 }),
    );
    const res = await worker.fetch(new Request(`${SITE}/terms`), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`${SITE}/terms-of-use`);
    expect(seen).toEqual([]);

    seen.length = 0;
    const res2 = await worker.fetch(new Request(`${SITE}/terms-of-use`), env);
    expect(res2.status).toBe(200);
    expect(seen).toEqual(["/terms-of-use.html"]);
  });

  it("legacy /p/about.html → one-hop atomic 301 to /about", async () => {
    const { env, seen } = assetsEnv(() => new Response("x", { status: 404 }));
    const res = await worker.fetch(new Request(`${SITE}/p/about.html`), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`${SITE}/about`);
    expect(seen).toEqual([]);
  });
});

describe("Phase 53 — legal shortcut regression guards", () => {
  const wrangler = readWranglerConfig();

  it("RWF does not list /about, /privacy, /terms, /contact as separate entries", () => {
    for (const path of ["/about", "/privacy", "/terms", "/contact"]) {
      expect(wrangler.assets.run_worker_first).not.toContain(path);
    }
  });

  it("clean utility paths are Worker-first via global /* catch-all", () => {
    for (const path of ["/about", "/privacy", "/contact", "/embed", "/terms-of-use"]) {
      expect(matchesRunWorkerFirst(path)).toBe(true);
    }
  });

  it("legacy /p/about.html is Worker-first (atomic redirect before asset)", () => {
    expect(matchesRunWorkerFirst("/p/about.html")).toBe(true);
  });

  it("/p/* unknown paths remain Worker-first (404 handler)", () => {
    expect(matchesRunWorkerFirst("/p/random.html")).toBe(true);
  });

  it("/l/fr/ locale home Worker-first; clean localized utility Worker-first (Phase 53)", () => {
    expect(matchesRunWorkerFirst("/l/fr/")).toBe(true);
    expect(matchesRunWorkerFirst("/l/fr/about")).toBe(true);
  });

  it("/thumb/* SPA and / homepage Worker-first", () => {
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(true);
    expect(matchesRunWorkerFirst("/")).toBe(true);
  });

  it("Phase 2 query rules target clean utility paths with query required", () => {
    const queryRules = buildQueryCanonicalizeRules();
    expect(queryRules).toHaveLength(6);
    for (const rule of queryRules) {
      expect(rule.expression).toContain('http.host eq "www.11tik.com"');
      expect(rule.expression).not.toContain('"/p/');
      expect(rule.expression).toContain("len(http.request.uri.query) > 0");
    }
    expect(queryRules.some((r) => r.expression.includes('"/about"'))).toBe(true);
  });

  it("Cloudflare legal rules must be absent after Phase 53 deploy prep", () => {
    expect(buildLegalShortcutRules()).toHaveLength(0);
  });
});
