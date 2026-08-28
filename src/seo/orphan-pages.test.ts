import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

/** Ahrefs File 23 — href inlinks must exist on www English static HTML (not sitemap/hreflang). */
const ORPHAN_ARTICLE_TARGETS = [
  "https://www.11tik.com/2026/08/11tik-share-links-thumb-vs-youtube.html",
  "https://www.11tik.com/2026/08/youtube-live-premiere-thumbnail-download.html",
] as const;

const INTENTIONALLY_ISOLATED = "https://www.11tik.com/p/keyword-tools.html";

function walkHtml(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(abs, acc);
    else if (entry.name.endsWith(".html")) acc.push(abs);
  }
  return acc;
}

function isSelfRef(sourceRel: string, targetPath: string): boolean {
  const normalized = sourceRel.replace(/\\/g, "/");
  return normalized.endsWith(targetPath.slice(1));
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
    if (isSelfRef(rel, targetPath)) continue;
    const html = readFileSync(file, "utf8");
    if (htmlLinksToTarget(html, targetUrl)) refs.push(rel);
  }
  return refs;
}

describe("Ahrefs orphan pages (File 23)", () => {
  it("article canonicals have at least one non-self href inlink in staged static HTML", () => {
    const dir = getStagedStaticSite();
      for (const url of ORPHAN_ARTICLE_TARGETS) {
        const refs = externalInlinkSources(dir, url);
        expect(refs.length, `${url} inlinks`).toBeGreaterThan(0);
      }
  });

  it("keyword-tools stays intentionally isolated (no static href inlinks)", () => {
    const dir = getStagedStaticSite();
      const refs = externalInlinkSources(dir, INTENTIONALLY_ISOLATED);
      expect(refs).toEqual([]);
      expect(existsSync(join(dir, "p", "keyword-tools.html"))).toBe(true);
  });
});
