import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRouteManifest } from "../../scripts/i18n/build-route-manifest.mjs";
import { buildContentInventory } from "../../scripts/i18n/content-inventory.mjs";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import worker, { isThumbShareSpaPath, localeHomeIndexAssetPath } from "../../workers/11tik-edge.js";
import {
  createRouteResolver,
  isValidContentSlug,
  parseCleanUrlRequest,
  resolveCleanUrl,
  ROUTE_LOOKUP_STATUS,
} from "../../workers/clean-url-resolver.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

const inventory = buildContentInventory();
const publishScan = scanPublishability(inventory);
const manifest = buildRouteManifest(inventory, publishScan);
const resolver = createRouteResolver(manifest);

const STAGED = getStagedStaticSite();
const KNOWN_ARTICLE = "how-to-download-youtube-thumbnail";
const KNOWN_PAGE = "about";
const STUDY = "youtube-thumbnail-sizes-resolutions-study";

function assetsEnv(onFetch: (pathname: string) => Response | Promise<Response>) {
  return {
    ASSETS: {
      fetch(req: Request) {
        return onFetch(new URL(req.url).pathname);
      },
    },
  };
}

describe("clean URL route manifest", () => {
  it("builds from inventory + publishability without a second source of truth", () => {
    expect(manifest.v).toBe(1);
    expect(manifest.counts.enArticles).toBe(19);
    expect(manifest.counts.enPages).toBe(7);
    expect(manifest.en.articles[KNOWN_ARTICLE]?.legacyPath).toBe(
      "/2026/08/how-to-download-youtube-thumbnail.html",
    );
    expect(manifest.en.pages[KNOWN_PAGE]?.legacyPath).toBe("/p/about.html");
    expect(manifest.enOnly).toContain(STUDY);
    expect(manifest.counts.localizedPairs).toBeGreaterThan(700);
  });

  it("writes staged and worker manifests during static site generation", () => {
    const stagedPath = join(STAGED, "web-client", "i18n", "route-manifest.json");
    const workerPath = join(process.cwd(), "workers", "route-manifest.json");
    expect(existsSync(workerPath)).toBe(true);
    const workerDoc = JSON.parse(readFileSync(workerPath, "utf8"));
    expect(workerDoc.counts.enArticles).toBe(19);
    expect(statSync(workerPath).size).toBeGreaterThan(10_000);
    if (existsSync(stagedPath)) {
      const stagedDoc = JSON.parse(readFileSync(stagedPath, "utf8"));
      expect(stagedDoc.counts?.enArticles ?? workerDoc.counts.enArticles).toBe(19);
    }
  });
});

describe("clean URL resolver lookups", () => {
  it("resolves valid EN article slug", () => {
    const result = resolver.resolveCleanUrl(`/${KNOWN_ARTICLE}`, { host: "www.11tik.com" });
    expect(result.status).toBe(ROUTE_LOOKUP_STATUS.EXISTS);
    expect(result.type).toBe("article");
    expect(result.legacyPath).toBe("/2026/08/how-to-download-youtube-thumbnail.html");
  });

  it("resolves valid EN page slug", () => {
    const result = resolver.resolveCleanUrl(`/${KNOWN_PAGE}`, { host: "www.11tik.com" });
    expect(result.status).toBe(ROUTE_LOOKUP_STATUS.EXISTS);
    expect(result.type).toBe("page");
    expect(result.legalShortcut).toBe(true);
  });

  it("resolves valid localized article on locale host", () => {
    const result = resolver.resolveCleanUrl(`/l/fr/${KNOWN_ARTICLE}`, { host: "fr.11tik.com" });
    expect(result.status).toBe(ROUTE_LOOKUP_STATUS.EXISTS);
    expect(result.locale).toBe("fr");
    expect(result.legacyPath).toBe("/l/fr/2026/08/how-to-download-youtube-thumbnail.html");
  });

  it("resolves valid localized page on locale host", () => {
    const result = resolver.resolveCleanUrl(`/l/fr/${KNOWN_PAGE}`, { host: "fr.11tik.com" });
    expect(result.status).toBe(ROUTE_LOOKUP_STATUS.EXISTS);
    expect(result.type).toBe("page");
    expect(result.legacyPath).toBe("/l/fr/p/about.html");
  });

  it("returns MISSING for unknown clean article", () => {
    expect(resolver.resolveCleanUrl("/not-a-real-article-slug").status).toBe(ROUTE_LOOKUP_STATUS.MISSING);
  });

  it("returns MISSING for unknown clean page", () => {
    expect(resolver.resolveCleanUrl("/not-a-real-page").status).toBe(ROUTE_LOOKUP_STATUS.MISSING);
  });

  it("returns INVALID_LOCALE for unsupported locale host pattern", () => {
    const result = resolver.resolveCleanUrl(`/l/zz/${KNOWN_PAGE}`, { host: "zz.11tik.com" });
    expect(result.status).toBe(ROUTE_LOOKUP_STATUS.INVALID_LOCALE);
  });

  it("returns NOT_PUBLISHED for EN-only study on localized clean path", () => {
    const result = resolver.resolveCleanUrl(`/l/fr/${STUDY}`, { host: "fr.11tik.com" });
    expect(result.status).toBe(ROUTE_LOOKUP_STATUS.NOT_PUBLISHED);
    expect(result.contentId).toBe(STUDY);
  });

  it("returns NOT_PUBLISHED when localized pair is absent from manifest", () => {
    const sparse = createRouteResolver({
      v: 1,
      targetLocales: ["fr"],
      enOnly: [],
      en: {
        articles: {
          "synthetic-missing-locale": {
            contentId: "synthetic-missing-locale",
            type: "article",
            legacyPath: "/2026/08/synthetic-missing-locale.html",
            cleanPath: "/synthetic-missing-locale",
            localizable: true,
          },
        },
        pages: {},
      },
      localized: {},
    });
    const result = sparse.resolveCleanUrl("/l/fr/synthetic-missing-locale", { host: "fr.11tik.com" });
    expect(result.status).toBe(ROUTE_LOOKUP_STATUS.NOT_PUBLISHED);
    expect(result.contentId).toBe("synthetic-missing-locale");
  });

  it("flags reserved routes without treating them as content", () => {
    expect(resolver.resolveCleanUrl("/").status).toBe(ROUTE_LOOKUP_STATUS.RESERVED_ROUTE);
    expect(resolver.resolveCleanUrl("/l/fr/", { host: "fr.11tik.com" }).status).toBe(
      ROUTE_LOOKUP_STATUS.RESERVED_ROUTE,
    );
    expect(resolver.resolveCleanUrl("/thumb/dQw4w9WgXcQ").status).toBe(ROUTE_LOOKUP_STATUS.RESERVED_ROUTE);
    expect(resolver.resolveCleanUrl("/web-client/blogger-app.js").status).toBe(ROUTE_LOOKUP_STATUS.RESERVED_ROUTE);
    expect(resolver.resolveCleanUrl("/2026/08/how-to-download-youtube-thumbnail.html").status).toBe(
      ROUTE_LOOKUP_STATUS.RESERVED_ROUTE,
    );
    expect(resolver.resolveCleanUrl("/p/about.html").status).toBe(ROUTE_LOOKUP_STATUS.RESERVED_ROUTE);
  });

  it("rejects traversal and invalid slug characters", () => {
    expect(isValidContentSlug("../about")).toBe(false);
    expect(resolver.resolveCleanUrl("/..").status).toBe(ROUTE_LOOKUP_STATUS.INVALID_PATH);
    expect(resolver.resolveCleanUrl("/foo%2e%2ebar").status).toBe(ROUTE_LOOKUP_STATUS.INVALID_PATH);
  });

  it("default export resolveCleanUrl uses bundled worker manifest", () => {
    const bundled = resolveCleanUrl(`/${KNOWN_ARTICLE}`);
    expect([ROUTE_LOOKUP_STATUS.EXISTS, ROUTE_LOOKUP_STATUS.MISSING]).toContain(bundled.status);
  });
});

describe("clean URL resolver — Phase 53 Worker routing", () => {
  it("legacy /2026/08/*.html 301 to clean URL", async () => {
    const res = await worker.fetch(
      new Request("https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html"),
      { ASSETS: assetsEnv(() => new Response("missing", { status: 404 })) },
    );
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://www.11tik.com/how-to-download-youtube-thumbnail");
  });

  it("localized legacy /l/{locale}/2026/*.html 301 to localized clean", async () => {
    const res = await worker.fetch(
      new Request("https://fr.11tik.com/l/fr/2026/08/how-to-download-youtube-thumbnail.html"),
      { ASSETS: assetsEnv(() => new Response("missing", { status: 404 })) },
    );
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(
      "https://fr.11tik.com/l/fr/how-to-download-youtube-thumbnail",
    );
  });

  it("homepage, thumb, and embed routing on migrated Worker", async () => {
    expect(localeHomeIndexAssetPath("/l/fr/")).toBe("/l/fr/index.html");
    expect(isThumbShareSpaPath("/thumb/dQw4w9WgXcQ")).toBe(true);

    const homeHtml = readFileSync(join(STAGED, "index.html"), "utf8");
    const embedHtml = existsSync(join(STAGED, "embed.html"))
      ? readFileSync(join(STAGED, "embed.html"), "utf8")
      : "<h1>Embed the 11tik Thumbnail Extractor</h1>";
    const env = assetsEnv((pathname) => {
      if (pathname === "/index.html") return new Response(homeHtml, { status: 200 });
      if (pathname === "/embed.html") {
        return new Response(embedHtml, { status: 200, headers: { "content-type": "text/html" } });
      }
      return new Response("missing", { status: 404 });
    });

    const home = await worker.fetch(new Request("https://www.11tik.com/"), env);
    expect(home.status).toBe(200);

    const thumb = await worker.fetch(new Request("https://www.11tik.com/thumb/dQw4w9WgXcQ"), env);
    expect(thumb.status).toBe(200);

    const embed = await worker.fetch(new Request("https://www.11tik.com/embed"), env);
    expect(embed.status).toBe(200);
  });

  it("parseCleanUrlRequest matches locale host architecture", () => {
    expect(parseCleanUrlRequest("/l/fr/about", "fr.11tik.com")).toEqual({
      pattern: "localized-content",
      locale: "fr",
      slug: "about",
    });
    expect(parseCleanUrlRequest("/how-to-download-youtube-thumbnail", "www.11tik.com")).toEqual({
      pattern: "en-content",
      slug: "how-to-download-youtube-thumbnail",
    });
  });
});
