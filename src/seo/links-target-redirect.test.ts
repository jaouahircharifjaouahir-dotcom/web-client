import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadAhrefsCsv } from "./ahrefs-csv-fixture.mjs";
import worker from "../../workers/11tik-edge.js";

const ROOT = process.cwd();
const FILE25_ROWS = loadAhrefsCsv("11tik_27-aug-2026_links-target-redirect_2026-08-27_22-20-58.csv");

function stagedSourcePath(sourceUrl: string) {
  const u = new URL(sourceUrl);
  if (u.pathname === "/") return join(ROOT, "dist-assets/index.html");
  const rel = u.pathname.replace(/^\//, "");
  if (rel.endsWith(".html")) return join(ROOT, "dist-assets", rel);
  return join(ROOT, "dist-assets", rel, "index.html");
}

describe.skipIf(!FILE25_ROWS)("Ahrefs links to redirect (File 25)", () => {
  let rows: Record<string, string>[];
  let targets: string[];

  beforeAll(() => {
    rows = FILE25_ROWS!;
    targets = [...new Set(rows.map((r) => r["Target URL"]))];
  });

  it("keeps homepage Worker-first so query views are not Blogger 302s", () => {
    const wrangler = JSON.parse(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"));
    expect(wrangler.assets.run_worker_first).toContain("/");
  });

  it("returns 200 (not redirect) for every CSV target URL via Worker", async () => {
    const env = {
      ASSETS: {
        fetch() {
          return new Response("<!doctype html><html><head><title>Home</title></head><body><div id=\"yte-root\"><h1>YouTube Thumbnail Extractor</h1><p>Generic.</p></div></body></html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        },
      },
    };
    for (const target of targets) {
      const res = await worker.fetch(new Request(target), env);
      expect(res.status, target).toBe(200);
      expect(res.headers.get("location"), target).toBeNull();
    }
  });

  it("staged HTML still emits every CSV href on its source page", () => {
    for (const row of rows) {
      const file = stagedSourcePath(row["Source URL"]);
      expect(existsSync(file), row["Source URL"]).toBe(true);
      const html = readFileSync(file, "utf8");
      expect(html, `${row["Source URL"]} → ${row["Target URL"]}`).toContain(
        `href="${row["Target URL"]}"`,
      );
    }
  });
});
