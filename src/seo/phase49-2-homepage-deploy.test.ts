import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { getTargetLocales } from "../../scripts/i18n/target-languages.mjs";
import { HOME_META_EN } from "../../scripts/i18n/translate-homepage-meta.mjs";
import { expandApprovedPaths, auditCommitScope } from "../../scripts/seo/phase49-2-commit-scope.mjs";
import { PHASE492_APPROVED_PATHS } from "../../scripts/seo/phase49-2-commit-scope.mjs";
import homeFaqEn from "../i18n/home-faq.en.json";
import localeMeta from "../../workers/locale-meta.json";
import deployIdentity from "../../reports/phase49-2/DEPLOY_IDENTITY.json";
import liveHome from "../../reports/phase49-2/HOMEPAGE_LIVE_VERIFY.json";
import liveLocales from "../../reports/phase49-2/LIVE_LOCALE_VERIFY.json";
import { loadHomeHtml } from "../../scripts/seo/phase47-homepage-audit.mjs";
import { extractMeta } from "../../scripts/seo/lib/html-extract.mjs";

const OUT = join(process.cwd(), "reports/phase49-2");
const TARGET = getTargetLocales();
const PROBE = ["fr", "ar", "de", "es", "pt", "ja", "fa", "he", "ur"];
const PRE_COMMIT = "75a21a0927a8cf35596e4cf377f82d7a8500d311";

function git(cmd: string) {
  return execSync(cmd, { cwd: process.cwd(), encoding: "utf8" }).trim();
}

function readCsvRows(name: string) {
  const p = join(OUT, name);
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").trim().split("\n");
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = (cols[i] || "").replace(/^"|"$/g, "").replace(/""/g, '"');
    });
    return row;
  });
}

beforeAll(() => {
  if (!existsSync(join(OUT, "DEPLOY_IDENTITY.json"))) {
    throw new Error("Run phase 49.2 deploy first");
  }
});

describe("Phase 49.2 commit scope", () => {
  it("approved path list non-empty", () => expect(PHASE492_APPROVED_PATHS.length).toBeGreaterThan(10));
  it("expanded files ~165", () => expect(expandApprovedPaths().length).toBeGreaterThan(150));
  it("content lock title", () => expect(auditCommitScope().contentLock.titleMatches).toBe(true));
  it("content lock description", () => expect(auditCommitScope().contentLock.descriptionMatches).toBe(true));
  it("faq count 5", () => expect(auditCommitScope().contentLock.faqCount).toBe(5));
  it("commit scope audit exists", () => expect(existsSync(join(OUT, "COMMIT_SCOPE_AUDIT.json"))).toBe(true));
  it("HEAD matches deploy commit", () => expect(git("git rev-parse HEAD")).toBe(deployIdentity.commit));
  it("origin synced", () => expect(deployIdentity.pushed).toBe(true));
  it("commit message shipped", () => expect(git("git log -1 --format=%s")).toBe("seo: strengthen homepage global seo"));
  it("previous commit recorded", () => expect(deployIdentity.previous_commit).toBe(PRE_COMMIT));
});

describe("Phase 49.2 metadata lock", () => {
  it("EN title master", () => {
    expect(HOME_META_EN.title).toBe("YouTube Thumbnail Extractor — Free HD & High-Quality Thumbnails | 11tik");
  });
  it("EN description master", () => {
    expect(HOME_META_EN.description).toMatch(/including Shorts/);
  });
  it("locale-meta en title", () => expect(localeMeta.en.title).toBe(HOME_META_EN.title));
  it("locale-meta fr localized", () => expect(localeMeta.fr.title).toMatch(/11tik/));
  it("no 4K in EN title", () => expect(HOME_META_EN.title).not.toMatch(/\b4K\b/));
  it("no best claim", () => expect(HOME_META_EN.description).not.toMatch(/best/i));
});

describe.each(TARGET)("Phase 49.2 locale meta %s", (locale) => {
  it(`${locale} has title`, () => expect((localeMeta as Record<string, { title?: string }>)[locale]?.title?.length).toBeGreaterThan(15));
  it(`${locale} has description`, () =>
    expect((localeMeta as Record<string, { description?: string }>)[locale]?.description?.length).toBeGreaterThan(60));
});

describe("Phase 49.2 live EN homepage", () => {
  it("HTTP 200", () => expect(liveHome.status).toBe(200));
  it("5 FAQ questions", () => expect(liveHome.h3_count).toBe(5));
  it("max 3 FAQ links", () => expect(liveHome.faq_links.split("|").length).toBeLessThanOrEqual(3));
  it("canonical www", () => expect(liveHome.canonical).toBe("https://www.11tik.com/"));
  it("robots index", () => expect(liveHome.robots).toMatch(/index/i));
  it("WebApplication schema", () => expect(liveHome.schema).toBe("WebApplication"));
  it("no FAQPage schema", () => expect(liveHome.faq_schema).toBe("none"));
  it("title fit note recorded", () => expect(liveHome.title_fit_note).toBe("PRE_EXISTING_TITLE_FIT_BEHAVIOR"));
  it("description intent live", () => expect(liveHome.description_emitted).toMatch(/free/i));
  it("hreflang present", () => expect(liveHome.hreflang_count).toBeGreaterThan(100));
});

describe.each(PROBE)("Phase 49.2 live locale %s", (locale) => {
  it(`${locale} probe row exists`, () => {
    const row = liveLocales.probeLocales.find((r: { locale: string }) => r.locale === locale);
    expect(row).toBeTruthy();
  });
  it(`${locale} FAQ functional`, () => {
    const row = liveLocales.probeLocales.find((r: { locale: string }) => r.locale === locale);
    expect(row?.h3_count).toBe(5);
    expect(row?.same_locale_links).toBe("yes");
    expect(row?.english_faq_leak).toBe("no");
  });
});

describe("Phase 49.2 live internal links", () => {
  it("csv exists", () => expect(existsSync(join(OUT, "LIVE_INTERNAL_LINK_VERIFY.csv"))).toBe(true));
  it("all locales functional FAQ links", () => {
    for (const row of liveLocales.allLocales as Array<{ faq_links?: string; locale: string }>) {
      const links = String(row.faq_links || "").split("|").map((s) => s.trim()).filter(Boolean);
      if (!links.length) continue;
      const host = row.locale === "en" ? "www.11tik.com" : `${row.locale}.11tik.com`;
      expect(links.every((h) => h.includes(host))).toBe(true);
    }
  });
  it("no junk in probe FAQ links", () => {
    for (const row of liveLocales.probeLocales as Array<{ faq_links?: string }>) {
      expect(String(row.faq_links || "")).not.toMatch(/music|backlink/i);
    }
  });
  it("FR links use fr host", () => {
    const fr = liveLocales.probeLocales.find((r: { locale: string }) => r.locale === "fr");
    expect(String(fr?.faq_links || "")).toMatch(/fr\.11tik\.com/);
  });
});

describe("Phase 49.2 deploy identity", () => {
  it("worker version set", () => expect(deployIdentity.worker_version).toMatch(/-/));
  it("traffic 100%", () => expect(deployIdentity.traffic_percent).toBe(100));
  it("assets uploaded", () => expect(deployIdentity.assets_uploaded).toBeGreaterThan(100));
  it("deploy method wrangler", () => expect(deployIdentity.deploy_method).toMatch(/wrangler/));
});

describe("Phase 49.2 built HTML", () => {
  it("EN shell FAQ", () => expect(loadHomeHtml("en")?.html).toMatch(/yte-home-faq/));
  it("FR shell FAQ", () => expect(loadHomeHtml("fr")?.html).toMatch(/yte-home-faq/));
  it("AR shell FAQ", () => expect(loadHomeHtml("ar")?.html).toMatch(/yte-home-faq/));
  it("EN H1 extractor", () => {
    const body = loadHomeHtml("en")?.html?.match(/<div id="yte-root">([\s\S]*?)<\/div>/)?.[1] ?? "";
    expect(body).toMatch(/<h1>YouTube Thumbnail Extractor<\/h1>/);
  });
  it("EN emitted title intent", () => {
    const meta = extractMeta(loadHomeHtml("en")!.html);
    expect(meta.title).toMatch(/YouTube Thumbnail Extractor/i);
  });
});

describe("Phase 49.2 protected architecture", () => {
  it("worker edge unchanged in commit", () => {
    const files = execSync(`git diff --name-only ${PRE_COMMIT}..HEAD`, { encoding: "utf8" });
    expect(files).not.toContain("workers/11tik-edge.js");
  });
  it("wrangler unchanged", () => {
    const files = execSync(`git diff --name-only ${PRE_COMMIT}..HEAD`, { encoding: "utf8" });
    expect(files).not.toContain("wrangler.jsonc");
  });
  it("home-only eo untouched", () => expect(localeMeta.eo.title).not.toBe(HOME_META_EN.title));
});

describe("Phase 49.2 FAQ data", () => {
  it("EN 5 questions", () => expect(homeFaqEn.items.length).toBe(5));
  it("public en faq json", () => expect(existsSync("public/i18n/home-faq/en.json")).toBe(true));
  it("public fr faq json", () => expect(existsSync("public/i18n/home-faq/fr.json")).toBe(true));
  it("38 public faq files", () => {
    const n = execSync('powershell -Command "(Get-ChildItem public/i18n/home-faq/*.json).Count"', { encoding: "utf8" }).trim();
    expect(Number(n)).toBeGreaterThanOrEqual(38);
  });
});

describe("Phase 49.2 reports", () => {
  it("executive report", () => expect(existsSync(join(OUT, "PHASE49-2_EXECUTIVE_REPORT.md"))).toBe(true));
  it("rollback plan", () => expect(existsSync(join(OUT, "ROLLBACK_PLAN.md"))).toBe(true));
  it("live performance", () => expect(existsSync(join(OUT, "LIVE_PERFORMANCE.json"))).toBe(true));
  it("final git audit", () => expect(existsSync(join(OUT, "FINAL_GIT_AUDIT.json"))).toBe(true));
  it("locale verify csv", () => expect(existsSync(join(OUT, "LIVE_LOCALE_HOMEPAGE_VERIFY.csv"))).toBe(true));
});

describe("Phase 49.2 anti-spam", () => {
  it("no fake millions", () => expect(HOME_META_EN.description).not.toMatch(/millions/i));
  it("no guaranteed", () => expect(HOME_META_EN.description).not.toMatch(/guaranteed/i));
  it("live EN no junk faq links", () => expect(liveHome.faq_links).not.toMatch(/music|backlink/i));
});

describe("Phase 49.2 homepage intent", () => {
  it("extractor in EN title", () => expect(HOME_META_EN.title).toMatch(/Extractor/i));
  it("not how-to title", () => expect(HOME_META_EN.title).not.toMatch(/^How to/i));
  it("FAQ Q1 extractor", () => expect(homeFaqEn.items[0].question).toMatch(/extractor/i));
});

describe("Phase 49.2 rollback", () => {
  it("rollback target documented", () => {
    const md = readFileSync(join(OUT, "ROLLBACK_PLAN.md"), "utf8");
    expect(md).toContain(PRE_COMMIT);
    expect(md).toContain(deployIdentity.commit);
  });
  it("not executed", () => {
    const md = readFileSync(join(OUT, "ROLLBACK_PLAN.md"), "utf8");
    expect(md).toMatch(/NOT EXECUTED/i);
  });
});

describe("Phase 49.2 measurement mode", () => {
  it("classification allows measurement", () => {
    const md = readFileSync(join(OUT, "PHASE49-2_EXECUTIVE_REPORT.md"), "utf8");
    expect(md).toMatch(/MEASUREMENT_MODE/);
  });
});
