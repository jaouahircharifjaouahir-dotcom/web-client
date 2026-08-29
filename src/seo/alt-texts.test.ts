import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { ALT_TEXT_MAX, fitAlt, clampImgAltsInHtml } from "../../workers/html-meta.js";
import { HOMEPAGE_PREVIEW, ensureHomepagePreviewImg } from "../../workers/homepage-query-shell.mjs";
import { loadAhrefsCsv } from "./ahrefs-csv-fixture.mjs";

const FILE26_ROWS = loadAhrefsCsv("11tik_27-aug-2026_alt-texts_2026-08-27_22-20-33.csv");

function stagedSourcePath(sourceUrl: string, staged: string) {
  const u = new URL(sourceUrl);
  if (u.search) return null;
  if (u.pathname === "/") return join(staged, "index.html");
  const rel = u.pathname.replace(/^\//, "");
  if (rel.endsWith(".html")) return join(staged, rel);
  return join(staged, rel, "index.html");
}

function imgAltsForTarget(html: string, targetUrl: string) {
  const alts: string[] = [];
  const leaf = targetUrl.split("/").pop() || "";
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!tag.includes(leaf)) continue;
    const alt = /alt=["']([^"']*)["']/i.exec(tag)?.[1];
    if (alt !== undefined) alts.push(alt);
  }
  return alts;
}

describe("Ahrefs alt texts (File 26)", () => {
  it("fitAlt keeps descriptive text within Ahrefs max", () => {
    expect(ALT_TEXT_MAX).toBe(100);
    const long =
      "Three-stage lifecycle diagram showing a YouTube live or premiere cover image before go-live, during the live badge, and after archive as VOD";
    expect(long.length).toBeGreaterThan(100);
    const fitted = fitAlt(long);
    expect(fitted.length).toBeLessThanOrEqual(100);
    expect(fitted).toContain("YouTube live");
  });

  it("clampImgAltsInHtml trims img alt in article HTML", () => {
    const html =
      '<img alt="Four-step workflow showing copy a live URL, paste into 11tik, validate public CDN sizes, then download or copy the image URL" src="/x.png"/>';
    const out = clampImgAltsInHtml(html);
    const alt = /alt=["']([^"']*)["']/i.exec(out)?.[1] || "";
    expect(alt.length).toBeLessThanOrEqual(100);
  });

  it("ensureHomepagePreviewImg is a no-op (visible preview removed; og:image retained)", () => {
    const base = '<div id="yte-root"><h1>Home</h1></div>';
    expect(ensureHomepagePreviewImg(base)).toBe(base);
    expect(ensureHomepagePreviewImg(base)).not.toContain(HOMEPAGE_PREVIEW.src);
  });

  it.skipIf(!FILE26_ROWS)("canonical CSV pages have img alt ≤100 for each flagged image target", () => {
    const canonicalRows = FILE26_ROWS!.filter((r) => !r["Source URL"].includes("?"));
    const staged = getStagedStaticSite();
      for (const row of canonicalRows) {
        const file = stagedSourcePath(row["Source URL"], staged);
        expect(file, row["Source URL"]).toBeTruthy();
        expect(existsSync(file!), row["Source URL"]).toBe(true);
        const html = readFileSync(file!, "utf8");
        const alts = imgAltsForTarget(html, row["Target URL"]);
        expect(alts.length, `${row["Source URL"]} → ${row["Target URL"]}`).toBeGreaterThan(0);
        for (const alt of alts) {
          expect(alt.length, `${row["Target URL"]}: ${alt}`).toBeLessThanOrEqual(100);
          expect(alt.trim().length).toBeGreaterThan(0);
        }
      }
  });

  it.skipIf(!FILE26_ROWS)("?m=1 duplicate homepage rows are crawl artifacts (File 24), not canonical targets", () => {
    const mobile = FILE26_ROWS!.filter((r) => r["Source URL"].includes("&m=1"));
    expect(mobile.length).toBe(13);
    for (const row of mobile) {
      expect(row["Is source canonical"]).toBe("false");
    }
  });
});
