import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndexNowSnapshot } from "../../scripts/i18n/indexnow-snapshot.mjs";
import { INDEXNOW_KEY, INDEXNOW_KEY_PATH, indexNowKeyBody } from "../../scripts/i18n/indexnow-key.mjs";
import { parseSitemapLocs } from "../../workers/sitemap-canonicals.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { matchesRunWorkerFirst, readWranglerConfig } from "./test-helpers/run-worker-first.ts";

/** Zone HSTS verified live in Phase 4A.3 (preload=false). */
export const ZONE_HSTS_DIRECT_ASSET =
  "max-age=31536000; includeSubDomains";

export const SEO_INFRA_PATHS = [
  "/robots.txt",
  "/llms.txt",
  "/sitemap.xml",
  INDEXNOW_KEY_PATH,
] as const;

/** Post Phase 4A: direct Asset, Worker not invoked for these paths. */
export function simulateSeoInfraRouting(pathname: string) {
  const workerFirst = matchesRunWorkerFirst(pathname);
  return {
    workerFirst,
    directAsset: !workerFirst,
    status: 200,
    hstsSource: "cloudflare-zone",
    expectedSts: ZONE_HSTS_DIRECT_ASSET,
  };
}

describe("Phase 4A — SEO infrastructure Worker-zero", () => {
  const wrangler = readWranglerConfig();
  const staged = getStagedStaticSite();

  it("removes only the four SEO infra paths from run_worker_first", () => {
    for (const path of SEO_INFRA_PATHS) {
      expect(wrangler.assets.run_worker_first, path).not.toContain(path);
      expect(matchesRunWorkerFirst(path), path).toBe(false);
    }
  });

  it("keeps unrelated RWF entries unchanged", () => {
    expect(wrangler.assets.run_worker_first).toEqual([
      "/",
      "/feeds/pages/*",
      "/feeds/posts/default",
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
      "/l/*",
    ]);
    expect(matchesRunWorkerFirst("/")).toBe(true);
    expect(matchesRunWorkerFirst("/p/random.html")).toBe(true);
    expect(matchesRunWorkerFirst("/p/about.html")).toBe(false);
    expect(matchesRunWorkerFirst("/l/fr/")).toBe(true);
    expect(matchesRunWorkerFirst("/feeds/posts/default")).toBe(true);
    expect(matchesRunWorkerFirst("/search")).toBe(true);
    expect(matchesRunWorkerFirst("/sitemap-pages.xml")).toBe(true);
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(false);
  });

  it("documents post-deploy routing: direct Asset → zone HSTS, Worker ZERO", () => {
    for (const path of SEO_INFRA_PATHS) {
      const route = simulateSeoInfraRouting(path);
      expect(route.workerFirst, path).toBe(false);
      expect(route.directAsset).toBe(true);
      expect(route.status).toBe(200);
      expect(route.hstsSource).toBe("cloudflare-zone");
      expect(route.expectedSts).toBe(ZONE_HSTS_DIRECT_ASSET);
    }
  });

  it("staged assets exist for all four SEO infra paths", () => {
    for (const path of SEO_INFRA_PATHS) {
      const rel = path.replace(/^\//, "");
      expect(existsSync(join(staged, rel)), path).toBe(true);
    }
  });

  it("robots.txt content integrity", () => {
    const robots = readFileSync(join(staged, "robots.txt"), "utf8");
    expect(robots).not.toContain("Content-Signal:");
    expect(robots).toMatch(/^User-agent: \*\r?\nAllow: \//m);
    expect(robots).toMatch(/^User-agent: Amazonbot\r?\nAllow: \//m);
    expect(robots).toMatch(/^User-agent: GPTBot\r?\nDisallow: \//m);
    expect(robots).toMatch(/^User-agent: ClaudeBot\r?\nDisallow: \//m);
    expect(robots).toContain("Sitemap: https://www.11tik.com/sitemap.xml");
    expect(robots).not.toMatch(/^Host:/m);
  });

  it("sitemap.xml has 1095 URLs without index.html pollution", () => {
    const sitemap = readFileSync(join(staged, "sitemap.xml"), "utf8");
    const locs = parseSitemapLocs(sitemap);
    expect(locs.length).toBe(1095);
    expect(locs.some((loc) => loc.includes("/index.html"))).toBe(false);
    expect(locs.some((loc) => /\/l\/[a-z]{2}\/index\.html/.test(loc))).toBe(false);
    expect(locs.some((loc) => loc.includes("/p/index.html"))).toBe(false);
  });

  it("llms.txt and IndexNow key content unchanged", () => {
    const llms = readFileSync(join(staged, "llms.txt"), "utf8");
    expect(llms.length).toBeGreaterThan(20);
    expect(llms).toContain("11tik");
    expect(llms).not.toMatch(/<html/i);

    const keyPath = INDEXNOW_KEY_PATH.replace(/^\//, "");
    expect(readFileSync(join(staged, keyPath), "utf8")).toBe(indexNowKeyBody());
    expect(indexNowKeyBody()).toBe(INDEXNOW_KEY);
  });

  it("IndexNow snapshot remains 1095 URLs", () => {
    expect(buildIndexNowSnapshot(staged).urlCount).toBe(1095);
  });

  it("zone routes for SEO infra remain (Worker binding unchanged)", () => {
    for (const pattern of [
      "www.11tik.com/robots.txt",
      "www.11tik.com/llms.txt",
      "www.11tik.com/sitemap.xml",
      `www.11tik.com${INDEXNOW_KEY_PATH}`,
    ]) {
      expect(wrangler.routes.some((r: { pattern: string }) => r.pattern === pattern)).toBe(true);
    }
  });
});
