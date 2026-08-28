import { beforeAll, describe, expect, it } from "vitest";
import worker from "../../workers/11tik-edge.js";
import { loadAhrefsCsv } from "./ahrefs-csv-fixture.mjs";

const FILE30_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-index_2026-08-27_22-21-04.csv");
const FILE29_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-2xx_2026-08-27_22-20-51.csv");
const FILE25_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-redirect_2026-08-27_22-20-58.csv");

function rowKey(row: Record<string, string>) {
  return `${row["Source URL"]}|${row["Target URL"]}|${row["Link type"]}`;
}

function pairKey(row: Record<string, string>) {
  return `${row["Source URL"]}|${row["Target URL"]}`;
}

describe.skipIf(!FILE30_ROWS || !FILE29_ROWS || !FILE25_ROWS)(
  "Ahrefs links to indexable targets (File 30)",
  () => {
    let rows: Record<string, string>[];
    let rows2xx: Record<string, string>[];
    let redirectRows: Record<string, string>[];
    let KEYS_29: Set<string>;
    let KEYS_25: Set<string>;
    let ROWS_302: Record<string, string>[];
    let ROWS_200: Record<string, string>[];
    let NON_CANON_TARGETS: Record<string, string>[];

    beforeAll(() => {
      rows = FILE30_ROWS!;
      rows2xx = FILE29_ROWS!;
      redirectRows = FILE25_ROWS!;
      KEYS_29 = new Set(rows2xx.map(rowKey));
      KEYS_25 = new Set(redirectRows.map(pairKey));
      ROWS_302 = rows.filter((r) => r["Target HTTP status code"] === "302");
      ROWS_200 = rows.filter((r) => r["Target HTTP status code"] === "200");
      NON_CANON_TARGETS = rows.filter((r) => r["Is target canonical"] === "false");
    });

    it("is an inventory export: union of File 29 (2xx) and File 25 (redirect) rows", () => {
      expect(rows.length).toBe(675);
      expect(rows2xx.length).toBe(624);
      expect(redirectRows.length).toBe(51);
      expect(rows.length).toBe(rows2xx.length + redirectRows.length);

      const onlyIn30 = rows.filter((r) => !KEYS_29.has(rowKey(r)));
      expect(onlyIn30.length).toBe(51);
      expect(onlyIn30.every((r) => r["Target HTTP status code"] === "302")).toBe(true);
      expect(onlyIn30.every((r) => KEYS_25.has(pairKey(r)))).toBe(true);
    });

    it("marks every target as indexable (no noindex) with expected status split", () => {
      for (const row of rows) {
        expect(row["Is target noindex"]).toBe("false");
        expect(row["Target URL"]).toContain("11tik.com");
      }
      expect(ROWS_200.length).toBe(624);
      expect(ROWS_302.length).toBe(51);
    });

    it("non-canonical targets are crawl artifacts (copyright + ?m=1 redirects)", () => {
      expect(NON_CANON_TARGETS.length).toBe(15);
      for (const row of NON_CANON_TARGETS) {
        const target = row["Target URL"];
        const isCopyright = target === "https://www.11tik.com/copyright";
        const isMobileRedirect =
          row["Link type"] === "Redirect" && target.includes("&m=1");
        expect(isCopyright || isMobileRedirect, target).toBe(true);
      }
    });

    it("Worker serves 200 for File 25 homepage query targets (File 25 fix, not redirect)", async () => {
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
  },
);
