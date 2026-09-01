import { describe, expect, it } from "vitest";
import {
  assertCanonical,
  assertContentType,
  assertContains,
  assertLang,
  assertLocation,
  assertNotContains,
  assertStatus,
  buildSmokeCases,
  evaluateSmokeCase,
  filterSmokeCases,
  parseSitemapLocs,
  scheduledSmokeCaseIds,
  smokeOrigins,
  validateFeedXml,
  validateRobotsTxt,
  validateSitemapXml,
} from "../../scripts/production-smoke-lib.mjs";
import { CSP_REPORT_ONLY } from "../../scripts/security-headers.mjs";

describe("production smoke lib", () => {
  it("buildSmokeCases covers categories A–Y plus extra probes", () => {
    const cases = buildSmokeCases(smokeOrigins());
    const categories = new Set(cases.map((c) => c.category));
    for (const cat of "ABCDEFGHIJKLMNOPQRSTUVWXY".split("")) {
      expect(categories.has(cat), cat).toBe(true);
    }
    expect(cases.some((c) => c.id === "D-en-unknown-2026")).toBe(true);
    expect(cases.some((c) => c.id === "H-pages-feed-410")).toBe(true);
    expect(cases.some((c) => c.id === "H-sitemap-images-410")).toBe(true);
    expect(cases.some((c) => c.id === "H-feeds-comments-410")).toBe(true);
    expect(cases.some((c) => c.id === "H-copyright")).toBe(true);
    expect(cases.some((c) => c.id === "L-indexnow-key")).toBe(true);
    expect(cases.some((c) => c.id === "W-thumb-spa")).toBe(true);
    expect(cases.some((c) => c.id === "SEC-embed-page")).toBe(true);
    expect(cases.some((c) => c.id === "SEC-embed-widget")).toBe(true);
    expect(cases.filter((c) => c.securityHeaders).length).toBeGreaterThanOrEqual(8);
    expect(cases.filter((c) => c.workerHsts).length).toBeGreaterThanOrEqual(8);
  });

  it("scheduled subset is small and asset-first heavy", () => {
    const ids = scheduledSmokeCaseIds();
    expect(ids.length).toBeGreaterThanOrEqual(5);
    expect(ids.length).toBeLessThanOrEqual(10);
    expect(ids).toContain("J-robots");
    expect(ids).toContain("K-sitemap");
    expect(ids).toContain("H-sitemap-images-410");
  });

  it("assertStatus and assertLocation helpers", () => {
    expect(assertStatus(200, 200).ok).toBe(true);
    expect(assertStatus(404, 200).ok).toBe(false);
    expect(assertLocation("https://www.11tik.com/p/about.html", { includes: "/p/about.html" }).ok).toBe(true);
  });

  it("assertContentType and assertContains", () => {
    expect(assertContentType("application/atom+xml; charset=UTF-8", "atom").ok).toBe(true);
    expect(assertContains("<html></html>", "<html>").ok).toBe(true);
    expect(assertNotContains("<html></html>", "blogspot.com").ok).toBe(true);
  });

  it("assertCanonical and assertLang", () => {
    const html = `<html lang="fr"><head><link rel="canonical" href="https://fr.11tik.com/l/fr/p/about.html"/></head></html>`;
    expect(assertCanonical(html, { includes: "/l/fr/p/about.html" }).ok).toBe(true);
    expect(assertLang(html, "fr").ok).toBe(true);
  });

  it("validateRobotsTxt catches accidental blocks", () => {
    const good = `User-agent: *\nAllow: /\nDisallow: /search\nDisallow: /feeds/\nSitemap: https://www.11tik.com/sitemap.xml\nUser-agent: Amazonbot\nAllow: /\nUser-agent: GPTBot\nDisallow: /\n`;
    expect(validateRobotsTxt(good)).toEqual([]);
    const bad = `User-agent: *\nDisallow: /\n`;
    expect(validateRobotsTxt(bad).some((x) => x.includes("homepage"))).toBe(true);
  });

  it("validateSitemapXml enforces loc rules", () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.11tik.com/</loc></url></urlset>`;
    const { issues, locs } = validateSitemapXml(xml, { expectedLocCount: 1, strictCount: false });
    expect(locs).toHaveLength(1);
    expect(issues).toEqual([]);
    const bad = `${xml}<url><loc>https://www.11tik.com/search</loc></url>`;
    expect(validateSitemapXml(bad, { expectedLocCount: 2 }).issues).toContain("sitemap contains /search");
  });

  it("parseSitemapLocs extracts locs", () => {
    expect(parseSitemapLocs("<loc>https://a/</loc><loc>https://b/</loc>")).toEqual(["https://a/", "https://b/"]);
  });

  it("validateFeedXml counts atom entries and rss items", () => {
    const atom = `<feed>${"<entry></entry>".repeat(19)}</feed>`;
    expect(validateFeedXml(atom, { kind: "atom", expectedEntries: 19 })).toEqual([]);
    const rss = `<rss><channel>${"<item></item>".repeat(19)}</channel></rss>`;
    expect(validateFeedXml(rss, { kind: "rss", expectedEntries: 19 })).toEqual([]);
  });

  it("evaluateSmokeCase flags English article SPA regression as BLOCK", () => {
    const testCase = buildSmokeCases(smokeOrigins()).find((c) => c.id === "C-en-article");
    expect(testCase).toBeTruthy();
    const body = `<html><head><link rel="canonical" href="https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html"/></head><body><div id="yte-root"></div></body></html>`;
    const out = evaluateSmokeCase(testCase, { status: 200, headers: {}, body, location: null });
    expect(out.block.some((m) => m.includes("SPA"))).toBe(true);
  });

  it("evaluateSmokeCase treats unknown localized URL as hard 404 (Phase R2)", () => {
    const testCase = buildSmokeCases(smokeOrigins()).find((c) => c.id === "V-fr-unknown-404");
    const body = `<html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>`;
    const headers = { "strict-transport-security": "max-age=31536000; includeSubDomains; preload" };
    const out = evaluateSmokeCase(testCase, { status: 404, headers, body, location: null });
    expect(out.block).toEqual([]);
  });

  it("filterSmokeCases supports scheduled ids", () => {
    const all = buildSmokeCases(smokeOrigins());
    const subset = filterSmokeCases(all, { onlyIds: scheduledSmokeCaseIds() });
    expect(subset.every((c) => scheduledSmokeCaseIds().includes(c.id))).toBe(true);
  });

  it("does not ban blogger-app.js filename alone", () => {
    const testCase = buildSmokeCases(smokeOrigins()).find((c) => c.id === "B-en-utility");
    const body = `<html><script src="/web-client/blogger-app.js"></script></html>`;
    const out = evaluateSmokeCase(testCase, { status: 200, headers: {}, body, location: null });
    expect(out.block.some((m) => m.includes("blogger-app"))).toBe(false);
  });

  it("evaluateSmokeCase flags missing security headers as BLOCK", () => {
    const testCase = buildSmokeCases(smokeOrigins()).find((c) => c.id === "B-en-utility");
    const out = evaluateSmokeCase(testCase, {
      status: 200,
      headers: { "strict-transport-security": "max-age=31536000; includeSubDomains" },
      body: "<html></html>",
      location: null,
    });
    expect(out.block.some((m) => m.startsWith("security:"))).toBe(true);
  });

  it("evaluateSmokeCase passes security headers when present", () => {
    const testCase = buildSmokeCases(smokeOrigins()).find((c) => c.id === "B-en-utility");
    const headers = {
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "content-security-policy-report-only": CSP_REPORT_ONLY,
    };
    const out = evaluateSmokeCase(testCase, { status: 200, headers, body: "<html></html>", location: null });
    expect(out.block.filter((m) => m.startsWith("security:"))).toEqual([]);
  });

  it("evaluateSmokeCase blocks HSTS preload on workerHsts cases", () => {
    const testCase = buildSmokeCases(smokeOrigins()).find((c) => c.id === "H-search-410");
    const out = evaluateSmokeCase(testCase, {
      status: 410,
      headers: {
        "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        "content-security-policy-report-only": CSP_REPORT_ONLY,
      },
      body: "",
      location: null,
    });
    expect(out.block.some((m) => m.includes("preload"))).toBe(true);
  });

  it("evaluateSmokeCase passes workerHsts zone-aligned policy", () => {
    const testCase = buildSmokeCases(smokeOrigins()).find((c) => c.id === "I-sitemap-pages");
    const out = evaluateSmokeCase(testCase, {
      status: 301,
      headers: { "strict-transport-security": "max-age=31536000; includeSubDomains", location: "https://www.11tik.com/sitemap.xml" },
      body: "",
      location: "https://www.11tik.com/sitemap.xml",
    });
    expect(out.block.filter((m) => m.startsWith("security:"))).toEqual([]);
  });
});
