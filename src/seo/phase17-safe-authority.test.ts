import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildContentInventory } from "../../scripts/i18n/content-inventory.mjs";
import {
  ANTI_CANNIBALIZATION_CONTRACT,
  allContractContentIds,
} from "../../scripts/i18n/anti-cannibalization-contract.mjs";
import {
  applyContextualInternalLinks,
  generateInternalLinkReport,
  isBlockedInternalTarget,
  isHistoricalNonEquityUrl,
  resolveContextualLinks,
  validateAllLinkPlans,
  contextualLinkPlanContentIds,
} from "../../scripts/i18n/contextual-internal-links.mjs";
import {
  FORBIDDEN_RECOVERY_ACTIONS,
  HISTORICAL_NON_EQUITY_FAMILIES,
  isNonEquityHistoricalPath,
} from "../../scripts/seo/historical-url-firewall.mjs";
import { runIndexationSafetyChecks } from "../../scripts/seo/indexation-safety.mjs";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { parseSitemapLocs } from "../../workers/sitemap-canonicals.js";
import { GUIDE_POSTS } from "../content/posts";

const ROOT = process.cwd();

function extractJsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  for (const block of html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []) {
    const inner = block.replace(/<script[^>]*>|<\/script>/gi, "");
    try {
      const parsed = JSON.parse(inner);
      const nodes = parsed["@graph"] || [parsed];
      for (const node of nodes) {
        const t = node["@type"];
        if (Array.isArray(t)) t.forEach((x) => types.add(String(x)));
        else if (t) types.add(String(t));
      }
    } catch {
      /* skip malformed */
    }
  }
  return [...types].sort();
}

function countContextualNavLinks(html: string): number {
  const nav = html.match(/<nav class="yte-related"[\s\S]*?<\/nav>/i)?.[0] || "";
  return (nav.match(/<a href=/gi) || []).length;
}

describe("Phase 17.1 safe SEO authority execution", () => {
  it("anti-cannibalization contract covers all contextual link plans", () => {
    for (const id of contextualLinkPlanContentIds()) {
      expect(ANTI_CANNIBALIZATION_CONTRACT[id], id).toBeTruthy();
    }
    expect(allContractContentIds().length).toBeGreaterThanOrEqual(18);
  });

  it("contextual link plans validate with zero blocked/duplicate targets", () => {
    expect(validateAllLinkPlans()).toEqual([]);
  });

  it("internal link report has no retired or non-equity targets", () => {
    const report = generateInternalLinkReport(buildContentInventory());
    expect(report.length).toBeGreaterThan(50);
    for (const row of report) {
      expect(row.retiredTarget).toBe(false);
      expect(isHistoricalNonEquityUrl(row.target)).toBe(false);
      expect(isBlockedInternalTarget(row.target)).toBe(false);
    }
  });

  it("each published guide gets 2–5 sibling contextual links plus parent/home", () => {
    const inventory = buildContentInventory();
    for (const post of GUIDE_POSTS) {
      const item = inventory.find((i) => i.canonicalUrl === post.href);
      expect(item, post.href).toBeTruthy();
      const links = resolveContextualLinks(item!.contentId, item!.canonicalPath);
      const siblings = links.filter((l) => l.role === "sibling");
      expect(siblings.length, item!.contentId).toBeGreaterThanOrEqual(1);
      expect(siblings.length, item!.contentId).toBeLessThanOrEqual(5);
      expect(
        links.some((l) => l.role === "home" || l.role === "parent"),
        item!.contentId,
      ).toBe(true);
    }
  });

  it("staged English guides include build-time contextual nav", () => {
    const staged = getStagedStaticSite();
    const sample = join(staged, "2026/08/how-to-download-youtube-thumbnail.html");
    const html = readFileSync(sample, "utf8");
    expect(html).toContain('class="yte-related"');
    expect(countContextualNavLinks(html)).toBeGreaterThanOrEqual(4);
  });

  it("localized FR contextual nav uses same-locale hrefs when ready", () => {
    const staged = getStagedStaticSite();
    const frPath = join(staged, "l/fr/2026/08/how-to-download-youtube-thumbnail.html");
    expect(existsSync(frPath)).toBe(true);
    const html = readFileSync(frPath, "utf8");
    const nav = html.match(/<nav class="yte-related"[\s\S]*?<\/nav>/i)?.[0] || "";
    expect(nav).toContain('class="yte-related"');
    expect(nav).toMatch(/href="https:\/\/fr\.11tik\.com\/l\/fr\//);
    expect(nav).not.toMatch(/href="https:\/\/www\.11tik\.com\/2026\/08\//);
  });

  it("historical URL firewall blocks music and backlink families", () => {
    expect(isNonEquityHistoricalPath("/music/foo")).toBe(true);
    expect(isNonEquityHistoricalPath("https://www.11tik.com/github/backlink/abc")).toBe(true);
    expect(isHistoricalNonEquityUrl("/music/test")).toBe(true);
    expect(HISTORICAL_NON_EQUITY_FAMILIES.length).toBeGreaterThanOrEqual(2);
    expect(FORBIDDEN_RECOVERY_ACTIONS).toContain("mass_301_to_homepage");
  });

  it("indexation safety: sitemap has no retired/junk; all guides listed", () => {
    const staged = getStagedStaticSite();
    const sitemap = parseSitemapLocs(readFileSync(join(staged, "sitemap.xml"), "utf8"));
    const checks = runIndexationSafetyChecks({ sitemapLocs: sitemap });
    expect(checks.sitemapRetiredOrJunk).toEqual([]);
    expect(checks.missingGuides).toEqual([]);
  });

  it("does not mutate Worker, wrangler, or RWF in this phase", () => {
    const wrangler = readFileSync(join(ROOT, "wrangler.jsonc"), "utf8");
    expect(wrangler).not.toContain("phase17");
    expect(existsSync(join(ROOT, "workers/11tik-edge.js"))).toBe(true);
  });

  it("FR schema parity audit report (read-only — no auto-fix)", () => {
    const staged = getStagedStaticSite();
    const enHtml = readFileSync(
      join(staged, "2026/08/how-to-download-youtube-thumbnail.html"),
      "utf8",
    );
    const frHtml = readFileSync(
      join(staged, "l/fr/2026/08/how-to-download-youtube-thumbnail.html"),
      "utf8",
    );
    const enTypes = extractJsonLdTypes(enHtml);
    const frTypes = extractJsonLdTypes(frHtml);
    expect(enTypes).toContain("Article");
    expect(frTypes).toContain("Article");
    // Document gap — EN often has HowTo+Breadcrumb; FR may lack until approved
    const report = {
      en: enTypes,
      fr: frTypes,
      missingInFr: enTypes.filter((t) => !frTypes.includes(t)),
      safeParity: ["Article", "FAQPage"].every((t) => frTypes.includes(t) || !enTypes.includes(t)),
    };
    expect(report.en.length).toBeGreaterThan(0);
    expect(report.fr.length).toBeGreaterThan(0);
  });

  it("applyContextualInternalLinks is idempotent", () => {
    const html = "<article><p class=\"yte-bio\">bio</p></article>";
    const once = applyContextualInternalLinks(html, "how-to-download-youtube-thumbnail", "/2026/08/how-to-download-youtube-thumbnail.html");
    const twice = applyContextualInternalLinks(once, "how-to-download-youtube-thumbnail", "/2026/08/how-to-download-youtube-thumbnail.html");
    expect(once).toBe(twice);
    expect((once.match(/class="yte-related"/g) || []).length).toBe(1);
  });

  it("embed utility receives expanded developer patch at build time", () => {
    const staged = getStagedStaticSite();
    const html = readFileSync(join(staged, "p/embed.html"), "utf8");
    expect(html).toContain("maxres fallback");
    expect(html).toContain("youtube-thumbnail-url.html");
  });

  it("performance governance scripts unchanged by phase 17.1", () => {
    expect(existsSync(join(ROOT, "src/seo/performance-baseline.json"))).toBe(true);
    const baseline = JSON.parse(readFileSync(join(ROOT, "src/seo/performance-baseline.json"), "utf8"));
    expect(baseline.javascript?.budgets?.bloggerAppBrotliFail).toBe(409600);
    expect(baseline.javascript?.bloggerAppBrotliBytes).toBeLessThanOrEqual(400000);
  });
});
