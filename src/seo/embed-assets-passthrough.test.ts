import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import worker from "../../workers/11tik-edge.js";

const EMBED_CANON = "https://www.11tik.com/p/embed.html";

function articleContentWords(html: string): number {
  const body = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1] || "";
  const text = body
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(/\s+/).filter(Boolean).length;
}

function countHreflang(html: string): number {
  return [...html.matchAll(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhreflang=/gi)].length;
}

function countAhrefs(html: string): number {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']https:\/\/analytics\.ahrefs\.com\/analytics\.js["'][^>]*>/gi)]
    .length;
}

describe("Worker ASSETS passthrough (www /p/embed.html)", () => {
  it("serves staged embed from ASSETS (never Blogger)", async () => {
    const dir = getStagedStaticSite();
    const assetBody = readFileSync(join(dir, "p", "embed.html"), "utf8");

    expect(assetBody).toContain('hreflang="x-default"');
    expect(assetBody).not.toContain("cdn-cgi/l/email-protection");
    expect(countHreflang(assetBody)).toBe(39);

    const seen: string[] = [];
    const env = {
      ASSETS: {
        fetch(req: Request) {
          seen.push(new URL(req.url).pathname);
          return new Response(assetBody, {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        },
      },
    };

    const res = await worker.fetch(new Request(EMBED_CANON), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(seen).toEqual(["/p/embed.html"]);

    const html = await res.text();
    expect(html).toBe(assetBody);
    expect(html).toContain("Embed the 11tik Thumbnail Extractor");
    expect(html).toContain('data-yte-content-path="/p/embed.html"');

    expect([...html.matchAll(/<h1\b/gi)].length).toBe(1);
    expect(html).toMatch(/rel="canonical" href="https:\/\/www\.11tik\.com\/p\/embed\.html"/);
    expect(html).toMatch(/name="robots" content="index,follow"/);
    expect(html).toMatch(/hreflang="x-default"/);
    expect(html).toMatch(/hreflang="fr"/);
    expect(countHreflang(html)).toBe(39);
    expect(countAhrefs(html)).toBe(1);

    const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    expect(jsonLd.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(jsonLd[0]![1]!);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@graph"]?.[0]?.["@type"]).toBe("WebPage");
    expect(parsed["@graph"]?.[0]?.mainEntityOfPage).toBe(EMBED_CANON);

    expect(articleContentWords(html)).toBe(articleContentWords(assetBody));
  });

  it("301-canonicalizes /p/embed.html query variants (no duplicate URLs)", async () => {
    const env = {
      ASSETS: {
        fetch() {
          throw new Error("ASSETS must not run before embed query canonicalize");
        },
      },
    };
    for (const q of ["?m=1", "?m=0", "?foo=1"]) {
      const res = await worker.fetch(new Request(`https://www.11tik.com/p/embed.html${q}`), env);
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(EMBED_CANON);
    }
  });

  it("does not intercept localized embed pages (remain static Assets path)", async () => {
    const dir = getStagedStaticSite();
    const localizedBody = readFileSync(join(dir, "l", "ar", "p", "embed.html"), "utf8");
    const seen: string[] = [];
    const env = {
      ASSETS: {
        fetch(req: Request) {
          seen.push(new URL(req.url).pathname);
          return new Response(localizedBody, { status: 200 });
        },
      },
    };

    const res = await worker.fetch(new Request("https://ar.11tik.com/l/ar/p/embed.html"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/l/ar/p/embed.html"]);
    expect(await res.text()).toBe(localizedBody);
  });

  it("does not change embed translation readiness (888 matrix)", () => {
    const manifest = scanPublishability();
    expect(manifest.counts.ready).toBe(888);
    expect(manifest.counts.stale).toBe(0);
    expect(manifest.counts.missing).toBe(0);
    expect(manifest.counts.failed).toBe(0);

    const embed = manifest.contents.embed;
    expect(embed).toBeDefined();
    const locales = Object.values(embed!.locales);
    expect(locales.filter((l) => l.status === "ready").length).toBe(37);
  });
});
