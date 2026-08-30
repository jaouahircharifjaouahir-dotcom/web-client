import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_POSTS } from "../content/posts";
import { INDEXABLE_UTILITY_PATHS } from "../../workers/sitemap-canonicals.js";
import {
  PHASE7B_LOCALE_RWF_NEGATIVES,
  PHASE7B_RUN_WORKER_FIRST,
  PHASE5_BROAD_RUN_WORKER_FIRST,
  PRODUCTION_RUN_WORKER_FIRST,
  cloudflarePathMatchesPattern,
  matchesPhase5BroadRunWorkerFirst,
  matchesPhase7bRunWorkerFirst,
  matchesRunWorkerFirstPatterns,
  splitPathnameSegments,
} from "./test-helpers/cloudflare-run-worker-first.ts";
import { matchesRunWorkerFirst, readWranglerConfig } from "./test-helpers/run-worker-first.ts";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

const SAMPLE_ARTICLE = "/2026/08/how-to-download-youtube-thumbnail.html";
const LOCALIZED_ARTICLE = "/l/fr/2026/08/how-to-download-youtube-thumbnail.html";
const LOCALIZED_UTILITY = "/l/fr/p/about.html";

type Expectation = { path: string; workerFirst: boolean; note?: string };

describe("Phase 7B.1 — cloudflarePathMatchesPattern", () => {
  it("prefix rules: /l/* and /feeds/pages/*", () => {
    expect(cloudflarePathMatchesPattern("/l/fr/", "/l/*")).toBe(true);
    expect(cloudflarePathMatchesPattern("/l/fr/p/about.html", "/l/*")).toBe(true);
    expect(cloudflarePathMatchesPattern("/feeds/pages/default", "/feeds/pages/*")).toBe(true);
    expect(cloudflarePathMatchesPattern("/feeds/posts/default", "/feeds/pages/*")).toBe(false);
  });

  it("exact rules and copyright* prefix", () => {
    expect(cloudflarePathMatchesPattern("/feeds/posts/default", "/feeds/posts/default")).toBe(true);
    expect(cloudflarePathMatchesPattern("/copyright", "/copyright*")).toBe(true);
    expect(cloudflarePathMatchesPattern("/copyright/", "/copyright*")).toBe(true);
  });

  it("deep tail globs for broad Phase 5 negatives", () => {
    expect(cloudflarePathMatchesPattern("/l/fr/2026/08/article", "/l/*/2026/*")).toBe(true);
    expect(cloudflarePathMatchesPattern("/l/fr/p/about", "/l/*/p/*")).toBe(true);
    expect(cloudflarePathMatchesPattern("/l/fr/", "/l/*/2026/*")).toBe(false);
  });

  it("segment globs for Phase 7B narrow negatives", () => {
    expect(cloudflarePathMatchesPattern(LOCALIZED_UTILITY, "/l/*/p/*.html")).toBe(true);
    expect(cloudflarePathMatchesPattern(LOCALIZED_ARTICLE, "/l/*/2026/*/*.html")).toBe(true);
    expect(cloudflarePathMatchesPattern("/l/fr/p/about", "/l/*/p/*.html")).toBe(false);
    expect(cloudflarePathMatchesPattern("/l/fr/2026/08/article", "/l/*/2026/*/*.html")).toBe(false);
    expect(cloudflarePathMatchesPattern("/l/fr/random.html", "/l/*/p/*.html")).toBe(false);
  });

  it("trailing slash adds segment so *.html exclusions do not match .html/", () => {
    expect(splitPathnameSegments("/l/fr/p/about.html/")).toEqual(["l", "fr", "p", "about.html", ""]);
    expect(cloudflarePathMatchesPattern("/l/fr/p/about.html/", "/l/*/p/*.html")).toBe(false);
    expect(cloudflarePathMatchesPattern("/l/fr/2026/08/how-to-download-youtube-thumbnail.html/", "/l/*/2026/*/*.html")).toBe(
      false,
    );
  });
});

describe("Phase 7C — production wrangler.jsonc Phase 7B locale RWF", () => {
  it("production RWF matches live Phase 7B narrow locale negatives", () => {
    const wrangler = readWranglerConfig();
    expect(wrangler.assets.run_worker_first).toEqual([...PRODUCTION_RUN_WORKER_FIRST]);
    expect(wrangler.assets.run_worker_first).toContain("/l/*");
    expect(wrangler.assets.run_worker_first).toContain(PHASE7B_LOCALE_RWF_NEGATIVES[0]);
    expect(wrangler.assets.run_worker_first).toContain(PHASE7B_LOCALE_RWF_NEGATIVES[1]);
    expect(
      wrangler.assets.run_worker_first.filter((r: string) => r === "/l/*" || r.startsWith("!/l/")),
    ).toEqual(["/l/*", ...PHASE7B_LOCALE_RWF_NEGATIVES]);
  });

  it("matchesRunWorkerFirst agrees with cloudflare matcher on production patterns", () => {
    const wrangler = readWranglerConfig();
    const paths = [
      "/",
      "/l/fr/",
      LOCALIZED_UTILITY,
      LOCALIZED_ARTICLE,
      "/p/about.html",
      "/robots.txt",
      "/thumb/dQw4w9WgXcQ",
    ];
    for (const path of paths) {
      expect(
        matchesRunWorkerFirst(path),
        path,
      ).toBe(matchesRunWorkerFirstPatterns(path, wrangler.assets.run_worker_first));
    }
  });
});

describe("Phase 7B.1 — Phase 7B narrow locale RWF matrix", () => {
  const assetFirst: Expectation[] = [
    { path: LOCALIZED_UTILITY, workerFirst: false },
    { path: "/l/ar/p/contact.html", workerFirst: false },
    { path: "/l/fr/p/keyword-tools.html", workerFirst: false },
    { path: LOCALIZED_ARTICLE, workerFirst: false },
    { path: "/l/de/2026/08/youtube-thumbnail-url.html", workerFirst: false },
  ];

  const workerFirst: Expectation[] = [
    { path: "/l/fr/", workerFirst: true, note: "locale home directory" },
    { path: "/l/ar/", workerFirst: true },
    { path: "/l/fr/p/about.html/", workerFirst: true, note: "7A slash redirect" },
    { path: "/l/fr/2026/08/how-to-download-youtube-thumbnail.html/", workerFirst: true },
    { path: "/l/fr/p/about", workerFirst: true, note: "extensionless utility" },
    { path: "/l/fr/2026/08/how-to-download-youtube-thumbnail", workerFirst: true, note: "extensionless article" },
    { path: "/l/fr/random.html", workerFirst: true, note: "unknown localized soft-404" },
    { path: "/l/fr/random.html/", workerFirst: true },
    { path: "/l/fr/random", workerFirst: true },
  ];

  for (const { path, workerFirst: expectWorkerFirst } of assetFirst) {
    it(`asset-first: ${path}`, () => {
      expect(matchesPhase7bRunWorkerFirst(path)).toBe(expectWorkerFirst);
      expect(matchesRunWorkerFirst(path)).toBe(expectWorkerFirst);
    });
  }

  for (const { path, workerFirst: expectWorkerFirst, note } of workerFirst) {
    it(`worker-first: ${path}${note ? ` (${note})` : ""}`, () => {
      expect(matchesPhase7bRunWorkerFirst(path)).toBe(expectWorkerFirst);
      expect(matchesRunWorkerFirst(path)).toBe(expectWorkerFirst);
    });
  }

  it("all sitemap localized article paths → asset-first under Phase 7B", () => {
    const xml = readFileSync(join(getStagedStaticSite(), "sitemap.xml"), "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
    const localizedArticles = locs.filter((loc) => /^\/l\/[a-z]{2}\/2026\/\d{2}\/[^/]+\.html$/.test(loc));
    expect(localizedArticles.length).toBeGreaterThan(0);
    for (const path of localizedArticles.slice(0, 24)) {
      expect(matchesPhase7bRunWorkerFirst(path), path).toBe(false);
    }
  });

  it("locale query shells match pathname /l/fr/ → Worker-first (RWF ignores query)", () => {
    expect(matchesRunWorkerFirst("/l/fr/")).toBe(true);
    expect(matchesPhase7bRunWorkerFirst("/l/fr/")).toBe(true);
  });

  it("indexable utilities × sample locales → asset-first under Phase 7B", () => {
    for (const utility of INDEXABLE_UTILITY_PATHS) {
      const slug = utility.replace(/^\/p\//, "");
      for (const locale of ["fr", "ar", "de"]) {
        const path = `/l/${locale}/p/${slug}`;
        expect(matchesPhase7bRunWorkerFirst(path), path).toBe(false);
        expect(matchesRunWorkerFirst(path), path).toBe(false);
      }
    }
  });

  it("required Phase 7C routing matrix classifications", () => {
    const assetFirst = [
      "/l/fr/p/about.html",
      "/l/fr/p/keyword-tools.html",
      "/l/fr/2026/08/how-to-download-youtube-thumbnail.html",
      "/l/ar/p/about.html",
      "/l/ar/2026/08/how-to-download-youtube-thumbnail.html",
    ];
    const workerFirstPaths = [
      "/l/fr/",
      "/l/ar/",
      "/l/fr/p/about",
      "/l/fr/2026/08/how-to-download-youtube-thumbnail",
      "/l/fr/p/about.html/",
      "/l/fr/2026/08/how-to-download-youtube-thumbnail.html/",
      "/l/fr/random.html",
      "/l/fr/random",
      "/l/fr/random.html/",
    ];
    for (const path of assetFirst) {
      expect(matchesRunWorkerFirst(path), path).toBe(false);
    }
    for (const path of workerFirstPaths) {
      expect(matchesRunWorkerFirst(path), path).toBe(true);
    }
  });
});

describe("Phase 7C — production matches Phase 7B vs broad Phase 5 contrast", () => {
  it("production: clean localized .html is asset-first (Phase 7B)", () => {
    expect(matchesRunWorkerFirst(LOCALIZED_UTILITY)).toBe(false);
    expect(matchesRunWorkerFirst(LOCALIZED_ARTICLE)).toBe(false);
    expect(matchesPhase7bRunWorkerFirst(LOCALIZED_UTILITY)).toBe(false);
    expect(matchesPhase7bRunWorkerFirst(LOCALIZED_ARTICLE)).toBe(false);
  });

  it("narrow Phase 7B keeps extensionless paths Worker-first; broad Phase 5 does not", () => {
    const extensionlessUtility = "/l/fr/p/about";
    const extensionlessArticle = "/l/fr/2026/08/how-to-download-youtube-thumbnail";
    expect(matchesPhase7bRunWorkerFirst(extensionlessUtility)).toBe(true);
    expect(matchesPhase7bRunWorkerFirst(extensionlessArticle)).toBe(true);
    expect(matchesPhase5BroadRunWorkerFirst(extensionlessUtility)).toBe(false);
    expect(matchesPhase5BroadRunWorkerFirst(extensionlessArticle)).toBe(false);
  });

  it("Phase 7B fixture lists exact narrow negatives (not broad Phase 5)", () => {
    expect(PHASE7B_RUN_WORKER_FIRST).toContain("/l/*");
    expect(PHASE7B_RUN_WORKER_FIRST).toContain("!/l/*/2026/*/*.html");
    expect(PHASE7B_RUN_WORKER_FIRST).toContain("!/l/*/p/*.html");
    expect(PHASE7B_RUN_WORKER_FIRST).not.toContain("!/l/*/2026/*");
    expect(PHASE7B_RUN_WORKER_FIRST).not.toContain("!/l/*/p/*");
    expect(PHASE5_BROAD_RUN_WORKER_FIRST).toContain("!/l/*/2026/*");
    expect(PHASE5_BROAD_RUN_WORKER_FIRST).toContain("!/l/*/p/*");
  });
});

describe("Phase 7B.1 — non-locale production paths unchanged under Phase 7B fixture", () => {
  const unchanged: Expectation[] = [
    { path: "/", workerFirst: true },
    { path: "/p/about.html", workerFirst: false },
    { path: "/p/random.html", workerFirst: true },
    { path: SAMPLE_ARTICLE, workerFirst: true },
    { path: "/feeds/posts/default", workerFirst: true },
    { path: "/feeds/pages/default", workerFirst: true },
    { path: "/search", workerFirst: true },
    { path: "/sitemap-pages.xml", workerFirst: true },
    { path: "/robots.txt", workerFirst: false },
    { path: "/thumb/dQw4w9WgXcQ", workerFirst: false },
  ];

  for (const { path, workerFirst } of unchanged) {
    it(`${path} → production ${workerFirst ? "Worker-first" : "asset-first"}`, () => {
      expect(matchesRunWorkerFirst(path)).toBe(workerFirst);
      expect(matchesPhase7bRunWorkerFirst(path)).toBe(workerFirst);
    });
  }

  it("English guide hrefs stay Worker-first under both configs", () => {
    for (const post of GUIDE_POSTS) {
      const path = new URL(post.href).pathname;
      expect(matchesRunWorkerFirst(path), path).toBe(true);
      expect(matchesPhase7bRunWorkerFirst(path), path).toBe(true);
    }
  });
});
