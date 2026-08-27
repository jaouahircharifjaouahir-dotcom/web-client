import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateStaticSite } from "../../scripts/generate-static-site.mjs";
import worker, { httpsRedirectIfNeeded } from "../../workers/11tik-edge.js";

describe("Worker ASSETS passthrough (robots.txt)", () => {
  it("301s http /robots.txt to https", () => {
    const redirect = httpsRedirectIfNeeded(new Request("http://www.11tik.com/robots.txt"));
    expect(redirect).not.toBeNull();
    expect(redirect!.status).toBe(301);
    expect(redirect!.headers.get("Location")).toBe("https://www.11tik.com/robots.txt");
  });

  it("serves application robots from ASSETS (never Blogger Mediapartners)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "11tik-robots-"));
    let assetBody = "";
    try {
      generateStaticSite(dir);
      assetBody = readFileSync(join(dir, "robots.txt"), "utf8");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    expect(assetBody).toMatch(/^# 11tik robots\.txt/m);
    expect(assetBody).toMatch(/^User-agent: Amazonbot\r?\nAllow: \//m);
    expect(assetBody).toMatch(/^User-agent: GPTBot\r?\nDisallow: \//m);
    expect(assetBody).toMatch(/^User-agent: ClaudeBot\r?\nDisallow: \//m);
    expect(assetBody).toMatch(/^User-agent: Google-Extended\r?\nDisallow: \//m);
    expect(assetBody).toContain("Content-Signal: search=yes,ai-train=no,use=reference");
    expect(assetBody).toContain("Sitemap: https://www.11tik.com/sitemap.xml");
    expect(assetBody).not.toMatch(/^Disallow: \/l\//m);
    expect(assetBody).not.toContain("Mediapartners-Google");
    expect(assetBody).not.toContain("share-widget");

    const seen: string[] = [];
    const env = {
      ASSETS: {
        fetch(req: Request) {
          seen.push(new URL(req.url).pathname);
          return new Response(assetBody, {
            status: 200,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        },
      },
    };

    const res = await worker.fetch(new Request("https://www.11tik.com/robots.txt"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/robots.txt"]);
    const body = await res.text();
    expect(body).toBe(assetBody);
    expect(body).toMatch(/^User-agent: \*\r?\nContent-Signal:[^\n]*\r?\nAllow: \//m);
  });

  it("still serves Assets sitemap alongside robots", async () => {
    const seen: string[] = [];
    const env = {
      ASSETS: {
        fetch(req: Request) {
          const path = new URL(req.url).pathname;
          seen.push(path);
          if (path === "/sitemap.xml") {
            return new Response("<urlset></urlset>", {
              status: 200,
              headers: { "content-type": "application/xml" },
            });
          }
          return new Response("ok", { status: 200 });
        },
      },
    };
    const sm = await worker.fetch(new Request("https://www.11tik.com/sitemap.xml"), env);
    expect(sm.status).toBe(200);
    expect(seen).toContain("/sitemap.xml");
  });
});
