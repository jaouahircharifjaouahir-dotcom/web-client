import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import { loadAhrefsCsv } from "./ahrefs-csv-fixture.mjs";

const FILE32_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-canonical_2026-08-27_22-21-14.csv");
const FILE30_INDEX_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-index_2026-08-27_22-21-04.csv");

function rowKey(row: Record<string, string>) {
  return `${row["Source URL"]}|${row["Target URL"]}|${row["Link type"]}`;
}

function stagedSourcePath(sourceUrl: string, staged: string) {
  const u = new URL(sourceUrl);
  if (u.search) return null;
  if (u.pathname === "/") return join(staged, "index.html");
  if (u.pathname === "/copyright") return join(staged, "copyright", "index.html");
  const rel = u.pathname.replace(/^\//, "");
  if (rel.endsWith(".html")) return join(staged, rel);
  return join(staged, rel, "index.html");
}

function canonicalHref(html: string) {
  return /rel=["']canonical["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(
    html,
  )?.[1] ?? /href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(html)?.[1];
}

describe.skipIf(!FILE32_ROWS || !FILE30_INDEX_ROWS)("Ahrefs canonical links (File 32)", () => {
  let rows: Record<string, string>[];
  let FILE30_CANONICAL: Record<string, string>[];
  let SELF_CANONICAL: Record<string, string>[];
  let NON_CANON_SOURCES: Record<string, string>[];
  const HOMEPAGE = "https://www.11tik.com/";

  beforeAll(() => {
    rows = FILE32_ROWS!;
    FILE30_CANONICAL = FILE30_INDEX_ROWS!.filter((r) => r["Link type"] === "Canonical");
    SELF_CANONICAL = rows.filter((r) => r["Is source canonical"] === "true");
    NON_CANON_SOURCES = rows.filter((r) => r["Is source canonical"] === "false");
  });

  it("is an inventory export: 39 Canonical link rows matching File 30 exactly", () => {
    expect(rows.length).toBe(39);
    expect(FILE30_CANONICAL.length).toBe(39);
    const keys32 = rows.map(rowKey);
    const keys30 = FILE30_CANONICAL.map(rowKey);
    expect(keys32).toEqual(keys30);
    for (const row of rows) {
      expect(row["Link type"]).toBe("Canonical");
      expect(row["Is nofollow"]).toBe("false");
      expect(row["Target HTTP status code"]).toBe("200");
      expect(row["Is target canonical"]).toBe("true");
      expect(row["Is target noindex"]).toBe("false");
    }
  });

  it("splits into self-referencing canonicals and non-canonical crawl consolidations", () => {
    expect(SELF_CANONICAL.length).toBe(25);
    expect(NON_CANON_SOURCES.length).toBe(14);
    for (const row of SELF_CANONICAL) {
      expect(row["Source URL"]).toBe(row["Target URL"]);
      expect(row["Is link self-referencing"]).toBe("true");
    }
    for (const row of NON_CANON_SOURCES) {
      expect(row["Target URL"]).toBe(HOMEPAGE);
      expect(row["Is link self-referencing"]).toBe("false");
      expect(
        row["Source URL"].includes("&m=1") || row["Source URL"].endsWith("/copyright"),
      ).toBe(true);
    }
  });

  it("staged static HTML emits rel=canonical on every canonical-source CSV row", () => {
    const staged = getStagedStaticSite();
      for (const row of SELF_CANONICAL) {
        const file = stagedSourcePath(row["Source URL"], staged);
        expect(file, row["Source URL"]).toBeTruthy();
        expect(existsSync(file!), row["Source URL"]).toBe(true);
        const html = readFileSync(file!, "utf8");
        const href = canonicalHref(html);
        expect(href, row["Source URL"]).toBe(row["Target URL"]);
      }
      const copyright = readFileSync(join(staged, "copyright", "index.html"), "utf8");
      expect(canonicalHref(copyright)).toBe("https://www.11tik.com/copyright");
  });

  it("copyright canonical was fixed in File 24 (crawl row pointed to /, staged uses /copyright)", () => {
    const crawlRow = NON_CANON_SOURCES.find((r) => r["Source URL"].endsWith("/copyright"));
    expect(crawlRow?.["Target URL"]).toBe(HOMEPAGE);
  });
});
