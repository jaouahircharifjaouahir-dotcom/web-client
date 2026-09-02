import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import worker from "../../workers/11tik-edge.js";
import {
  buildAtomicRedirectMap,
  resolveLegacyCleanRedirect,
} from "../../workers/clean-url-legacy-redirects.js";
import {
  resolveCleanUrl,
  ROUTE_LOOKUP_STATUS,
} from "../../workers/clean-url-resolver.js";
import { readWorkerRouteManifest } from "../../scripts/i18n/build-route-manifest.mjs";
import { buildContentInventory } from "../../scripts/i18n/content-inventory.mjs";
import { SITE_ORIGIN } from "../../workers/sitemap-canonicals.js";
import { parseSitemapLocs } from "../../workers/sitemap-canonicals.js";

const ROOT = process.cwd();
const STAGED = join(ROOT, "dist-assets");

function mockAssets(files: Record<string, string>) {
  return {
    async fetch(request: Request) {
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\//, "");
      if (files[path]) {
        return new Response(files[path], {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response("missing", { status: 404 });
    },
  };
}

describe("Phase 53 clean URL migration", () => {
  const manifest = readWorkerRouteManifest();

  it("manifest uses clean canonical paths with legacy preserved", () => {
    expect(manifest).toBeTruthy();
    const article = manifest!.en.articles["how-to-download-youtube-thumbnail"];
    expect(article.cleanPath).toBe("/how-to-download-youtube-thumbnail");
    expect(article.legacyPath).toBe("/2026/08/how-to-download-youtube-thumbnail.html");
    expect(article.assetRel).toBe("how-to-download-youtube-thumbnail.html");
    const page = manifest!.en.pages.about;
    expect(page.cleanPath).toBe("/about");
    expect(page.legacyPath).toBe("/p/about.html");
  });

  it("clean EN article resolves EXISTS with assetRel", () => {
    const result = resolveCleanUrl("/how-to-download-youtube-thumbnail");
    expect(result.status).toBe(ROUTE_LOOKUP_STATUS.EXISTS);
    expect(result.assetRel).toBe("how-to-download-youtube-thumbnail.html");
  });

  it("clean localized article resolves EXISTS", () => {
    const result = resolveCleanUrl("/l/fr/how-to-download-youtube-thumbnail", {
      host: "fr.11tik.com",
    });
    expect(result.status).toBe(ROUTE_LOOKUP_STATUS.EXISTS);
    expect(result.cleanPath).toBe("/l/fr/how-to-download-youtube-thumbnail");
  });

  it("study EN clean resolves; localized study is NOT_PUBLISHED", () => {
    expect(resolveCleanUrl("/youtube-thumbnail-sizes-resolutions-study").status).toBe(
      ROUTE_LOOKUP_STATUS.EXISTS,
    );
    expect(
      resolveCleanUrl("/l/fr/youtube-thumbnail-sizes-resolutions-study", { host: "fr.11tik.com" })
        .status,
    ).toBe(ROUTE_LOOKUP_STATUS.NOT_PUBLISHED);
  });

  it("legacy article maps to clean in one hop", () => {
    const rule = resolveLegacyCleanRedirect("/2026/08/how-to-download-youtube-thumbnail.html");
    expect(rule?.to).toBe("/how-to-download-youtube-thumbnail");
    expect(rule?.status).toBe(301);
  });

  it("legacy /p/ page maps directly to clean (no /2026/ intermediate)", () => {
    const rule = resolveLegacyCleanRedirect("/p/about.html");
    expect(rule?.to).toBe("/about");
    const pGuide = resolveLegacyCleanRedirect("/p/how-to-download-youtube-thumbnail");
    expect(pGuide?.to).toBe("/how-to-download-youtube-thumbnail");
    expect(pGuide?.to.startsWith("/2026/")).toBe(false);
  });

  it("localized legacy maps to localized clean", () => {
    const rule = resolveLegacyCleanRedirect("/l/fr/2026/08/how-to-download-youtube-thumbnail.html");
    expect(rule?.to).toBe("/l/fr/how-to-download-youtube-thumbnail");
  });

  it("localized study legacy has no redirect rule", () => {
    expect(resolveLegacyCleanRedirect("/l/fr/2026/08/youtube-thumbnail-sizes-resolutions-study.html")).toBeNull();
  });

  it("every atomic redirect target is clean and sources do not chain", () => {
    const rules = buildAtomicRedirectMap(manifest!);
    const byFrom = new Map(rules.map((r) => [r.from, r.to]));
    for (const rule of rules) {
      expect(rule.to.startsWith("/2026/")).toBe(false);
      expect(rule.to.startsWith("/p/")).toBe(false);
      expect(byFrom.has(rule.to)).toBe(false);
    }
  });

  it("worker serves clean EN article 200 from staged asset", async () => {
    if (!existsSync(join(STAGED, "how-to-download-youtube-thumbnail.html"))) return;
    const html = readFileSync(join(STAGED, "how-to-download-youtube-thumbnail.html"), "utf8");
    const res = await worker.fetch(new Request("https://www.11tik.com/how-to-download-youtube-thumbnail"), {
      ASSETS: mockAssets({ "how-to-download-youtube-thumbnail.html": html }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("how-to-download-youtube-thumbnail");
  });

  it("worker legacy article returns single 301 to clean URL", async () => {
    const res = await worker.fetch(
      new Request("https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html"),
      { ASSETS: mockAssets({}) },
    );
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://www.11tik.com/how-to-download-youtube-thumbnail");
  });

  it("unknown clean slug returns 404", async () => {
    const res = await worker.fetch(new Request("https://www.11tik.com/not-a-real-article-slug"), {
      ASSETS: mockAssets({}),
    });
    expect(res.status).toBe(404);
  });

  it("sitemap emits only clean URLs for migrated content", () => {
    if (!existsSync(join(STAGED, "sitemap.xml"))) return;
    const xml = readFileSync(join(STAGED, "sitemap.xml"), "utf8");
    const locs = parseSitemapLocs(xml);
    expect(locs.some((l) => l.includes("/2026/08/"))).toBe(false);
    expect(locs.some((l) => l.includes("/p/about"))).toBe(false);
    expect(locs).toContain(`${SITE_ORIGIN}/how-to-download-youtube-thumbnail`);
    expect(locs).toContain(`${SITE_ORIGIN}/about`);
    expect(locs).toContain(`${SITE_ORIGIN}/youtube-thumbnail-sizes-resolutions-study`);
  });

  it("inventory canonical URLs are clean", () => {
    const inv = buildContentInventory();
    const article = inv.find((i) => i.contentId === "how-to-download-youtube-thumbnail");
    expect(article?.canonicalPath).toBe("/how-to-download-youtube-thumbnail");
    expect(article?.canonicalUrl).toBe(`${SITE_ORIGIN}/how-to-download-youtube-thumbnail`);
    const about = inv.find((i) => i.contentId === "about");
    expect(about?.canonicalPath).toBe("/about");
  });
});
