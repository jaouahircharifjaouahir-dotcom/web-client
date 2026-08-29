import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import worker, { localeHomeIndexAssetPath } from "../../workers/11tik-edge.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

const BRAND_ARIA = "11tik — YouTube Thumbnail Extractor home";

const LOCALE_CASES = [
  { code: "fr", host: "fr.11tik.com", h1: "Extracteur de miniatures YouTube" },
  { code: "ar", host: "ar.11tik.com", h1: "مستخرج صور YouTube المصغرة" },
  { code: "es", host: "es.11tik.com", h1: "Extractor de miniaturas de YouTube" },
  { code: "de", host: "de.11tik.com", h1: "YouTube-Thumbnail-Extraktor" },
] as const;

function countHreflang(html: string): number {
  return [...html.matchAll(/<link\b[^>]*\brel=["']alternate["'][^>]*\bhreflang=/gi)].length;
}

function brandHref(html: string): string {
  return /class="yte-brand" href="([^"]+)"/.exec(html)?.[1] || "";
}

function stagedLocaleHomeBody(code: string): string {
  return readFileSync(join(getStagedStaticSite(), "l", code, "index.html"), "utf8");
}

function assetsEnv(onFetch: (pathname: string) => Response | Promise<Response>) {
  const seen: string[] = [];
  return {
    seen,
    env: {
      ASSETS: {
        fetch(req: Request) {
          seen.push(new URL(req.url).pathname);
          return onFetch(new URL(req.url).pathname);
        },
      },
    },
  };
}

describe("locale home routing", () => {
  it("localeHomeIndexAssetPath maps directory URLs only", () => {
    expect(localeHomeIndexAssetPath("/l/fr/")).toBe("/l/fr/index.html");
    expect(localeHomeIndexAssetPath("/l/fr")).toBe("/l/fr/index.html");
    expect(localeHomeIndexAssetPath("/l/ar/")).toBe("/l/ar/index.html");
    expect(localeHomeIndexAssetPath("/l/fr/2026/08/x.html")).toBe("");
    expect(localeHomeIndexAssetPath("/l/fr/p/about.html")).toBe("");
    expect(localeHomeIndexAssetPath("/thumb/abc")).toBe("");
    expect(localeHomeIndexAssetPath("/")).toBe("");
  });

  for (const { code, host, h1 } of LOCALE_CASES) {
    it(`${code} /l/${code}/ serves localized home (not English SPA fallback)`, async () => {
      const body = stagedLocaleHomeBody(code);
      const homeUrl = `https://${host}/l/${code}/`;
      const { env, seen } = assetsEnv((pathname) => {
        if (pathname === `/l/${code}/index.html`) {
          return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
        }
        return new Response("not found", { status: 404 });
      });

      const res = await worker.fetch(new Request(homeUrl), env);
      expect(res.status).toBe(200);
      expect(seen).toEqual([`/l/${code}/index.html`]);

      const html = await res.text();
      expect(html).toBe(body);
      expect(html).toContain(`data-yte-locale="${code}"`);
      expect(html).not.toContain('data-yte-locale="en"');
      expect(brandHref(html)).toBe(homeUrl);
      expect(html).toContain(`<h1>${h1}</h1>`);
      expect(html).toMatch(new RegExp(`rel="canonical" href="${homeUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
      expect(countHreflang(html)).toBeGreaterThanOrEqual(39);
      expect(html).toContain('hreflang="x-default"');
      expect(html).toContain(`hreflang="${code}"`);
      expect(html).toContain(`hreflang="en"`);
      expect(html).toContain(`aria-label="${BRAND_ARIA}"`);
      expect(html).toMatch(/<span class="yte-mark"[^>]*aria-hidden="true">11<\/span>\s*\n?\s*11tik/);
      expect(html).not.toMatch(/<span>\s*11tik\s*<\/span>/);
    });
  }

  it("www /l/fr/ uses same internal index asset resolution", async () => {
    const body = stagedLocaleHomeBody("fr");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/l/fr/index.html"
        ? new Response(body, { status: 200 })
        : new Response("missing", { status: 404 }),
    );

    const res = await worker.fetch(new Request("https://www.11tik.com/l/fr/"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/l/fr/index.html"]);
    expect(await res.text()).toBe(body);
  });

  it("/l/{locale}/index.html remains a direct ASSETS path", async () => {
    const body = stagedLocaleHomeBody("fr");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/l/fr/index.html" ? new Response(body, { status: 200 }) : new Response("x", { status: 404 }),
    );

    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/index.html"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/l/fr/index.html"]);
    expect(await res.text()).toBe(body);
  });

  it("/l/fr/?posts=1 patches query shell without changing canonical home asset", async () => {
    const body = stagedLocaleHomeBody("fr");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/l/fr/index.html" ? new Response(body, { status: 200 }) : new Response("x", { status: 404 }),
    );

    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/?posts=1"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/l/fr/index.html"]);
    const html = await res.text();
    expect(html).toContain("YouTube thumbnail guides");
    expect(html).not.toMatch(/hreflang=/i);
  });

  it("/thumb/... still passes through to ASSETS unchanged", async () => {
    const thumbBody = "<!doctype html><html><body>thumb spa</body></html>";
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/thumb/dQw4w9WgXcQ" ? new Response(thumbBody, { status: 200 }) : new Response("x", { status: 404 }),
    );

    const res = await worker.fetch(new Request("https://www.11tik.com/thumb/dQw4w9WgXcQ"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/thumb/dQw4w9WgXcQ"]);
    expect(await res.text()).toBe(thumbBody);
  });

  it("English / homepage routing unchanged", async () => {
    const enHome = readFileSync(join(getStagedStaticSite(), "index.html"), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/" ? new Response(enHome, { status: 200 }) : new Response("x", { status: 404 }),
    );

    const res = await worker.fetch(new Request("https://www.11tik.com/"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/"]);
    const html = await res.text();
    expect(html).toContain('data-yte-locale="en"');
    expect(brandHref(html)).toBe("https://www.11tik.com/");
  });

  it("translation matrix unchanged (888 ready)", () => {
    const manifest = scanPublishability();
    expect(manifest.counts.ready).toBe(888);
    expect(manifest.counts.stale).toBe(0);
    expect(manifest.counts.missing).toBe(0);
    expect(manifest.counts.failed).toBe(0);
  });
});
