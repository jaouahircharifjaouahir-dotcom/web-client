import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import worker from "../../workers/11tik-edge.js";
import { loadAhrefsCsv } from "./ahrefs-csv-fixture.mjs";

const FILE29_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-2xx_2026-08-27_22-20-51.csv");
const FILE25_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-redirect_2026-08-27_22-20-58.csv");

function stagedSourcePath(sourceUrl: string, staged: string) {
  const u = new URL(sourceUrl);
  if (u.search) return null;
  if (u.pathname === "/") return join(staged, "index.html");
  if (u.pathname === "/copyright") return join(staged, "copyright", "index.html");
  const rel = u.pathname.replace(/^\//, "");
  if (rel.endsWith(".html")) return join(staged, rel);
  if (rel.endsWith(".xml")) return join(staged, rel);
  return join(staged, rel, "index.html");
}

function htmlHasHref(html: string, targetUrl: string) {
  const pathOnly = new URL(targetUrl).pathname;
  return (
    html.includes(`href="${targetUrl}"`) ||
    html.includes(`href='${targetUrl}'`) ||
    html.includes(`href="${pathOnly}"`) ||
    html.includes(`href='${pathOnly}'`)
  );
}

describe.skipIf(!FILE29_ROWS || !FILE25_ROWS)("Ahrefs links to 2xx targets (File 29)", () => {
  let rows: Record<string, string>[];
  let redirectRows: Record<string, string>[];
  let REDIRECT_ROWS: Record<string, string>[];
  let HREF_ARTICLE_CANONICAL: Record<string, string>[];

  beforeAll(() => {
    rows = FILE29_ROWS!;
    redirectRows = FILE25_ROWS!;
    REDIRECT_ROWS = rows.filter((r) => r["Link type"] === "Redirect");
    HREF_ARTICLE_CANONICAL = rows.filter(
      (r) =>
        r["Link type"] === "Href link" &&
        r["Is source canonical"] === "true" &&
        r["Source URL"].includes("/2026/"),
    );
  });

  it("is an inventory export: every target returns HTTP 200", () => {
    expect(rows.length).toBe(624);
    for (const row of rows) {
      expect(row["Target HTTP status code"]).toBe("200");
      expect(row["Target URL"]).toContain("11tik.com");
    }
  });

  it("classifies all 624 rows into expected internal link buckets", () => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row["Link type"]] = (counts[row["Link type"]] || 0) + 1;
    }
    expect(counts["Href link"]).toBe(357);
    expect(counts.JavaScript).toBe(81);
    expect(counts["Sitemap URL"]).toBe(25);
    expect(counts.Hreflang).toBe(66);
    expect(counts.Image).toBe(42);
    expect(counts.Redirect).toBe(14);
    expect(counts.Canonical).toBe(39);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(624);
  });

  it("documents 14 redirect→2xx chains already covered by Files 24/25 (not duplicate issues)", () => {
    expect(REDIRECT_ROWS.length).toBe(14);
    const mobile = REDIRECT_ROWS.filter((r) => r["Target URL"].includes("&m=1"));
    expect(mobile.length).toBe(13);
    const httpWww = REDIRECT_ROWS.find((r) => r["Source URL"].startsWith("http://www.11tik.com/"));
    expect(httpWww?.["Source HTTP status code"]).toBe("301");
    expect(httpWww?.["Target URL"]).toBe("https://www.11tik.com/");

    const file25Targets = new Set(redirectRows.map((r) => r["Target URL"]));
    for (const row of mobile) {
      const bare = row["Source URL"];
      expect(file25Targets.has(bare), bare).toBe(true);
      expect(row["Source HTTP status code"]).toBe("302");
    }
  });

  it("Worker serves 200 for File 25 homepage query targets (post-fix, not redirect)", async () => {
    const env = {
      ASSETS: {
        fetch() {
          return new Response(
            '<!doctype html><html><head><title>Home</title></head><body><div id="yte-root"><h1>YouTube Thumbnail Extractor</h1></div></body></html>',
            { status: 200, headers: { "content-type": "text/html" } },
          );
        },
      },
    };
    const targets = [...new Set(redirectRows.map((r) => r["Target URL"]))];
    for (const target of targets) {
      const res = await worker.fetch(new Request(target), env);
      expect(res.status, target).toBe(200);
      expect(res.headers.get("location"), target).toBeNull();
    }
  });

  it("staged article href links from CSV exist in static HTML", () => {
    const staged = getStagedStaticSite();
      expect(HREF_ARTICLE_CANONICAL.length).toBeGreaterThan(100);
      for (const row of HREF_ARTICLE_CANONICAL) {
        const file = stagedSourcePath(row["Source URL"], staged);
        expect(file, row["Source URL"]).toBeTruthy();
        expect(existsSync(file!), row["Source URL"]).toBe(true);
        const html = readFileSync(file!, "utf8");
        expect(htmlHasHref(html, row["Target URL"]), `${row["Source URL"]} → ${row["Target URL"]}`).toBe(
          true,
        );
      }
  });
});
