import { brotliCompressSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

const ROOT = process.cwd();
const STAGE = existsSync(join(ROOT, "dist-assets"))
  ? join(ROOT, "dist-assets")
  : getStagedStaticSite();

const INITIAL_JS_BROTLI_FAIL = 400 * 1024;
const INITIAL_JS_BROTLI_WARN = 350 * 1024;
const INITIAL_JS_RAW_FAIL = 1.2 * 1024 * 1024;

/** Initial JS = defer scripts referenced by the production SPA shell (not lazy chunks). */
function initialJsFromShell(htmlPath: string): { files: string[]; raw: number; brotli: number } {
  const html = readFileSync(htmlPath, "utf8");
  const srcRe = /<script[^>]+defer[^>]+src="(\/web-client\/[^"?]+\.js[^"]*)"/gi;
  const files: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = srcRe.exec(html))) {
    const rel = m[1].replace(/^\//, "").replace(/\?.*$/, "");
    if (!files.includes(rel)) files.push(rel);
  }
  let raw = 0;
  let brotli = 0;
  for (const rel of files) {
    const abs = join(STAGE, rel);
    expect(existsSync(abs), `missing initial script ${rel}`).toBe(true);
    const buf = readFileSync(abs);
    raw += buf.length;
    brotli += brotliCompressSync(buf).length;
  }
  return { files, raw, brotli };
}

describe("performance budget (Phase 12C initial JS)", () => {
  it("SPA shell defers web-client JS, drops JS preload, keeps CSS preload", () => {
    const html = readFileSync(join(STAGE, "index.html"), "utf8");
    const webClientScripts = [...html.matchAll(/<script[^>]+src="(\/web-client\/[^"]+\.js[^"]*)"[^>]*>/gi)].map(
      (m) => m[0],
    );
    expect(webClientScripts.length).toBeGreaterThan(0);
    for (const tag of webClientScripts) {
      expect(tag).toMatch(/\bdefer\b/i);
      expect(tag).not.toMatch(/\basync\b/i);
    }
    expect(html).not.toMatch(/<link[^>]+rel="preload"[^>]+as="script"/i);
    expect(html).toMatch(/<link[^>]+rel="preload"[^>]+as="style"/i);
  });

  it("initial JS from index.html stays within Brotli budget", () => {
    const { files, raw, brotli } = initialJsFromShell(join(STAGE, "index.html"));
    expect(files).toContain("web-client/blogger-app.js");
    expect(files).toContain("web-client/rights-boot.js");
    expect(raw).toBeLessThan(INITIAL_JS_RAW_FAIL);
    if (brotli > INITIAL_JS_BROTLI_WARN) {
      // eslint-disable-next-line no-console -- budget advisory
      console.warn(`[perf-budget] initial JS Brotli ${brotli} exceeds warn ${INITIAL_JS_BROTLI_WARN}`);
    }
    expect(brotli).toBeLessThanOrEqual(INITIAL_JS_BROTLI_FAIL);
  });

  it("does not reference dead main-build assets/index- chunks in SPA shells", () => {
    for (const rel of ["index.html", "l/fr/index.html", "l/ar/index.html"]) {
      const html = readFileSync(join(STAGE, rel), "utf8");
      expect(html).not.toMatch(/assets\/index-[A-Za-z0-9_-]+\.js/);
    }
  });

  it("fails if orphaned web-client/assets/ is staged", () => {
    expect(existsSync(join(STAGE, "web-client", "assets"))).toBe(false);
  });
});
