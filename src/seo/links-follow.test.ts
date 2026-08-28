import { beforeAll, describe, expect, it } from "vitest";
import worker from "../../workers/11tik-edge.js";
import { loadAhrefsCsv } from "./ahrefs-csv-fixture.mjs";

const FILE31_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-follow_2026-08-27_22-21-09.csv");
const FILE30_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-index_2026-08-27_22-21-04.csv");
const FILE25_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-redirect_2026-08-27_22-20-58.csv");
const FILE28_ROWS = loadAhrefsCsv("11tik_27-aug-2026_external-links_2026-08-27_22-20-45.csv");

function pairKey(row: Record<string, string>) {
  return `${row["Source URL"]}|${row["Target URL"]}`;
}

describe.skipIf(!FILE31_ROWS || !FILE30_ROWS || !FILE25_ROWS || !FILE28_ROWS)(
  "Ahrefs follow links (File 31)",
  () => {
    let rows: Record<string, string>[];
    let indexRows: Record<string, string>[];
    let redirectRows: Record<string, string>[];
    let FILE28_HREF: Record<string, string>[];
    let INDEX_HREF_KEYS: Set<string>;
    let KEYS_25: Set<string>;
    let KEYS_28_HREF: Set<string>;

    beforeAll(() => {
      rows = FILE31_ROWS!;
      indexRows = FILE30_ROWS!;
      redirectRows = FILE25_ROWS!;
      FILE28_HREF = FILE28_ROWS!.filter((r) => r["Link type"] === "Href link");
      INDEX_HREF_KEYS = new Set(
        indexRows.filter((r) => r["Link type"] === "Href link").map(pairKey),
      );
      KEYS_25 = new Set(redirectRows.map(pairKey));
      KEYS_28_HREF = new Set(FILE28_HREF.map(pairKey));
    });

    it("is an inventory export: all 420 rows are follow href links", () => {
      expect(rows.length).toBe(420);
      for (const row of rows) {
        expect(row["Link type"]).toBe("Href link");
        expect(row["Is nofollow"]).toBe("false");
        expect(row["Source HTTP status code"]).toBe("200");
      }
    });

    it("splits into File 30 internal href overlap + editorial/locale extras", () => {
      const internalOverlap = rows.filter((r) => INDEX_HREF_KEYS.has(pairKey(r)));
      const extras = rows.filter((r) => !INDEX_HREF_KEYS.has(pairKey(r)));
      expect(internalOverlap.length).toBe(408);
      expect(extras.length).toBe(12);

      const google = extras.filter((r) => !r["Target URL"].includes("11tik.com"));
      const locale = extras.filter((r) => r["Target URL"].includes(".11tik.com/"));
      expect(google.length).toBe(10);
      expect(locale.length).toBe(2);
      expect(google.every((r) => KEYS_28_HREF.has(pairKey(r)))).toBe(true);
      expect(locale.every((r) => r["Source URL"].endsWith("/p/about.html"))).toBe(true);
    });

    it("302 targets are exactly File 25 rows (already fixed via Worker-first /)", () => {
      const rows302 = rows.filter((r) => r["Target HTTP status code"] === "302");
      expect(rows302.length).toBe(51);
      expect(rows302.every((r) => KEYS_25.has(pairKey(r)))).toBe(true);

      const rows200 = rows.filter((r) => r["Target HTTP status code"] === "200");
      expect(rows200.length).toBe(357);

      const external = rows.filter((r) => r["Target HTTP status code"] === "");
      expect(external.length).toBe(12);
      for (const row of external) {
        expect(["Ignored by settings", "Out of scope"]).toContain(row["Target no-crawl reason"]);
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
      const targets = [...new Set(redirectRows.map((r) => r["Target URL"]))];
      for (const target of targets) {
        const res = await worker.fetch(new Request(target), env);
        expect(res.status, target).toBe(200);
        expect(res.headers.get("location"), target).toBeNull();
      }
    });
  },
);
