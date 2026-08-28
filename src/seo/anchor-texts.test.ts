import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";
import worker from "../../workers/11tik-edge.js";
import { loadAhrefsCsv } from "./ahrefs-csv-fixture.mjs";

const FILE33_ROWS = loadAhrefsCsv("11tik_27-aug-2026_anchor-texts_2026-08-27_22-20-24.csv");
const FILE31_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-follow_2026-08-27_22-21-09.csv");
const FILE30_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-index_2026-08-27_22-21-04.csv");
const FILE25_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-redirect_2026-08-27_22-20-58.csv");
const FILE28_HREF = loadAhrefsCsv("11tik_27-aug-2026_external-links_2026-08-27_22-20-45.csv");
const AHREFS_FIXTURES_OK = Boolean(
  FILE33_ROWS && FILE31_ROWS && FILE30_ROWS && FILE25_ROWS && FILE28_HREF,
);

function pairKey(row: Record<string, string>) {
  return `${row["Source URL"]}|${row["Target URL"]}`;
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

function decodeHtmlText(text: string) {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHref(href: string, base: string) {
  return new URL(href, base).href;
}

function anchorTextsForTarget(html: string, targetUrl: string, sourceUrl: string) {
  const target = normalizeHref(targetUrl, sourceUrl);
  const texts: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = normalizeHref(m[1], sourceUrl);
    if (href !== target && href.replace(/\/$/, "") !== target.replace(/\/$/, "")) continue;
    texts.push(decodeHtmlText(m[2].replace(/<[^>]+>/g, " ")));
  }
  return texts;
}

function anchorsMatch(found: string[], expected: string) {
  const want = decodeHtmlText(expected);
  return found.some((t) => t === want || t.toLowerCase() === want.toLowerCase());
}

const FILE28_HREF_ROWS = FILE28_HREF?.filter((r) => r["Link type"] === "Href link") ?? [];

const INDEX_HREF_KEYS = new Set(
  (FILE30_ROWS ?? [])
    .filter((r) => r["Link type"] === "Href link")
    .map(pairKey),
);
const KEYS_25 = new Set((FILE25_ROWS ?? []).map(pairKey));
const KEYS_28_HREF = new Set(FILE28_HREF_ROWS.map(pairKey));
const KEYS_31 = new Set((FILE31_ROWS ?? []).map(pairKey));

const ARTICLE_CANONICAL = (FILE33_ROWS ?? []).filter(
  (r) =>
    r["Is source canonical"] === "true" &&
    r["Source URL"].includes("/2026/") &&
    r["Target HTTP status code"] === "200" &&
    r["Target URL"].includes("11tik.com"),
);

describe.skipIf(!AHREFS_FIXTURES_OK)("Ahrefs anchor texts (File 33)", () => {
  it("is an inventory export: 420 follow href rows with Anchor column matching File 31 pairs", () => {
    expect(FILE33_ROWS.length).toBe(420);
    expect(FILE31_ROWS.length).toBe(420);
    const pairs33 = new Set(FILE33_ROWS.map(pairKey));
    expect(pairs33.size).toBe(420);
    expect([...pairs33].every((k) => KEYS_31.has(k))).toBe(true);
    for (const row of FILE33_ROWS) {
      expect(row["Link type"]).toBe("Href link");
      expect(row["Is nofollow"]).toBe("false");
      expect(row["Source HTTP status code"]).toBe("200");
      expect(row["Anchor"].trim().length).toBeGreaterThan(0);
    }
  });

  it("splits like File 31: File 30 internal overlap + editorial/locale extras", () => {
    const internalOverlap = FILE33_ROWS.filter((r) => INDEX_HREF_KEYS.has(pairKey(r)));
    const extras = FILE33_ROWS.filter((r) => !INDEX_HREF_KEYS.has(pairKey(r)));
    expect(internalOverlap.length).toBe(408);
    expect(extras.length).toBe(12);
    const google = extras.filter((r) => !r["Target URL"].includes("11tik.com"));
    const locale = extras.filter((r) => r["Target URL"].includes(".11tik.com/"));
    expect(google.length).toBe(10);
    expect(locale.length).toBe(2);
    expect(google.every((r) => KEYS_28_HREF.has(pairKey(r)))).toBe(true);
    expect(locale.every((r) => r["Source URL"].endsWith("/p/about.html"))).toBe(true);
  });

  it("302 and external rows match prior fixes (Files 25/28/31), not new issues", () => {
    const rows302 = FILE33_ROWS.filter((r) => r["Target HTTP status code"] === "302");
    expect(rows302.length).toBe(51);
    expect(rows302.every((r) => KEYS_25.has(pairKey(r)))).toBe(true);

    const external = FILE33_ROWS.filter((r) => r["Target HTTP status code"] === "");
    expect(external.length).toBe(12);
    for (const row of external) {
      expect(["Ignored by settings", "Out of scope"]).toContain(row["Target no-crawl reason"]);
    }

    const mobile = FILE33_ROWS.filter((r) => r["Source URL"].includes("&m=1"));
    expect(mobile.length).toBe(182);
    for (const row of mobile) {
      expect(row["Is source canonical"]).toBe("false");
    }
  });

  it("copyright crawl brand anchor 11 11tik is span concatenation (File 24 static differs from Blogger crawl)", () => {
    const crawlRow = FILE33_ROWS.find(
      (r) => r["Source URL"] === "https://www.11tik.com/copyright" && r["Target URL"].endsWith("/"),
    );
    expect(crawlRow?.["Anchor"]).toBe("11 11tik");
    expect(crawlRow?.["Is source canonical"]).toBe("false");

    const staged = getStagedStaticSite();
      const html = readFileSync(join(staged, "copyright", "index.html"), "utf8");
      const brand = anchorTextsForTarget(html, "https://www.11tik.com/", crawlRow!["Source URL"]);
      expect(brand).toContain("11 11tik");
  });

  it("staged article href anchors match CSV text (entity-decoded)", () => {
    const staged = getStagedStaticSite();
      expect(ARTICLE_CANONICAL.length).toBeGreaterThan(100);
      for (const row of ARTICLE_CANONICAL) {
        const file = stagedSourcePath(row["Source URL"], staged);
        expect(file, row["Source URL"]).toBeTruthy();
        expect(existsSync(file!), row["Source URL"]).toBe(true);
        const html = readFileSync(file!, "utf8");
        const texts = anchorTextsForTarget(html, row["Target URL"], row["Source URL"]);
        expect(
          anchorsMatch(texts, row["Anchor"]),
          `${row["Source URL"]} → ${row["Target URL"]}: ${row["Anchor"]} found [${texts.join(" | ")}]`,
        ).toBe(true);
      }
  });

  it("Worker serves 200 for File 25 homepage query targets (post-fix)", async () => {
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
    const targets = [...new Set(FILE25_ROWS.map((r) => r["Target URL"]))];
    for (const target of targets) {
      const res = await worker.fetch(new Request(target), env);
      expect(res.status, target).toBe(200);
      expect(res.headers.get("location"), target).toBeNull();
    }
  });
});
