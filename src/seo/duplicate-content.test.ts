import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KEYWORD_LANDINGS } from "../content/keywordLandings";
import { KEYWORD_LANDINGS as WORKER_LANDINGS } from "../../workers/keyword-landings-data.js";
import {
  homepageUrlWithoutBloggerMobileParam,
  patchHomepageShellHtml,
  resolveHomepageQueryShell,
} from "../../workers/homepage-query-shell.mjs";
import { copyrightStaticHtml } from "../../scripts/write-copyright-static.mjs";
import worker from "../../workers/11tik-edge.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

/** Ahrefs File 24 duplicate-content CSV clusters. */
const QUERY_VARIANTS = [
  "?posts=1&m=1",
  "?k=bulk-youtube-thumbnails&m=1",
  "?k=youtube-thumbnail-download&m=1",
  "?k=youtube-thumbnail-size&m=1",
  "?bulk=1&m=1",
  "?k=youtube-thumbnail-downloader&m=1",
  "?k=youtu-be-thumbnail&m=1",
  "?k=youtube-live-thumbnail&m=1",
  "?k=youtube-shorts-thumbnail&m=1",
  "?k=maxresdefault-thumbnail&m=1",
  "?k=youtube-thumbnail-url&m=1",
  "?k=original-youtube-thumbnail&m=1",
  "?k=hd-youtube-thumbnail&m=1",
];

function sampleHomeShell() {
  return `<!DOCTYPE html><html><head><title>Home</title><meta name="description" content="generic"/></head><body><div id="yte-root"><h1>YouTube Thumbnail Extractor</h1><p>Generic intro.</p></div></body></html>`;
}

describe("Ahrefs duplicate content (File 24)", () => {
  it("keeps worker keyword landings in sync with src/content/keywordLandings.ts", () => {
    expect(WORKER_LANDINGS.map((item) => item.slug)).toEqual(KEYWORD_LANDINGS.map((item) => item.slug));
  });

  it("301-strips Blogger ?m= on homepage query URLs", async () => {
    for (const q of QUERY_VARIANTS) {
      const url = new URL(`https://www.11tik.com/${q}`);
      const stripped = homepageUrlWithoutBloggerMobileParam(url);
      expect(stripped?.searchParams.has("m")).toBe(false);
      expect(stripped?.href).not.toContain("m=1");
    }

    const env = {
      ASSETS: {
        fetch() {
          throw new Error("ASSETS must not run before ?m= strip");
        },
      },
    };
    const res = await worker.fetch(new Request("https://www.11tik.com/?k=youtube-thumbnail-url&m=1"), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://www.11tik.com/?k=youtube-thumbnail-url");
  });

  it("patches crawlable shells so ?k= / ?posts=1 / ?bulk=1 differ from default home", () => {
    const base = sampleHomeShell();
    const k = patchHomepageShellHtml(base, resolveHomepageQueryShell(new URLSearchParams("k=youtube-thumbnail-url"))!);
    const posts = patchHomepageShellHtml(base, resolveHomepageQueryShell(new URLSearchParams("posts=1"))!);
    const bulk = patchHomepageShellHtml(base, resolveHomepageQueryShell(new URLSearchParams("bulk=1"))!);
    const hashes = new Set([base, k, posts, bulk]);
    expect(hashes.size).toBe(4);
    expect(k).toContain("Get a YouTube Thumbnail URL");
    expect(posts).toContain("YouTube thumbnail guides");
    expect(bulk).toContain("Bulk YouTube Thumbnail Extractor");
  });

  it("copyright static HTML differs from homepage shell and uses /copyright canonical", () => {
    const dir = getStagedStaticSite();
      const home = readFileSync(join(dir, "index.html"), "utf8");
      const copy = readFileSync(join(dir, "copyright", "index.html"), "utf8");
      expect(copy).toContain('rel="canonical" href="https://www.11tik.com/copyright"');
      expect(copy).toContain("<h1>Copyright &amp; Usage</h1>");
      expect(home).toContain("<h1>YouTube Thumbnail Extractor</h1>");
      expect(copy).not.toContain("<h1>YouTube Thumbnail Extractor</h1>");
      expect(copy).not.toBe(home);
  });

  it("worker serves patched homepage HTML for ?k= without ?m=", async () => {
    const env = {
      ASSETS: {
        fetch() {
          return new Response(sampleHomeShell(), {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        },
      },
    };
    const res = await worker.fetch(new Request("https://www.11tik.com/?k=hd-youtube-thumbnail"), env);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("Download an HD YouTube Thumbnail");
    expect(html).not.toContain("<h1>YouTube Thumbnail Extractor</h1>");
  });

  it("copyrightStaticHtml is self-contained legal copy", () => {
    const html = copyrightStaticHtml();
    expect(html).toContain("Is it legal to download YouTube thumbnails?");
    expect(html).toContain("Does 11tik store or claim ownership");
  });
});
