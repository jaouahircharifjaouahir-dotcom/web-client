import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import worker, { localeHomeIndexAssetPath } from "../../workers/11tik-edge.js";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

const BRAND_ARIA = "11tik — YouTube Thumbnail Extractor home";
const WRANGLER = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));

const LOCALE_CASES = [
  { code: "fr", host: "fr.11tik.com", h1: "Extracteur de miniatures YouTube", lang: "fr" },
  { code: "ar", host: "ar.11tik.com", h1: "مستخرج صور YouTube المصغرة", lang: "ar" },
  { code: "es", host: "es.11tik.com", h1: "Extractor de miniaturas de YouTube", lang: "es" },
  { code: "de", host: "de.11tik.com", h1: "YouTube-Thumbnail-Extraktor", lang: "de" },
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
  it("wrangler run_worker_first includes /l/* and /thumb/* (not global /*)", () => {
    expect(WRANGLER.assets.run_worker_first).toContain("/l/*");
    expect(WRANGLER.assets.run_worker_first).not.toContain("/*");
    expect(WRANGLER.assets.run_worker_first).toContain("/thumb/*");
    expect(WRANGLER.assets.not_found_handling).toBe("404");
  });

  it("production-like: Worker resolves /l/fr/ before Assets would SPA-fallback to English /", async () => {
    const frBody = stagedLocaleHomeBody("fr");
    const enSpaFallback = readFileSync(join(getStagedStaticSite(), "index.html"), "utf8");
    const { env, seen } = assetsEnv((pathname) => {
      // Simulates Assets SPA fallback when Worker-first was missing: directory URL → English /.
      if (pathname === "/l/fr/") {
        return new Response(enSpaFallback, { status: 200, headers: { "content-type": "text/html" } });
      }
      if (pathname === "/l/fr/index.html") {
        return new Response(frBody, { status: 200, headers: { "content-type": "text/html" } });
      }
      return new Response("not found", { status: 404 });
    });

    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/l/fr/index.html"]);
    expect(seen).not.toContain("/l/fr/");

    const html = await res.text();
    expect(html).toBe(frBody);
    expect(html).toContain('data-yte-locale="fr"');
    expect(html).not.toContain('data-yte-locale="en"');
    expect(html).not.toBe(enSpaFallback);
  });

  it("localeHomeIndexAssetPath maps directory URLs only", () => {
    expect(localeHomeIndexAssetPath("/l/fr/")).toBe("/l/fr/index.html");
    expect(localeHomeIndexAssetPath("/l/fr")).toBe("/l/fr/index.html");
    expect(localeHomeIndexAssetPath("/l/ar/")).toBe("/l/ar/index.html");
    expect(localeHomeIndexAssetPath("/l/fr/2026/08/x.html")).toBe("");
    expect(localeHomeIndexAssetPath("/l/fr/p/about.html")).toBe("");
    expect(localeHomeIndexAssetPath("/thumb/abc")).toBe("");
    expect(localeHomeIndexAssetPath("/")).toBe("");
  });

  for (const { code, host, h1, lang } of LOCALE_CASES) {
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
      expect(html).toMatch(new RegExp(`<html[^>]*\\blang="${lang}"`));
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

  it("/l/fr/?m=1 canonicalizes to clean locale home URL", async () => {
    const env = {
      ASSETS: {
        fetch() {
          throw new Error("ASSETS must not run before ?m=1 redirect");
        },
      },
    };
    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/?m=1"), env);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://fr.11tik.com/l/fr/");
  });

  it("/l/fr/?foo=1 serves localized home unchanged", async () => {
    const body = stagedLocaleHomeBody("fr");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/l/fr/index.html" ? new Response(body, { status: 200 }) : new Response("x", { status: 404 }),
    );
    const res = await worker.fetch(new Request("https://fr.11tik.com/l/fr/?foo=1"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/l/fr/index.html"]);
    expect(await res.text()).toBe(body);
  });

  it("localized article passthrough uses original ASSETS path", async () => {
    const articlePath = "/l/fr/2026/08/youtube-live-premiere-thumbnail-download.html";
    const body = readFileSync(join(getStagedStaticSite(), ...articlePath.split("/").filter(Boolean)), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === articlePath ? new Response(body, { status: 200 }) : new Response("x", { status: 404 }),
    );
    const res = await worker.fetch(new Request(`https://fr.11tik.com${articlePath}`), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual([articlePath]);
    expect(brandHref(await res.text())).toBe("https://fr.11tik.com/l/fr/");
  });

  it("localized utility passthrough uses original ASSETS path", async () => {
    const utilityPath = "/l/fr/p/about.html";
    const body = readFileSync(join(getStagedStaticSite(), ...utilityPath.split("/").filter(Boolean)), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === utilityPath ? new Response(body, { status: 200 }) : new Response("x", { status: 404 }),
    );
    const res = await worker.fetch(new Request(`https://fr.11tik.com${utilityPath}`), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual([utilityPath]);
  });

  it("sitemap has no /l/{locale}/index.html locale home URLs", () => {
    const sitemap = readFileSync(join(getStagedStaticSite(), "sitemap.xml"), "utf8");
    expect(sitemap).toContain("https://fr.11tik.com/l/fr/");
    expect(sitemap).not.toMatch(/<loc>https:\/\/[a-z]{2}\.11tik\.com\/l\/[a-z]{2}\/index\.html<\/loc>/);
    expect([...sitemap.matchAll(/<loc>/g)].length).toBe(1096);
  });

  it("/thumb/... serves explicit English SPA shell (Phase R2)", async () => {
    const enHome = readFileSync(join(getStagedStaticSite(), "index.html"), "utf8");
    const { env, seen } = assetsEnv((pathname) =>
      pathname === "/" ? new Response(enHome, { status: 200 }) : new Response("x", { status: 404 }),
    );

    const res = await worker.fetch(new Request("https://www.11tik.com/thumb/dQw4w9WgXcQ"), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/"]);
    expect(await res.text()).toBe(enHome);
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
