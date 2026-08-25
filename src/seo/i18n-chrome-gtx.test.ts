import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { providerConfigReport, validateProviderConfig } from "../../scripts/i18n/provider-config.mjs";
import { buildGtxLocaleCoverage, gtxCodeForLocale } from "../../translator/locale/gtx-locale-map.mjs";
import { extensionPresent } from "../../translator/capture/gtx-client.mjs";
import { EXTENSION_ENDPOINTS } from "../../translator/selectors/extension-selectors.mjs";

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe("chrome_gtx local translator isolation", () => {
  it("defaults to chrome_gtx without cloud credentials", () => {
    const prev = { ...process.env };
    process.env.TRANSLATE_ENABLED = "1";
    process.env.TRANSLATION_PROVIDER = "chrome_gtx";
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.OPENAI_API_KEY;
    const report = providerConfigReport();
    expect(report.provider).toBe("chrome_gtx");
    expect(report.credentialsPresent).toBe(true);
    expect(report.localEngine).toBe(true);
    expect(report.configurationValid).toBe(true);
    process.env = prev;
  });

  it("requires translator/extension to be present for local engine", () => {
    expect(extensionPresent()).toBe(true);
    expect(existsSync(join(process.cwd(), "translator/extension/manifest.json"))).toBe(true);
  });

  it("maps pilot locales through GTX locale map", () => {
    expect(gtxCodeForLocale("fr")).toBe("fr");
    expect(gtxCodeForLocale("es")).toBe("es");
    expect(gtxCodeForLocale("de")).toBe("de");
    expect(gtxCodeForLocale("ar")).toBe("ar");
    expect(gtxCodeForLocale("he")).toBe("iw");
    expect(gtxCodeForLocale("zh")).toBe("zh-CN");
  });

  it("reports GTX coverage honestly", () => {
    const coverage = buildGtxLocaleCoverage();
    expect(coverage.supportedCount + coverage.unsupportedCount).toBe(182);
    expect(coverage.supportedCount).toBeGreaterThan(100);
  });

  it("documents extension endpoints without embedding secrets in tests", () => {
    expect(EXTENSION_ENDPOINTS.onePlatformTranslate).toContain("translate-pa.googleapis.com");
    expect(JSON.stringify(EXTENSION_ENDPOINTS)).not.toMatch(/AIzaSy/);
  });

  it("keeps translator tooling out of production dist folders when present", () => {
    const forbidden = [/translator\/extension/, /provider-chrome-gtx/, /bubble_compiled\.js/, /getApiKey\(\)\{return"/];
    for (const dist of ["dist", "dist-assets", "dist-assets-pilot"]) {
      const root = join(process.cwd(), dist);
      if (!existsSync(root)) continue;
      const files = walkFiles(root).filter((file) => /\.(html|js|css|xml)$/i.test(file));
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        for (const pattern of forbidden) {
          expect(text).not.toMatch(pattern);
        }
      }
    }
  });

  it("validates chrome_gtx config when enabled", () => {
    const ok = validateProviderConfig({
      enabled: true,
      provider: "chrome_gtx",
      rateLimitMs: 80,
      maxRetries: 3,
      batchSize: 1,
      timeoutMs: 120000,
      concurrency: 4,
      gtxConcurrency: 8,
    });
    expect(ok.ok).toBe(true);
  });
});
