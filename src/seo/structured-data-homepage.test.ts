import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import worker from "../../workers/11tik-edge.js";

function jsonLdBlocks(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(
    (m) => m[1]!,
  );
}

function hasSoftwareApplication(html: string): boolean {
  return jsonLdBlocks(html).some((block) => {
    try {
      const parsed = JSON.parse(block);
      const nodes = parsed["@graph"] ?? [parsed];
      return nodes.some((node: { "@type"?: string | string[] }) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        return types.some((t) => String(t).includes("SoftwareApplication"));
      });
    } catch {
      return block.includes("SoftwareApplication");
    }
  });
}

function hasInvalidSoftwareAppRating(html: string): boolean {
  return jsonLdBlocks(html).some((block) => {
    try {
      const parsed = JSON.parse(block);
      const nodes = parsed["@graph"] ?? [parsed];
      return nodes.some((node: Record<string, unknown>) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        if (!types.some((t) => String(t).includes("SoftwareApplication"))) return false;
        return !node.aggregateRating && !node.review;
      });
    } catch {
      return false;
    }
  });
}

function hasWebApplication(html: string): boolean {
  return jsonLdBlocks(html).some((block) => block.includes("WebApplication"));
}

function stagedHomeAssetsEnv(homeHtml: string) {
  const staged = getStagedStaticSite();
  const copyrightHtml = readFileSync(join(staged, "copyright", "index.html"), "utf8");
  return {
    ASSETS: {
      fetch(req: Request) {
        const path = new URL(req.url).pathname;
        if (path === "/") {
          return new Response(homeHtml, {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        if (path === "/copyright/index.html") {
          return new Response(copyrightHtml, {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        return new Response("not found", { status: 404 });
      },
    },
  };
}

describe("Semrush structured data — homepage Software App (Rank #4 follow-up)", () => {
  const staged = getStagedStaticSite();
  const homeHtml = readFileSync(join(staged, "index.html"), "utf8");

  it("Blogger theme homepage app node is WebApplication only (no SoftwareApplication)", () => {
    const theme = readFileSync(join(process.cwd(), "docs/blogger-theme.xml"), "utf8");
    expect(theme).toContain('"@id":"https://www.11tik.com/#app"');
    expect(theme).toContain('"@type":"WebApplication","@id":"https://www.11tik.com/#app"');
    expect(theme).not.toContain('"@type":["WebApplication","SoftwareApplication"]');
    expect(theme).not.toContain("aggregateRating");
    expect(theme).not.toContain('"review"');
  });

  it("staged clean / has WebApplication only", () => {
    expect(homeHtml).toContain('"@type":"WebApplication"');
    expect(homeHtml).not.toContain("SoftwareApplication");
    expect(hasWebApplication(homeHtml)).toBe(true);
    expect(hasSoftwareApplication(homeHtml)).toBe(false);
  });

  it("wrangler routes homepage query URLs to Worker (trailing * on www root)", () => {
    const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));
    expect(wrangler.routes.some((r: { pattern: string }) => r.pattern === "www.11tik.com/")).toBe(true);
    expect(wrangler.routes.some((r: { pattern: string }) => r.pattern === "www.11tik.com/*")).toBe(true);
  });

  const queryCases = [
    { path: "/", expectJsonLd: true },
    { path: "/?bulk=1", expectJsonLd: false },
    { path: "/?posts=1", expectJsonLd: false },
    { path: "/?embed=1", expectJsonLd: true },
    { path: "/?k=youtube-thumbnail-url", expectJsonLd: false },
    { path: "/?foo=1", expectJsonLd: true },
  ] as const;

  for (const { path, expectJsonLd } of queryCases) {
    it(`Worker ${path} → 200, no SoftwareApplication`, async () => {
      const env = stagedHomeAssetsEnv(homeHtml);
      const res = await worker.fetch(new Request(`https://www.11tik.com${path}`), env);
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      const html = await res.text();
      expect(hasSoftwareApplication(html)).toBe(false);
      expect(hasInvalidSoftwareAppRating(html)).toBe(false);
      if (expectJsonLd) {
        expect(hasWebApplication(html)).toBe(true);
        expect(jsonLdBlocks(html).length).toBeGreaterThan(0);
      } else {
        expect(jsonLdBlocks(html)).toHaveLength(0);
      }
    });
  }

  it("301-strips ?m=1 on homepage before ASSETS", async () => {
    const env = {
      ASSETS: {
        fetch() {
          throw new Error("ASSETS must not run before ?m= strip");
        },
      },
    };
    for (const q of ["?m=1", "?bulk=1&m=1", "?embed=1&m=1", "?posts=1&m=1"]) {
      const res = await worker.fetch(new Request(`https://www.11tik.com/${q}`), env);
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).not.toContain("m=1");
    }
  });

  it("/copyright → 200 with no JSON-LD", async () => {
    const env = stagedHomeAssetsEnv(homeHtml);
    const res = await worker.fetch(new Request("https://www.11tik.com/copyright"), env);
    expect(res.status).toBe(200);
    expect(jsonLdBlocks(await res.text())).toHaveLength(0);
  });

  it("does not change translation readiness (888 matrix)", () => {
    const manifest = scanPublishability();
    expect(manifest.counts.ready).toBe(888);
    expect(manifest.counts.stale).toBe(0);
    expect(manifest.counts.missing).toBe(0);
    expect(manifest.counts.failed).toBe(0);
    expect(Object.values(manifest.contents.contact!.locales).filter((l) => l.status === "ready").length).toBe(37);
    expect(Object.values(manifest.contents.embed!.locales).filter((l) => l.status === "ready").length).toBe(37);
  });
});
