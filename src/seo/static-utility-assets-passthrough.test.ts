import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import worker, { withSecurityHeaders } from "../../workers/11tik-edge.js";

const UTILITIES = [
  {
    slug: "about",
    canon: "https://www.11tik.com/p/about.html",
    h1: "About 11tik",
    localePath: "l/ar/p/about.html",
    localeHost: "https://ar.11tik.com/l/ar/p/about.html",
    manifestKey: "about" as const,
  },
  {
    slug: "privacy",
    canon: "https://www.11tik.com/p/privacy.html",
    h1: "Privacy Policy",
    localePath: "l/fr/p/privacy.html",
    localeHost: "https://fr.11tik.com/l/fr/p/privacy.html",
    manifestKey: "privacy" as const,
  },
  {
    slug: "terms-of-use",
    canon: "https://www.11tik.com/p/terms-of-use.html",
    h1: "Terms of use",
    localePath: "l/de/p/terms-of-use.html",
    localeHost: "https://de.11tik.com/l/de/p/terms-of-use.html",
    manifestKey: "terms-of-use" as const,
  },
] as const;

function countHreflang(html: string): number {
  return [...html.matchAll(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhreflang=/gi)].length;
}

function countAhrefs(html: string): number {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']https:\/\/analytics\.ahrefs\.com\/analytics\.js["'][^>]*>/gi)]
    .length;
}

describe("Worker ASSETS passthrough (www EN static utilities)", () => {
  for (const page of UTILITIES) {
    describe(page.slug, () => {
      it("serves staged static from ASSETS (never Blogger)", async () => {
        const dir = getStagedStaticSite();
        const assetBody = readFileSync(join(dir, "p", `${page.slug}.html`), "utf8");

        expect(assetBody).toMatch(/rel="canonical"/);
        expect(assetBody).toContain(`<h1>${page.h1}</h1>`);
        expect(assetBody).toMatch(/name="robots" content="index,follow"/);
        expect(assetBody).not.toContain("cdn-cgi/l/email-protection");
        expect(countHreflang(assetBody)).toBe(39);
        expect(countAhrefs(assetBody)).toBe(1);

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

        const res = await worker.fetch(new Request(page.canon), env);
        expect(res.status).toBe(200);
        expect(seen).toEqual([`/p/${page.slug}.html`]);
        expect(res.headers.get("strict-transport-security")).toMatch(/max-age=31536000/);
        expect(res.headers.get("cache-control") ?? "").not.toMatch(/no-transform/i);

        const html = await res.text();
        expect(html).toBe(assetBody);
        expect([...html.matchAll(/<h1\b/gi)].length).toBe(1);
        expect(html).toMatch(new RegExp(`rel="canonical" href="${page.canon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
        expect(html).toMatch(/hreflang="x-default"/);
        expect(html).toMatch(/hreflang="fr"/);
        expect(countHreflang(html)).toBe(39);
        expect(countAhrefs(html)).toBe(1);

        const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
        expect(jsonLd.length).toBeGreaterThanOrEqual(1);
        const parsed = JSON.parse(jsonLd[0]![1]!);
        expect(parsed["@context"]).toBe("https://schema.org");
        expect(parsed["@graph"]?.[0]?.["@type"]).toBe("WebPage");
        expect(parsed["@graph"]?.[0]?.mainEntityOfPage).toBe(page.canon);
      });

      it("301-canonicalizes query variants", async () => {
        const env = {
          ASSETS: {
            fetch() {
              throw new Error(`ASSETS must not run before ${page.slug} query canonicalize`);
            },
          },
        };
        for (const q of ["?m=1", "?m=0", "?foo=1"]) {
          const res = await worker.fetch(new Request(`${page.canon}${q}`), env);
          expect(res.status).toBe(301);
          expect(res.headers.get("location")).toBe(page.canon);
        }
      });

      it("does not intercept localized utility page", async () => {
        const dir = getStagedStaticSite();
        const localizedBody = readFileSync(join(dir, page.localePath), "utf8");
        const seen: string[] = [];
        const env = {
          ASSETS: {
            fetch(req: Request) {
              seen.push(new URL(req.url).pathname);
              return new Response(localizedBody, { status: 200 });
            },
          },
        };

        const res = await worker.fetch(new Request(page.localeHost), env);
        expect(res.status).toBe(200);
        expect(seen).toEqual([`/${page.localePath}`]);
        expect(await res.text()).toBe(localizedBody);
      });
    });
  }

  it("withSecurityHeaders does not add no-transform", () => {
    const res = withSecurityHeaders(
      new Response("ok", {
        status: 200,
        headers: { "cache-control": "public, max-age=0, must-revalidate" },
      }),
    );
    expect(res.headers.get("cache-control")).not.toMatch(/no-transform/i);
    expect(res.headers.get("strict-transport-security")).toMatch(/max-age=31536000/);
  });

  it("does not change utility translation readiness (888 matrix, 37 locales each)", () => {
    const manifest = scanPublishability();
    expect(manifest.counts.ready).toBe(888);
    expect(manifest.counts.stale).toBe(0);
    expect(manifest.counts.missing).toBe(0);
    expect(manifest.counts.failed).toBe(0);

    for (const page of UTILITIES) {
      const entry = manifest.contents[page.manifestKey];
      expect(entry).toBeDefined();
      expect(Object.values(entry!.locales).filter((l) => l.status === "ready").length).toBe(37);
    }
  });
});
