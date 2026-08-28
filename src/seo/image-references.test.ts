import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { loadAhrefsCsv } from "./ahrefs-csv-fixture.mjs";

const FILE27_ROWS = loadAhrefsCsv("11tik_27-aug-2026_image-references_2026-08-27_22-20-39.csv");
const FILE26_ROWS = loadAhrefsCsv("11tik_27-aug-2026_alt-texts_2026-08-27_22-20-33.csv");

function rowKey(row: Record<string, string>) {
  return `${row["Source URL"]}|${row["Target URL"]}`;
}

function stagedSourcePath(sourceUrl: string, staged: string) {
  const u = new URL(sourceUrl);
  if (u.search) return null;
  if (u.pathname === "/") return join(staged, "index.html");
  const rel = u.pathname.replace(/^\//, "");
  if (rel.endsWith(".html")) return join(staged, rel);
  return join(staged, rel, "index.html");
}

function imgTagsForTarget(html: string, targetUrl: string) {
  const leaf = targetUrl.split("/").pop() || "";
  return [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => tag.includes(leaf));
}

describe.skipIf(!FILE27_ROWS || !FILE26_ROWS)("Ahrefs image references (File 27)", () => {
  let rows: Record<string, string>[];
  let altRows: Record<string, string>[];
  let CANONICAL_ROWS: Record<string, string>[];

  beforeAll(() => {
    rows = FILE27_ROWS!;
    altRows = FILE26_ROWS!;
    CANONICAL_ROWS = rows.filter((r) => !r["Source URL"].includes("?"));
  });

  it("exports the same 42 image links as File 26 alt-texts", () => {
    expect(rows.length).toBe(42);
    const keys27 = rows.map(rowKey);
    const keys26 = altRows.map(rowKey);
    expect(keys27).toEqual(keys26);
  });

  it("crawl snapshot shows live image targets (HTTP 200, no crawl block)", () => {
    for (const row of rows) {
      expect(row["Link type"]).toBe("Image");
      expect(row["Source HTTP status code"]).toBe("200");
      expect(row["Target HTTP status code"]).toBe("200");
      expect(row["Target no-crawl reason"]).toBe("");
      expect(row.Anchor).toBe("");
    }
  });

  it("canonical CSV pages reference each flagged image with alt ≤100 after File 26", () => {
    const staged = getStagedStaticSite();
      for (const row of CANONICAL_ROWS) {
        const file = stagedSourcePath(row["Source URL"], staged);
        expect(file, row["Source URL"]).toBeTruthy();
        expect(existsSync(file!), row["Source URL"]).toBe(true);
        const html = readFileSync(file!, "utf8");
        const tags = imgTagsForTarget(html, row["Target URL"]);
        expect(tags.length, `${row["Source URL"]} → ${row["Target URL"]}`).toBeGreaterThan(0);
        for (const tag of tags) {
          const alt = /alt=["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
          expect(alt.trim().length, tag).toBeGreaterThan(0);
          expect(alt.length, `${row["Target URL"]}: ${alt}`).toBeLessThanOrEqual(100);
        }
      }
  });

  it("?m=1 homepage rows are non-canonical crawl artifacts (Files 24/26), not staged targets", () => {
    const mobile = rows.filter((r) => r["Source URL"].includes("&m=1"));
    expect(mobile.length).toBe(13);
    for (const row of mobile) {
      expect(row["Is source canonical"]).toBe("false");
    }
  });
});
