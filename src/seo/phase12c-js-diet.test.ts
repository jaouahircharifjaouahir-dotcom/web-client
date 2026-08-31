import { brotliCompressSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStagedStaticSite } from "./test-helpers/staged-static-site.ts";

const ROOT = process.cwd();
const STAGE = existsSync(join(ROOT, "dist-assets"))
  ? join(ROOT, "dist-assets")
  : getStagedStaticSite();
const BLOGGER = join(STAGE, "web-client", "blogger-app.js");
const STAGE_SCRIPT = readFileSync(join(ROOT, "scripts", "stage-worker-assets.mjs"), "utf8");

describe("Phase 12C JavaScript diet", () => {
  it("does not stage orphaned main Vite assets/ chunks", () => {
    expect(existsSync(join(STAGE, "web-client", "assets"))).toBe(false);
  });

  it("stages runtime UI locale packs outside the main bundle", () => {
    const uiDir = join(STAGE, "web-client", "i18n", "ui");
    expect(existsSync(uiDir)).toBe(true);
    const count = readdirSync(uiDir).filter((f) => f.endsWith(".json")).length;
    expect(count).toBeGreaterThan(100);
    expect(existsSync(join(uiDir, "fr.json"))).toBe(true);
    expect(existsSync(join(uiDir, "ar.json"))).toBe(true);
  });

  it("SPA shell defers rights-boot and drops JS preload", () => {
    const html = readFileSync(join(STAGE, "l", "fr", "index.html"), "utf8");
    expect(html).toContain('defer src="/web-client/rights-boot.js');
    expect(html).not.toMatch(/<link[^>]+rel="preload"[^>]+as="script"/i);
    expect(html).toContain('src="/web-client/blogger-app.js');
  });

  it("keeps blogger-app.js under post-obfuscation Brotli budget", () => {
    expect(existsSync(BLOGGER)).toBe(true);
    const bytes = readFileSync(BLOGGER);
    const brotli = brotliCompressSync(bytes).length;
    expect(brotli).toBeLessThan(450_000);
    expect(bytes.length).toBeLessThan(1_500_000);
  });

  it("stage-worker-assets drops orphaned Vite assets directory", () => {
    expect(STAGE_SCRIPT).toMatch(/rmSync\(assetsDir/);
  });
});
