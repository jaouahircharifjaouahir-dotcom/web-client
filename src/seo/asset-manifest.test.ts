import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  CRITICAL_REL_PATHS,
  buildAssetManifest,
  walkFiles,
} from "../../scripts/asset-manifest.mjs";

const FIXTURE = join(process.cwd(), "tmp", "asset-manifest-fixture");

function write(rel, content) {
  const abs = join(FIXTURE, rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content);
}

describe("asset manifest", () => {
  beforeEach(() => {
    rmSync(FIXTURE, { recursive: true, force: true });
    mkdirSync(FIXTURE, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURE, { recursive: true, force: true });
  });

  it("walkFiles counts nested files", () => {
    write("a.txt", "a");
    write("sub/b.txt", "bb");
    expect(walkFiles(FIXTURE)).toHaveLength(2);
  });

  it("buildAssetManifest reports critical missing files", () => {
    write("index.html", "<html></html>");
    const manifest = buildAssetManifest(FIXTURE, { gitSha: "test" });
    expect(manifest.criticalMissing.length).toBeGreaterThan(0);
    expect(manifest.criticalMissing).toContain("robots.txt");
  });

  it("buildAssetManifest hashes critical files when present", () => {
    for (const rel of CRITICAL_REL_PATHS) {
      write(rel, rel.endsWith(".xml") ? "<urlset></urlset>" : "x");
    }
    write(
      "sitemap.xml",
      `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.11tik.com/</loc></url></urlset>`,
    );
    write("web-client/app.js", "console.log(1)");
    const manifest = buildAssetManifest(FIXTURE, { gitSha: "test" });
    expect(manifest.criticalMissing).toEqual([]);
    expect(manifest.fileCount).toBeGreaterThan(0);
    expect(manifest.criticalFiles["index.html"].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("CRITICAL_REL_PATHS includes IndexNow key and locale samples", () => {
    expect(CRITICAL_REL_PATHS.some((p) => p.endsWith(".txt"))).toBe(true);
    expect(CRITICAL_REL_PATHS.some((p) => p.startsWith("l/fr/"))).toBe(true);
  });
});
