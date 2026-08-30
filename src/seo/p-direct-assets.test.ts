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
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { matchesRunWorkerFirst } from "./test-helpers/run-worker-first.ts";

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

/** Phase 2B routing: negative RWF + Worker /p/* fallback + edge query redirect design. */
export function simulatePProductionRouting(pathname: string, search = "") {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const workerFirst = matchesRunWorkerFirst(clean);
  const isUtilityHtml = INDEXABLE_UTILITY_PATHS.includes(
    clean as (typeof INDEXABLE_UTILITY_PATHS)[number],
  );

  if (isUtilityHtml && search && !workerFirst) {
    return { worker: false, assets: false, edgeRedirect: true, status: 301, hard404: false };
  }

  if (workerFirst && clean.startsWith("/p/")) {
    if (LEGACY_P_REDIRECTS.some((r) => r.from === clean)) {
      return { worker: true, assets: false, edgeRedirect: false, status: 301, hard404: false };
    }
    if (isUtilityHtml && search) {
      return { worker: true, assets: false, edgeRedirect: false, status: 301, hard404: false };
    }
    if (extensionlessPPathToHtml(clean)) {
      return { worker: true, assets: false, edgeRedirect: false, status: 301, hard404: false };
    }
    if (isUtilityHtml) {
      return { worker: true, assets: true, edgeRedirect: false, status: 200, hard404: false };
    }
    return { worker: true, assets: false, edgeRedirect: false, status: 404, hard404: true };
  }

  if (!workerFirst && isUtilityHtml) {
    return { worker: false, assets: true, edgeRedirect: false, status: 200, hard404: false };
  }

  return { worker: workerFirst, assets: !workerFirst, edgeRedirect: false, status: 200, hard404: false };
}

describe("Phase 2B — negative run_worker_first /p/* routing", () => {
  it("includes /p/* with six exact utility exclusions in run_worker_first", () => {
    expect(wrangler.assets.run_worker_first).toContain("/p/*");
    for (const path of P_DIRECT_ASSET_PATHS) {
      expect(wrangler.assets.run_worker_first).toContain(`!${path}`);
    }
    expect(wrangler.assets.run_worker_first).toContain("/l/*");
    expect(wrangler.assets.run_worker_first).toContain("/");
    expect(wrangler.assets.not_found_handling).toBe("single-page-application");
    expect(wrangler.assets.html_handling).toBe("none");
  });

  it("excludes six clean utility .html paths from Worker-first", () => {
    for (const path of P_DIRECT_ASSET_PATHS) {
      expect(matchesRunWorkerFirst(path), path).toBe(false);
    }
    expect(matchesRunWorkerFirst("/p/youtube-thumbnail-url.html")).toBe(true);
    expect(matchesRunWorkerFirst("/p/random.html")).toBe(true);
    expect(matchesRunWorkerFirst("/p/about")).toBe(true);
  });

  for (const page of UTILITIES) {
    describe(page.slug, () => {
      const canon = `${SITE_ORIGIN}/p/${page.slug}.html`;

      it("serves staged static asset directly (Worker excluded)", () => {
        const dir = getStagedStaticSite();
        const assetPath = join(dir, "p", `${page.slug}.html`);
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

        const route = simulatePProductionRouting(`/p/${page.slug}.html`);
        expect(route.worker).toBe(false);
        expect(route.assets).toBe(true);
        expect(route.status).toBe(200);
      });
    });
  }

  it("query on .html uses edge redirect design (Worker excluded on clean path after redirect)", () => {
    for (const page of UTILITIES) {
      const route = simulatePProductionRouting(`/p/${page.slug}.html`, "?m=1");
      expect(route.worker).toBe(false);
      expect(route.edgeRedirect).toBe(true);
      expect(route.status).toBe(301);
      expect(route.assets).toBe(false);
    }

    const expressions = INDEXABLE_UTILITY_PATHS.map(
      (path) =>
        `(http.host eq "www.11tik.com" and http.request.uri.path eq "${path}" and len(http.request.uri.query) > 0)`,
    );
    expect(expressions).toHaveLength(6);
    expect(expressions[0]).toContain("/p/about.html");
  });

  it("extensionless valid utility redirects via Worker (Assets _redirects skipped)", () => {
    for (const page of UTILITIES) {
      expect(extensionlessPPathToHtml(`/p/${page.slug}`)).toBe(`/p/${page.slug}.html`);
      const route = simulatePProductionRouting(`/p/${page.slug}`);
      expect(route.worker).toBe(true);
      expect(route.status).toBe(301);
    }
    expect(extensionlessPPathToHtml("/p/random")).toBe("");
  });

  it("extensionless+query resolves via Worker then edge (canonical chain)", () => {
    const hop1 = simulatePProductionRouting("/p/about", "?m=1");
    expect(hop1.worker).toBe(true);
    expect(hop1.status).toBe(301);
    const hop2 = simulatePProductionRouting("/p/about.html", "?m=1");
    expect(hop2.edgeRedirect).toBe(true);
    expect(hop2.status).toBe(301);
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

  it("Worker /p/* fallback: legacy 301, extensionless 301, query strip fallback", async () => {
    const legacy = await handlePrimaryPPathRequest(
      new URL("https://www.11tik.com/p/youtube-thumbnail-url.html"),
      {},
    );
    expect(legacy?.status).toBe(301);
    expect(legacy?.headers.get("location")).toBe(`${SITE_ORIGIN}/2026/08/youtube-thumbnail-url.html`);

    const ext = await handlePrimaryPPathRequest(new URL("https://www.11tik.com/p/about"), {});
    expect(ext?.status).toBe(301);
    expect(ext?.headers.get("location")).toBe(`${SITE_ORIGIN}/p/about.html`);

    const queryFallback = await handlePrimaryPPathRequest(
      new URL("https://www.11tik.com/p/about.html?m=1"),
      {},
    );
    expect(queryFallback?.status).toBe(301);
    expect(queryFallback?.headers.get("location")).toBe(`${SITE_ORIGIN}/p/about.html`);
  });

  it("localized /l/*/p/* utilities remain on /l/* Worker-first path", () => {
    expect(wrangler.assets.run_worker_first).toContain("/l/*");

    const dir = getStagedStaticSite();
    const locales = ["fr", "de", "ar"] as const;
    for (const locale of locales) {
      for (const page of UTILITIES) {
        const rel = `l/${locale}/p/${page.slug}.html`;
        expect(existsSync(join(dir, rel)), rel).toBe(true);
      }
    }

    expect(matchesRunWorkerFirst("/l/fr/p/about.html")).toBe(true);
  });

  it("/l/fr/p/* still served via Worker locale passthrough (unchanged)", async () => {
    const dir = getStagedStaticSite();
    const localizedBody = readFileSync(join(dir, "l/fr/p/about.html"), "utf8");
    const seen: string[] = [];
    const env = {
      ASSETS: {
        fetch(req: Request) {
          seen.push(new URL(req.url).pathname);
          return new Response(localizedBody, { status: 200 });
        },
      },
    };

    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/p/about.html"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/l/fr/p/about.html"]);
  });

  it("/thumb/* and homepage query shells stay Worker-first / SPA (unchanged)", () => {
    expect(wrangler.assets.run_worker_first).not.toContain("/thumb/*");
    expect(wrangler.assets.run_worker_first).toContain("/");
    expect(wrangler.assets.not_found_handling).toBe("single-page-application");

    expect(matchesRunWorkerFirst("/")).toBe(true);
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(false);
  });

  it("Blogger paths /feeds/* and /search remain Worker-first", () => {
    expect(wrangler.assets.run_worker_first).toContain("/feeds/pages/*");
    expect(wrangler.assets.run_worker_first).toContain("/feeds/posts/default");
    expect(wrangler.assets.run_worker_first).not.toContain("/feeds/*");
    expect(wrangler.assets.run_worker_first).toContain("/search");
    expect(wrangler.assets.run_worker_first).toContain("/search/*");
    expect(wrangler.assets.run_worker_first).toContain("/sitemap-pages.xml");
    expect(matchesRunWorkerFirst("/feeds/posts/default")).toBe(true);
    expect(matchesRunWorkerFirst("/search")).toBe(true);
    expect(matchesRunWorkerFirst("/search/label/youtube")).toBe(true);
  });

  it("/2026/* articles remain direct Assets (not Worker-first)", () => {
    expect(wrangler.assets.run_worker_first).not.toContain("/2026/*");
    expect(matchesRunWorkerFirst("/2026/08/youtube-thumbnail-url.html")).toBe(false);
  });

  it("sitemap 1095 and IndexNow 1095 unchanged", () => {
    const dir = getStagedStaticSite();
    const sitemap = readFileSync(join(dir, "sitemap.xml"), "utf8");
    expect([...sitemap.matchAll(/<loc>/g)].length).toBe(1095);
    expect(sitemap).not.toMatch(/<loc>https:\/\/www\.11tik\.com\/p\/youtube-thumbnail-url\.html<\/loc>/);

    const snap = buildIndexNowSnapshot(dir);
    expect(snap.urlCount).toBe(1095);
  });

  it("translation matrix 888/888 unchanged", () => {
    const manifest = scanPublishability();
    expect(manifest.counts.ready).toBe(888);
    expect(manifest.counts.stale).toBe(0);
    expect(manifest.counts.missing).toBe(0);
    expect(manifest.counts.failed).toBe(0);
  });

  it("no /index.html pollution in utility canonicals or sitemap", () => {
    const dir = getStagedStaticSite();
    const locs = parseSitemapLocs(readFileSync(join(dir, "sitemap.xml"), "utf8"));
    for (const path of INDEXABLE_UTILITY_PATHS) {
      expect(locs).toContain(`${SITE_ORIGIN}${path}`);
      expect(locs).not.toContain(`${SITE_ORIGIN}${path.replace(".html", "/index.html")}`);
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

describe("Phase 2B — critical routing simulation matrix (A–L)", () => {
  const cases: Array<[string, string, Partial<ReturnType<typeof simulatePProductionRouting>>]> = [
    ["/p/about.html", "", { worker: false, assets: true, status: 200 }],
    ["/p/privacy.html", "", { worker: false, assets: true, status: 200 }],
    ["/p/terms-of-use.html", "", { worker: false, assets: true, status: 200 }],
    ["/p/contact.html", "", { worker: false, assets: true, status: 200 }],
    ["/p/embed.html", "", { worker: false, assets: true, status: 200 }],
    ["/p/keyword-tools.html", "", { worker: false, assets: true, status: 200 }],
    ["/p/about.html", "?m=1", { worker: false, edgeRedirect: true, status: 301 }],
    ["/p/about", "", { worker: true, status: 301 }],
    ["/p/about", "?m=1", { worker: true, status: 301 }],
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

describe("Phase 2C — trailing-slash utility URLs", () => {
  for (const page of UTILITIES) {
    const clean = `/p/${page.slug}.html`;
    const slashed = `${clean}/`;

    it(`${clean} remains Worker-excluded (direct Asset)`, () => {
      expect(matchesRunWorkerFirst(clean)).toBe(false);
    });

    it(`${slashed} is Worker-first and 301 → clean canonical`, async () => {
      expect(matchesRunWorkerFirst(slashed)).toBe(true);
      expect(utilityTrailingSlashCanonicalRedirect(new URL(`${SITE_ORIGIN}${slashed}`))).toBe(
        `${SITE_ORIGIN}${clean}`,
      );

      const res = await handlePrimaryPPathRequest(new URL(`${SITE_ORIGIN}${slashed}`), {});
      expect(res?.status).toBe(301);
      expect(res?.headers.get("location")).toBe(`${SITE_ORIGIN}${clean}`);

      const assetCalls: string[] = [];
      const env = {
        ASSETS: {
          fetch(req: Request) {
            assetCalls.push(new URL(req.url).pathname);
            return new Response("homepage spa", { status: 200 });
          },
        },
      };
      const blocked = await handlePrimaryPPathRequest(new URL(`${SITE_ORIGIN}${slashed}`), env);
      expect(blocked?.status).toBe(301);
      expect(assetCalls).toEqual([]);
    });
  }

  it("unknown /p/random.html/ stays 404 (not homepage SPA)", async () => {
    expect(utilityTrailingSlashCanonicalRedirect(new URL(`${SITE_ORIGIN}/p/random.html/`))).toBe("");
    const env = {
      ASSETS: {
        fetch() {
          return new Response("<html id=\"root\">homepage</html>", { status: 200 });
        },
      },
    };
    const res = await handlePrimaryPPathRequest(new URL(`${SITE_ORIGIN}/p/random.html/`), env);
    expect(res?.status).toBe(404);
    expect(await res!.text()).toContain("404 Not Found");
  });

  it("/p/about.html/?m=1 → 301 clean (no loop, no SPA body)", async () => {
    const res = await handlePrimaryPPathRequest(new URL(`${SITE_ORIGIN}/p/about.html/?m=1`), {});
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe(`${SITE_ORIGIN}/p/about.html`);
    const route = simulatePProductionRouting("/p/about.html", "m=1");
    expect(route.edgeRedirect).toBe(true);
    expect(route.status).toBe(301);
  });

  it("/p/about.html/?foo=1 → 301 clean canonical only", async () => {
    const res = await handlePrimaryPPathRequest(new URL(`${SITE_ORIGIN}/p/about.html/?foo=1`), {});
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe(`${SITE_ORIGIN}/p/about.html`);
  });

  it("localized /l/fr/p/about.html/ → 301 via Worker slash handler (not www /p/ handler)", async () => {
    const assetCalls: string[] = [];
    const env = {
      ASSETS: {
        fetch(req: Request) {
          assetCalls.push(new URL(req.url).pathname);
          return new Response("homepage spa", { status: 200 });
        },
      },
    };
    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/p/about.html/"), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://fr.11tik.com/l/fr/p/about.html");
    expect(assetCalls).toEqual([]);
  });

  it("/thumb/* and / remain unchanged", () => {
    expect(matchesRunWorkerFirst("/thumb/dQw4w9WgXcQ")).toBe(false);
    expect(matchesRunWorkerFirst("/")).toBe(true);
    expect(wrangler.assets.not_found_handling).toBe("single-page-application");
  });
});
