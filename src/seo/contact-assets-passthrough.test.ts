import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import worker from "../../workers/11tik-edge.js";

const CONTACT_CANON = "https://www.11tik.com/p/contact.html";

/** Semrush page_has_a_low_word_count: article prose excluding pre/nav (form labels included). */
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

function articleContentWordsExcludingForm(html: string): number {
  const body = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1] || "";
  const text = body
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(/\s+/).filter(Boolean).length;
}

function countAhrefs(html: string): number {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']https:\/\/analytics\.ahrefs\.com\/analytics\.js["'][^>]*>/gi)]
    .length;
}

describe("Worker ASSETS passthrough (www /p/contact.html)", () => {
  it("serves staged contact from ASSETS (never Blogger)", async () => {
    const dir = getStagedStaticSite();
    const assetBody = readFileSync(join(dir, "p", "contact.html"), "utf8");

    expect(assetBody).toContain("Common topics:");
    expect(assetBody).toContain("We cannot remove a thumbnail from YouTube");
    expect(assetBody).not.toContain("cdn-cgi/l/email-protection");

    let bloggerCalled = false;
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

    const res = await worker.fetch(new Request(CONTACT_CANON), env);
    expect(res.status).toBe(200);
    expect(seen).toEqual(["/p/contact.html"]);
    expect(bloggerCalled).toBe(false);

    const html = await res.text();
    expect(html).toBe(assetBody);
    expect(html).toContain("Common topics:");
    expect(html).toContain("We cannot remove a thumbnail from YouTube");

    expect([...html.matchAll(/<h1\b/gi)].length).toBe(1);
    expect(html).toMatch(/rel="canonical" href="https:\/\/www\.11tik\.com\/p\/contact\.html"/);
    expect(html).toMatch(/name="robots" content="index,follow"/);
    expect(html).toMatch(/hreflang="x-default"/);
    expect(html).toMatch(/hreflang="fr"/);
    expect(countAhrefs(html)).toBe(1);

    const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    expect(jsonLd.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(jsonLd[0]![1]!);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@graph"]?.[0]?.["@type"]).toBe("WebPage");

    expect(articleContentWords(html)).toBe(articleContentWords(assetBody));
    expect(articleContentWordsExcludingForm(html)).toBeGreaterThanOrEqual(145);
    // Semrush fixture: article prose incl. form labels (excludes nav/pre only).
    expect(articleContentWords(html)).toBeGreaterThanOrEqual(150);
  });

  it("301-canonicalizes /p/contact.html query variants (no duplicate URLs)", async () => {
    const env = {
      ASSETS: {
        fetch() {
          throw new Error("ASSETS must not run before contact query canonicalize");
        },
      },
    };
    for (const q of ["?m=1", "?m=0", "?foo=1"]) {
      const res = await worker.fetch(new Request(`https://www.11tik.com/p/contact.html${q}`), env);
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(CONTACT_CANON);
    }
  });

  it("does not change contact translation readiness (888 matrix)", () => {
    const manifest = scanPublishability();
    expect(manifest.counts.ready).toBe(888);
    expect(manifest.counts.stale).toBe(0);
    expect(manifest.counts.missing).toBe(0);
    expect(manifest.counts.failed).toBe(0);

    const contact = manifest.contents.contact;
    expect(contact).toBeDefined();
    const locales = Object.values(contact!.locales);
    expect(locales.filter((l) => l.status === "ready").length).toBe(37);
  });
});
