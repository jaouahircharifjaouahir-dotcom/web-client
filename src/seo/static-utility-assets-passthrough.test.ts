import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import worker, { withSecurityHeaders } from "../../workers/11tik-edge.js";

const LOCALIZED_UTILITIES = [
  {
    slug: "about",
    localePath: "l/ar/p/about.html",
    localeHost: "https://ar.11tik.com/l/ar/p/about.html",
    manifestKey: "about" as const,
  },
  {
    slug: "privacy",
    localePath: "l/fr/p/privacy.html",
    localeHost: "https://fr.11tik.com/l/fr/p/privacy.html",
    manifestKey: "privacy" as const,
  },
  {
    slug: "terms-of-use",
    localePath: "l/de/p/terms-of-use.html",
    localeHost: "https://de.11tik.com/l/de/p/terms-of-use.html",
    manifestKey: "terms-of-use" as const,
  },
  {
    slug: "keyword-tools",
    localePath: "l/fr/p/keyword-tools.html",
    localeHost: "https://fr.11tik.com/l/fr/p/keyword-tools.html",
    manifestKey: "keyword-tools" as const,
  },
] as const;

describe("Worker ASSETS passthrough (localized /l/*/p/* utilities)", () => {
  for (const page of LOCALIZED_UTILITIES) {
    it(`does not intercept ${page.localeHost}`, async () => {
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

  it("www EN /p/* uses negative run_worker_first (see p-direct-assets.test.ts)", () => {
    const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));
    expect(wrangler.assets.run_worker_first).toContain("/p/*");
    expect(wrangler.assets.run_worker_first).toContain("!/p/about.html");
  });

  it("does not change utility translation readiness (888 matrix, 37 locales each)", () => {
    const manifest = scanPublishability();
    expect(manifest.counts.ready).toBe(888);
    expect(manifest.counts.stale).toBe(0);
    expect(manifest.counts.missing).toBe(0);
    expect(manifest.counts.failed).toBe(0);

    for (const page of LOCALIZED_UTILITIES) {
      const entry = manifest.contents[page.manifestKey];
      expect(entry).toBeDefined();
      expect(Object.values(entry!.locales).filter((l) => l.status === "ready").length).toBe(37);
    }
  });
});
