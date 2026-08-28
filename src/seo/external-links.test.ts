import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { AHREFS_ANALYTICS_SRC } from "../../scripts/i18n/ahrefs-analytics.mjs";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { loadAhrefsCsv } from "./ahrefs-csv-fixture.mjs";

const FILE28_ROWS = loadAhrefsCsv("11tik_27-aug-2026_external-links_2026-08-27_22-20-45.csv");

const AHREFS_TARGET = "https://analytics.ahrefs.com/analytics.js";
const GOOGLE_YT_HELP = "https://support.google.com/youtube/answer/72431";
const GOOGLE_YT_API = "https://developers.google.com/youtube/v3/docs/thumbnails";
const BLOGGER_DYN_CSS =
  "https://www.blogger.com/dyn-css/authorization.css?targetBlogID=4072124001762126765";

function stagedSourcePath(sourceUrl: string, staged: string) {
  const u = new URL(sourceUrl);
  if (u.search) return null;
  if (u.pathname === "/") return join(staged, "index.html");
  if (u.pathname === "/copyright") return join(staged, "copyright", "index.html");
  const rel = u.pathname.replace(/^\//, "");
  if (rel.endsWith(".html")) return join(staged, rel);
  return join(staged, rel, "index.html");
}

describe.skipIf(!FILE28_ROWS)("Ahrefs external links (File 28)", () => {
  let rows: Record<string, string>[];
  let canonicalRows: Record<string, string>[];
  let rowsForTarget: (targetPrefix: string) => Record<string, string>[];

  beforeAll(() => {
    rows = FILE28_ROWS!;
    canonicalRows = rows.filter((r) => !r["Source URL"].includes("?"));
    rowsForTarget = (targetPrefix: string) =>
      rows.filter((r) => r["Target URL"].startsWith(targetPrefix));
  });

  it("is an inventory export: external targets are not crawled by Ahrefs settings", () => {
    expect(rows.length).toBe(55);
    for (const row of rows) {
      expect(row["Source HTTP status code"]).toBe("200");
      expect(row["Target HTTP status code"]).toBe("");
      expect(row["Target no-crawl reason"]).toBe("Ignored by settings");
    }
  });

  it("classifies all 55 rows into four intentional or crawl-artifact buckets", () => {
    const ahrefs = rowsForTarget(AHREFS_TARGET);
    const googleHelp = rowsForTarget(GOOGLE_YT_HELP);
    const googleApi = rowsForTarget(GOOGLE_YT_API);
    const bloggerCss = rowsForTarget(BLOGGER_DYN_CSS);
    expect(ahrefs.length).toBe(39);
    expect(googleHelp.length).toBe(9);
    expect(googleApi.length).toBe(1);
    expect(bloggerCss.length).toBe(6);
    expect(ahrefs.length + googleHelp.length + googleApi.length + bloggerCss.length).toBe(55);
    for (const row of ahrefs) expect(row["Link type"]).toBe("JavaScript");
    for (const row of [...googleHelp, ...googleApi]) expect(row["Link type"]).toBe("Href link");
    for (const row of bloggerCss) expect(row["Link type"]).toBe("CSS");
  });

  it("staged canonical pages match live inventory: Ahrefs once, Google editorial links kept, no Blogger dyn-css", () => {
    const staged = getStagedStaticSite();

      for (const row of canonicalRows.filter((r) => r["Target URL"] === AHREFS_TARGET)) {
        const file = stagedSourcePath(row["Source URL"], staged);
        expect(file, row["Source URL"]).toBeTruthy();
        expect(existsSync(file!), row["Source URL"]).toBe(true);
        const html = readFileSync(file!, "utf8");
        expect(html, row["Source URL"]).toContain(AHREFS_ANALYTICS_SRC);
      }

      for (const row of canonicalRows.filter((r) =>
        r["Target URL"].startsWith("https://support.google.com/youtube"),
      )) {
        const file = stagedSourcePath(row["Source URL"], staged);
        expect(file, row["Source URL"]).toBeTruthy();
        const html = readFileSync(file!, "utf8");
        expect(html, row["Source URL"]).toContain(row["Target URL"]);
        if (row.Anchor) expect(html, row["Source URL"]).toContain(row.Anchor);
      }

      for (const row of canonicalRows.filter((r) => r["Target URL"].startsWith(BLOGGER_DYN_CSS))) {
        const file = stagedSourcePath(row["Source URL"], staged);
        expect(file, row["Source URL"]).toBeTruthy();
        const html = readFileSync(file!, "utf8");
        expect(html, `${row["Source URL"]} should not leak Blogger dyn-css`).not.toMatch(
          /blogger\.com\/dyn-css/,
        );
      }
  });

  it("?m=1 and /copyright rows are non-canonical crawl duplicates (Files 24/25)", () => {
    const nonCanonical = rows.filter((r) => r["Is source canonical"] === "false");
    expect(nonCanonical.length).toBe(14);
    for (const row of nonCanonical) {
      expect(
        row["Source URL"].includes("&m=1") || row["Source URL"].endsWith("/copyright"),
      ).toBe(true);
    }
  });
});
