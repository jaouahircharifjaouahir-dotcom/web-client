import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

describe("Phase 12D performance governance wiring", () => {
  it("CI runs build before test", () => {
    const ci = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    const buildIdx = ci.indexOf("npm run build");
    const testIdx = ci.indexOf("npm test");
    expect(buildIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeGreaterThan(-1);
    expect(buildIdx).toBeLessThan(testIdx);
  });

  it("scheduled smoke also runs lightweight performance probe", () => {
    const yml = readFileSync(join(ROOT, ".github/workflows/production-smoke-scheduled.yml"), "utf8");
    expect(yml).toContain("production:performance");
    expect(yml).toContain("production:smoke:scheduled");
  });

  it("performance baseline and probe script exist", () => {
    expect(existsSync(join(ROOT, "src/seo/performance-baseline.json"))).toBe(true);
    expect(existsSync(join(ROOT, "scripts/production-performance.mjs"))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["production:performance"]).toContain("production-performance.mjs");
  });

  it("does not add a separate Lighthouse cron in this phase", () => {
    expect(existsSync(join(ROOT, ".github/workflows/performance-audit-scheduled.yml"))).toBe(false);
  });
});
