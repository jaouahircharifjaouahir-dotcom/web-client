import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { crawlNavLinksForLocale } from "../../scripts/i18n/locale-crawl-nav.mjs";
import {
  patchHomepageShellHtml,
  resolveHomepageQueryShell,
  stripHeadJsonLd,
} from "../../workers/homepage-query-shell.mjs";
import worker, { withSecurityHeaders } from "../../workers/11tik-edge.js";
import { collectReadyLocaleLocs, scanPublishability } from "../../scripts/i18n/publish.mjs";

const SEMRUSH_ORPHAN_WWW = [
  "https://www.11tik.com/2026/08/youtube-live-premiere-thumbnail-download.html",
  "https://www.11tik.com/2026/08/youtube-thumbnail-not-appearing-private.html",
  "https://www.11tik.com/2026/08/11tik-share-links-thumb-vs-youtube.html",
];

const SEMRUSH_ONE_INLINK = [
  "https://www.11tik.com/2026/08/how-to-extract-thumbnails-from-youtube.html",
  "https://www.11tik.com/2026/08/how-to-save-youtube-thumbnail-on-iphone.html",
];

const SEMRUSH_ANCHOR_PAGES = [
  "https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html",
  "https://www.11tik.com/p/privacy.html",
];

function walkHtml(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(abs, acc);
    else if (entry.name.endsWith(".html")) acc.push(abs);
  }
  return acc;
}

function htmlLinksToTarget(html: string, targetUrl: string): boolean {
  const path = new URL(targetUrl).pathname;
  return (
    html.includes(`href="${targetUrl}"`) ||
    html.includes(`href='${targetUrl}'`) ||
    html.includes(`href="${path}"`) ||
    html.includes(`href='${path}'`)
  );
}

function externalInlinkSources(staged: string, targetUrl: string): string[] {
  const targetPath = new URL(targetUrl).pathname;
  const refs: string[] = [];
  for (const file of walkHtml(staged)) {
    const rel = file.replace(/\\/g, "/").replace(`${staged.replace(/\\/g, "/")}/`, "");
    if (rel.endsWith(targetPath.slice(1))) continue;
    const html = readFileSync(file, "utf8");
    if (htmlLinksToTarget(html, targetUrl)) refs.push(rel);
  }
  return refs;
}

function titleAndH1(html: string) {
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1] || "";
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, "") || "";
  return { title: title.trim(), h1: h1.trim() };
}

/** Semrush page_has_a_low_word_count: article prose excluding pre/nav blocks. */
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

describe("Semrush remediation (ranks #1–#15)", () => {
  it("Rank #1 follow-up: query shells strip hreflang and JSON-LD", () => {
    const base = `<!DOCTYPE html><html><head><title>T</title>
<link rel="canonical" href="https://www.11tik.com/"/>
<link rel="alternate" hreflang="en" href="https://www.11tik.com/"/>
<script type="application/ld+json">{"@type":["WebApplication","SoftwareApplication"]}</script>
</head><body><div id="yte-root"><h1>H</h1><p>I</p></div></body></html>`;
    const variant = resolveHomepageQueryShell(new URLSearchParams("bulk=1"));
    const out = patchHomepageShellHtml(base, variant!);
    expect(out).not.toMatch(/hreflang=/i);
    expect(out).not.toMatch(/application\/ld\+json/i);
    expect(stripHeadJsonLd(base)).not.toMatch(/application\/ld\+json/i);
  });

  it("Rank #2: ready locale sitemap URLs have crawlable inlinks from same host", () => {
    const staged = getStagedStaticSite();
      const locs = collectReadyLocaleLocs(scanPublishability()).slice(0, 12);
      expect(locs.length).toBeGreaterThan(5);
      for (const loc of locs) {
        expect(externalInlinkSources(staged, loc).length, `${loc} inlinks`).toBeGreaterThan(0);
      }
  }, 180_000);

  it("Rank #2 www orphans: homepage guides link to flagged articles", () => {
    const staged = getStagedStaticSite();
      const home = readFileSync(join(staged, "index.html"), "utf8");
      for (const url of SEMRUSH_ORPHAN_WWW) {
        expect(home, url).toMatch(new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
      }
      for (const url of SEMRUSH_ONE_INLINK) {
        expect(externalInlinkSources(staged, url).length, url).toBeGreaterThan(0);
      }
  });

  it("Rank #3: robots omits Content-Signal (Semrush malformed_robots fix)", () => {
    const staged = getStagedStaticSite();
      const robots = readFileSync(join(staged, "robots.txt"), "utf8");
      expect(robots).not.toContain("Content-Signal:");
      expect(robots).toMatch(/^User-agent: \*\r?\nAllow: \//m);
      expect(robots).toMatch(/^User-agent: Amazonbot\r?\nAllow: \//m);
      expect(robots).toMatch(/^User-agent: GPTBot\r?\nDisallow: \//m);
      expect(robots).toContain("Disallow: /search");
      expect(robots).toContain("Disallow: /feeds/");
      expect(robots).not.toMatch(/^Disallow: \/l\//m);
      expect(robots).toContain("Sitemap: https://www.11tik.com/sitemap.xml");
      expect(robots).not.toMatch(/^Host:/m);
  });

  it("Rank #4: homepage schema is WebApplication only (no SoftwareApplication)", () => {
    const staged = getStagedStaticSite();
      const home = readFileSync(join(staged, "index.html"), "utf8");
      expect(home).toContain('"@type":"WebApplication"');
      expect(home).not.toContain("SoftwareApplication");
      const copyright = readFileSync(join(staged, "copyright", "index.html"), "utf8");
      expect(copyright).not.toMatch(/application\/ld\+json/i);
  });

  it("Rank #6: iPhone article title differs from visible H1", () => {
    const staged = getStagedStaticSite();
      const html = readFileSync(
        join(staged, "2026/08/how-to-save-youtube-thumbnail-on-iphone.html"),
        "utf8",
      );
      const { title, h1 } = titleAndH1(html);
      expect(title.toLowerCase()).not.toBe(h1.toLowerCase());
      expect(title).toMatch(/11tik/i);
  }, 180_000);

  it("Rank #8 follow-up: embed utility page clears low-word-count floor", () => {
    const staged = getStagedStaticSite();
    const html = readFileSync(join(staged, "p/embed.html"), "utf8");
    expect(articleContentWords(html)).toBeGreaterThanOrEqual(150);
    expect(html).toContain("Copyright &amp; Usage");
    expect(html).toMatch(/rel="canonical" href="https:\/\/www\.11tik\.com\/p\/embed\.html"/);
  }, 180_000);

  it("Rank #7: homepage brand link has accessible name on static pages", () => {
    const staged = getStagedStaticSite();
      for (const url of SEMRUSH_ANCHOR_PAGES) {
        const rel = new URL(url).pathname.replace(/^\//, "");
        const html = readFileSync(join(staged, rel), "utf8");
        expect(html).toMatch(/class="yte-brand"[^>]*aria-label="11tik — YouTube Thumbnail Extractor home"/);
        expect(html).toMatch(/class="yte-brand"[^>]*>\s*<span class="yte-mark"[^>]*>11<\/span>\s*11tik\s*<\/a>/);
      }
  });

  it("Rank #9: Worker adds Strict-Transport-Security", async () => {
    const res = withSecurityHeaders(new Response("ok", { status: 200 }));
    expect(res.headers.get("strict-transport-security")).toMatch(/max-age=31536000/);
    const env = {
      ASSETS: {
        fetch() {
          return new Response("user-agent: *\n", { status: 200, headers: { "content-type": "text/plain" } });
        },
      },
    };
    const robots = await worker.fetch(new Request("https://www.11tik.com/robots.txt"), env);
    expect(robots.headers.get("strict-transport-security")).toMatch(/max-age=31536000/);
  });

  it("Rank #15: llms.txt is generated at site root", () => {
    const staged = getStagedStaticSite();
      expect(existsSync(join(staged, "llms.txt"))).toBe(true);
      const body = readFileSync(join(staged, "llms.txt"), "utf8");
      expect(body).toContain("11tik");
      expect(body).toContain("https://www.11tik.com/");
  });

  it("locale crawl nav includes ready French utility links", () => {
    const links = crawlNavLinksForLocale("fr");
    const hrefs = links.map((l) => l.href);
    expect(hrefs.some((h) => h.includes("fr.11tik.com/l/fr/p/about.html"))).toBe(true);
    expect(hrefs.some((h) => h.includes("fr.11tik.com/l/fr/2026/"))).toBe(true);
  });
});
