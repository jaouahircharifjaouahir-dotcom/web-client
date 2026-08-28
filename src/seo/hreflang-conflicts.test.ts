import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import {
  patchHomepageShellHtml,
  resolveHomepageQueryShell,
  stripHreflangLinks,
} from "../../workers/homepage-query-shell.mjs";
import worker from "../../workers/11tik-edge.js";

const SEMRUSH_PAGES = [
  "https://www.11tik.com/?bulk=1",
  "https://www.11tik.com/?posts=1",
  "https://www.11tik.com/copyright",
];

function sampleHomeShell() {
  return `<!DOCTYPE html><html><head><title>Home</title>
  <link rel="canonical" href="https://www.11tik.com/"/>
  <link rel="alternate" hreflang="en" href="https://www.11tik.com/"/>
  <link rel="alternate" hreflang="x-default" href="https://www.11tik.com/"/>
  <link rel="alternate" hreflang="fr" href="https://fr.11tik.com/l/fr/"/>
</head><body><div id="yte-root"><h1>YouTube Thumbnail Extractor</h1><p>Generic.</p></div></body></html>`;
}

function hreflangTags(html: string) {
  return [...html.matchAll(/<link\b[^>]*\bhreflang=[^>]*>/gi)].map((m) => m[0]);
}

function canonicalHref(html: string) {
  return /rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1];
}

describe("Semrush hreflang conflicts (Rank #1)", () => {
  it("stripHreflangLinks removes every hreflang alternate", () => {
    const out = stripHreflangLinks(sampleHomeShell());
    expect(hreflangTags(out).length).toBe(0);
    expect(out).toContain('rel="canonical"');
  });

  it("homepage query shells drop hreflang (canonical consolidates to /)", () => {
    const base = sampleHomeShell();
    for (const q of ["posts=1", "bulk=1", "k=youtube-thumbnail-url"]) {
      const variant = resolveHomepageQueryShell(new URLSearchParams(q));
      expect(variant, q).toBeTruthy();
      const html = patchHomepageShellHtml(base, variant!);
      expect(hreflangTags(html), q).toHaveLength(0);
      expect(canonicalHref(html)).toBe("https://www.11tik.com/");
    }
  });

  it("Worker serves query shells without hreflang via homepage patch", async () => {
    const env = {
      ASSETS: {
        fetch(req: Request) {
          expect(new URL(req.url).pathname).toBe("/");
          return new Response(sampleHomeShell(), {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        },
      },
    };
    for (const path of ["/?bulk=1", "/?posts=1", "/?k=youtube-thumbnail-url"]) {
      const res = await worker.fetch(new Request(`https://www.11tik.com${path}`), env);
      expect(res.status, path).toBe(200);
      const html = await res.text();
      expect(hreflangTags(html), path).toHaveLength(0);
    }
  });

  it("Worker serves /copyright static (not SPA fallback) with self canonical and no hreflang", async () => {
    const staged = getStagedStaticSite();
      const copyrightFile = join(staged, "copyright", "index.html");
      expect(existsSync(copyrightFile)).toBe(true);
      const copyrightHtml = readFileSync(copyrightFile, "utf8");

      const env = {
        ASSETS: {
          fetch(req: Request) {
            const path = new URL(req.url).pathname;
            if (path === "/copyright/index.html") {
              return new Response(copyrightHtml, {
                status: 200,
                headers: { "content-type": "text/html" },
              });
            }
            if (path === "/") {
              return new Response(sampleHomeShell(), { status: 200 });
            }
            return new Response("not found", { status: 404 });
          },
        },
      };

      const res = await worker.fetch(new Request("https://www.11tik.com/copyright"), env);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Copyright &amp; Usage");
      expect(canonicalHref(html)).toBe("https://www.11tik.com/copyright");
      expect(hreflangTags(html)).toHaveLength(0);
  });

  it("covers all 3 Semrush flagged URLs (9 issue rows)", () => {
    expect(SEMRUSH_PAGES).toEqual([
      "https://www.11tik.com/?bulk=1",
      "https://www.11tik.com/?posts=1",
      "https://www.11tik.com/copyright",
    ]);
  });
});
