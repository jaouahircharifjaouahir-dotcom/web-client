import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import { buildHtmlExtensionRedirects } from "../../scripts/html-extension-redirects.mjs";
import { buildIndexNowSnapshot } from "../../scripts/i18n/indexnow-snapshot.mjs";
import {
  INDEXABLE_UTILITY_PATHS,
  LEGACY_P_REDIRECTS,
  SITE_ORIGIN,
  collectPAllowlistPaths,
  parseSitemapLocs,
} from "../../workers/sitemap-canonicals.js";
import worker, {
  extensionlessPPathToHtml,
  handlePrimaryPPathRequest,
  legacyPRedirectUrl,
  utilityTrailingSlashCanonicalRedirect,
} from "../../workers/11tik-edge.js";
import { resolveLegacyCleanRedirect } from "../../workers/clean-url-legacy-redirects.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { matchesRunWorkerFirst } from "./test-helpers/run-worker-first.ts";
import { PHASE53_RUN_WORKER_FIRST } from "./test-helpers/cloudflare-run-worker-first.ts";

const UTILITIES = [
  { slug: "about", h1: "About 11tik" },
  { slug: "privacy", h1: "Privacy Policy" },
  { slug: "terms-of-use", h1: "Terms of use" },
  { slug: "contact", h1: "Contact" },
  { slug: "embed", h1: "Embed the 11tik Thumbnail Extractor" },
  { slug: "keyword-tools", h1: "Keyword tools" },
] as const;

const P_DIRECT_ASSET_PATHS = [
  "/p/about.html",
  "/p/privacy.html",
  "/p/terms-of-use.html",
  "/p/contact.html",
  "/p/embed.html",
  "/p/keyword-tools.html",
] as const;

const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));

function countHreflang(html: string): number {
  return [...html.matchAll(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhreflang=/gi)].length;
}

function countAhrefs(html: string): number {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']https:\/\/analytics\.ahrefs\.com\/analytics\.js["'][^>]*>/gi)]
    .length;
}

/** Phase 53 routing: legacy /p/* redirects + clean utility URLs via Worker. */
export function simulatePProductionRouting(pathname: string, search = "") {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const workerFirst = matchesRunWorkerFirst(clean);
  const isCleanUtility = INDEXABLE_UTILITY_PATHS.includes(
    clean as (typeof INDEXABLE_UTILITY_PATHS)[number],
  );

  if (isCleanUtility) {
    return {
      worker: workerFirst,
      assets: !workerFirst,
      edgeRedirect: false,
      status: search ? 301 : 200,
      hard404: false,
    };
  }

  if (workerFirst && clean.startsWith("/p/")) {
    if (resolveLegacyCleanRedirect(clean) || LEGACY_P_REDIRECTS.some((r) => r.from === clean)) {
      return { worker: true, assets: false, edgeRedirect: false, status: 301, hard404: false };
    }
    if (extensionlessPPathToHtml(clean)) {
      return { worker: true, assets: false, edgeRedirect: false, status: 301, hard404: false };
    }
    return { worker: true, assets: false, edgeRedirect: false, status: 404, hard404: true };
  }

  return { worker: workerFirst, assets: !workerFirst, edgeRedirect: false, status: 200, hard404: false };
}

describe("Phase 2B — negative run_worker_first /p/* routing", () => {
  it("uses catch-all /* with asset-first exclusions (Phase 53)", () => {
    expect(wrangler.assets.run_worker_first).toEqual([...PHASE53_RUN_WORKER_FIRST]);
    expect(matchesRunWorkerFirst("/p/about.html")).toBe(true);
    expect(matchesRunWorkerFirst("/about")).toBe(true);
    expect(matchesRunWorkerFirst("/l/fr/about")).toBe(true);
    expect(matchesRunWorkerFirst("/")).toBe(true);
    expect(wrangler.assets.not_found_handling).toBe("404-page");
    expect(wrangler.assets.html_handling).toBe("none");
  });

  it("clean utility paths are indexable", () => {
    for (const { slug } of UTILITIES) {
      expect(INDEXABLE_UTILITY_PATHS).toContain(`/${slug}`);
    }
  });

  it("legacy /p/* paths remain Worker-first for atomic redirects", () => {
    expect(matchesRunWorkerFirst("/p/youtube-thumbnail-url.html")).toBe(true);
    expect(matchesRunWorkerFirst("/p/random.html")).toBe(true);
    expect(matchesRunWorkerFirst("/p/about")).toBe(true);
    expect(matchesRunWorkerFirst("/about")).toBe(true);
  });

  for (const page of UTILITIES) {
    describe(page.slug, () => {
      const canon = `${SITE_ORIGIN}/${page.slug}`;

      it("serves staged static asset at clean root path", () => {
        const dir = getStagedStaticSite();
        const assetPath = join(dir, `${page.slug}.html`);
        expect(existsSync(assetPath)).toBe(true);

        const html = readFileSync(assetPath, "utf8");
        expect(html).toMatch(/rel="canonical"/);
        expect(html).toContain(`<h1>${page.h1}</h1>`);
        expect(html).toMatch(/name="robots" content="index,follow"/);
        expect(html).not.toContain("cdn-cgi/l/email-protection");
        expect(countHreflang(html)).toBe(39);
        expect(countAhrefs(html)).toBe(1);
        expect(html).toMatch(/hreflang="x-default"/);
        expect(html).toMatch(
          new RegExp(`rel="canonical" href="${canon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
        );
        expect(html).toMatch(/<a class="yte-brand"[^>]*>\s*<span class="yte-mark"[^>]*>11<\/span>\s*11tik\s*<\/a>/);
        expect(html).not.toMatch(/canonical" href="[^"]*\/index\.html"/);
        expect(html).not.toContain("no-transform");
        expect([...html.matchAll(/<h1\b/gi)].length).toBe(1);
        expect(html).toMatch(/application\/ld\+json/);
        expect(html).toMatch(/property="og:/);
        expect(html).toMatch(/name="twitter:/);

        const route = simulatePProductionRouting(`/${page.slug}`);
        expect(route.worker).toBe(true);
        expect(route.status).toBe(200);
      });
    });
  }

  it("query on clean utility uses Worker redirect strip", () => {
    for (const page of UTILITIES) {
      const route = simulatePProductionRouting(`/${page.slug}`, "?m=1");
      expect(route.worker).toBe(true);
      expect(route.status).toBe(301);
    }
  });

  it("extensionless legacy /p/* redirects via Worker atomic map", () => {
    for (const page of UTILITIES) {
      expect(extensionlessPPathToHtml(`/p/${page.slug}`)).toBe(`/p/${page.slug}.html`);
      const route = simulatePProductionRouting(`/p/${page.slug}`);
      expect(route.worker).toBe(true);
      expect(route.status).toBe(301);
    }
    expect(extensionlessPPathToHtml("/p/random")).toBe("");
  });

  it("extensionless legacy /p/*+query resolves via Worker", () => {
    const hop1 = simulatePProductionRouting("/p/about", "?m=1");
    expect(hop1.worker).toBe(true);
    expect(hop1.status).toBe(301);
  });

  it("legacy /p/* redirects to verified canonical targets via Worker", () => {
    for (const { from, to } of LEGACY_P_REDIRECTS) {
      expect(legacyPRedirectUrl(from)).toBe(to === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${to}`);
      const route = simulatePProductionRouting(from);
      expect(route.worker).toBe(true);
      expect(route.status).toBe(301);
    }
  });

  it("unknown /p/* reaches Worker and returns hard 404 (not SPA, not Blogger)", async () => {
    for (const path of ["/p/random.html", "/p/random", "/p/random-slug.html"]) {
      const route = simulatePProductionRouting(path);
      expect(route.worker).toBe(true);
      expect(route.hard404).toBe(true);
      expect(route.status).toBe(404);
    }

    const allowlist = collectPAllowlistPaths();
    expect(allowlist).not.toContain("/p/random-slug.html");
    expect(allowlist).toContain("/p/about.html");

    let bloggerCalled = false;
    const env = {
      ASSETS: {
        fetch() {
          return new Response("<html><body>SPA</body></html>", { status: 200 });
        },
      },
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      bloggerCalled = true;
      return Promise.resolve(new Response("blogger", { status: 200 }));
    }) as typeof fetch;

    const res = await worker.fetch(new Request("https://www.11tik.com/p/random.html"), env);
    expect(res.status).toBe(404);
    expect(bloggerCalled).toBe(false);
    const body = await res.text();
    expect(body).toContain("404 Not Found");
    expect(body).not.toMatch(/rel="canonical"/);
    expect(body).not.toMatch(/index,follow/);

    globalThis.fetch = originalFetch;
  });

  it("Worker /p/* fallback: legacy 301 to clean URL", async () => {
    const legacy = await worker.fetch(new Request("https://www.11tik.com/p/youtube-thumbnail-url.html"), {
      ASSETS: { fetch: async () => new Response("x", { status: 404 }) },
    });
    expect(legacy.status).toBe(301);
    expect(legacy.headers.get("location")).toBe(`${SITE_ORIGIN}/youtube-thumbnail-url`);

    const ext = await worker.fetch(new Request("https://www.11tik.com/p/about"), {
      ASSETS: { fetch: async () => new Response("x", { status: 404 }) },
    });
    expect(ext.status).toBe(301);
    expect(ext.headers.get("location")).toBe(`${SITE_ORIGIN}/about`);
  });

  it("localized utilities staged at clean paths (Phase 53)", () => {
    expect(matchesRunWorkerFirst("/l/fr/about")).toBe(true);
    const dir = getStagedStaticSite();
    const locales = ["fr", "de", "ar"] as const;
    for (const locale of locales) {
      for (const page of UTILITIES) {
        const rel = `l/${locale}/${page.slug}.html`;
        expect(existsSync(join(dir, rel)), rel).toBe(true);
      }
    }
  });

  it("legacy /l/fr/p/about.html 301 to localized clean URL", async () => {
    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/p/about.html"), {
      ASSETS: { fetch: async () => new Response("x", { status: 404 }) },
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://fr.11tik.com/l/fr/about");
  });

  it("/thumb/* and homepage query shells stay Worker-first (Phase R2)", () => {
    expect(wrangler.assets.not_found_handling).toBe("404-page");

    expect(matchesRunWorkerFirst("/")).toBe(true);
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(true);
  });

  it("retired feed/search paths remain Worker-first", () => {
    expect(wrangler.assets.run_worker_first).not.toContain("/feeds/*");
    expect(matchesRunWorkerFirst("/feeds/posts/default")).toBe(true);
    expect(matchesRunWorkerFirst("/feeds/comments/default")).toBe(true);
    expect(matchesRunWorkerFirst("/feeds/other/default")).toBe(true);
    expect(matchesRunWorkerFirst("/sitemap-images.xml")).toBe(true);
    expect(matchesRunWorkerFirst("/search")).toBe(true);
    expect(matchesRunWorkerFirst("/search/label/youtube")).toBe(true);
  });

  it("/2026/* articles are Worker-first for hard 404 on miss (Phase 6D)", () => {
    expect(matchesRunWorkerFirst("/2026/08/youtube-thumbnail-url.html")).toBe(true);
  });

  it("sitemap 1096 and IndexNow 1097 (copyright in IndexNow only)", () => {
    const dir = getStagedStaticSite();
    const sitemap = readFileSync(join(dir, "sitemap.xml"), "utf8");
    expect([...sitemap.matchAll(/<loc>/g)].length).toBe(1096);
    expect(sitemap).not.toMatch(/<loc>https:\/\/www\.11tik\.com\/p\/youtube-thumbnail-url\.html<\/loc>/);
    expect(sitemap).not.toContain("/copyright");

    const snap = buildIndexNowSnapshot(dir);
    expect(snap.urlCount).toBe(1097);
    expect(snap.urls["https://www.11tik.com/copyright"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("translation matrix 888/888 unchanged", () => {
    const manifest = scanPublishability();
    expect(manifest.counts.ready).toBe(888);
    expect(manifest.counts.stale).toBe(0);
    expect(manifest.counts.missing).toBe(0);
    expect(manifest.counts.failed).toBe(0);
  });

  it("utility clean URLs appear in sitemap without legacy /p/ duplicates", () => {
    const dir = getStagedStaticSite();
    const locs = parseSitemapLocs(readFileSync(join(dir, "sitemap.xml"), "utf8"));
    for (const path of INDEXABLE_UTILITY_PATHS) {
      expect(locs).toContain(`${SITE_ORIGIN}${path}`);
      expect(locs).not.toContain(`${SITE_ORIGIN}/p${path}.html`);
    }
  });

  it("legacy rules dedupe: buildHtmlExtensionRedirects has no duplicate sources", () => {
    const dir = getStagedStaticSite();
    const body = buildHtmlExtensionRedirects(dir);
    const sources = body
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split(/\s+/)[0]);
    expect(sources.length).toBe(new Set(sources).size);
  });
});

describe("Phase 53 — critical routing simulation matrix", () => {
  const cases: Array<[string, string, Partial<ReturnType<typeof simulatePProductionRouting>>]> = [
    ["/about", "", { worker: true, status: 200 }],
    ["/embed", "", { worker: true, status: 200 }],
    ["/p/about.html", "", { worker: true, status: 301 }],
    ["/p/about", "", { worker: true, status: 301 }],
    ["/p/youtube-thumbnail-url.html", "", { worker: true, status: 301 }],
    ["/p/random.html", "", { worker: true, hard404: true, status: 404 }],
    ["/p/random", "", { worker: true, hard404: true, status: 404 }],
  ];

  for (const [path, search, expected] of cases) {
    it(`${path}${search || ""}`, () => {
      const route = simulatePProductionRouting(path, search.replace(/^\?/, ""));
      for (const [key, value] of Object.entries(expected)) {
        expect(route[key as keyof typeof route]).toBe(value);
      }
    });
  }
});

describe("Phase 53 — trailing-slash utility URLs", () => {
  for (const page of UTILITIES) {
    const clean = `/${page.slug}`;
    const slashed = `${clean}/`;

    it(`${slashed} is Worker-first and 301 → clean canonical`, async () => {
      expect(matchesRunWorkerFirst(slashed)).toBe(true);
      expect(utilityTrailingSlashCanonicalRedirect(new URL(`${SITE_ORIGIN}${slashed}`))).toBe(
        `${SITE_ORIGIN}${clean}`,
      );
    });
  }

  it("legacy /p/about.html/ strips slash then atomic-redirects to /about", async () => {
    const res = await worker.fetch(new Request(`${SITE_ORIGIN}/p/about.html/`), {
      ASSETS: { fetch: async () => new Response("x", { status: 404 }) },
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`${SITE_ORIGIN}/about`);
  });

  it("localized legacy /l/fr/p/about.html/ → 301 localized clean", async () => {
    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/p/about.html/"), {
      ASSETS: { fetch: async () => new Response("x", { status: 404 }) },
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://fr.11tik.com/l/fr/about");
  });

  it("/thumb/* and / remain Worker-first (Phase R2)", () => {
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(true);
    expect(matchesRunWorkerFirst("/")).toBe(true);
    expect(wrangler.assets.not_found_handling).toBe("404-page");
  });
});
