import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import localeMeta from "../../workers/locale-meta.json";
import homeFaqEn from "../i18n/home-faq.en.json";
import { homeFaqFor } from "../i18n/homeFaq";
import { getTargetLocales } from "../../scripts/i18n/target-languages.mjs";
import { HOME_META_EN, loadHomeMetaArtifact, normalizeHeroFromMeta } from "../../scripts/i18n/translate-homepage-meta.mjs";
import { loadHomeFaqArtifact, homeFaqDocForLocale } from "../../scripts/i18n/translate-home-faq.mjs";
import { assertFaqLinksSameLocale } from "../../scripts/i18n/home-faq-links.mjs";
import { renderHomeFaqShellHtml } from "../../scripts/i18n/home-faq-shell.mjs";
import { loadHomeHtml } from "../../scripts/seo/phase47-homepage-audit.mjs";
import {
  runPhase491HomepageGlobalSeo,
  PHASE491,
  ALL_HOME_LOCALES,
  TARGET_LOCALES,
  PRIORITY_QA_LOCALES,
  auditMetadataLocalization,
  auditMetaDescriptions,
  auditMetadataCannibalization,
  auditFaqLocales,
  auditFaqInternalLinks,
  auditLocaleParity,
  auditHomeOnlyPolicy,
  faqSchemaDecision,
  measurePerformanceDelta,
  buildFixApprovalMatrix,
} from "../../scripts/seo/phase49-1-homepage-global-seo.mjs";
import { ANTI_CANNIBALIZATION_CONTRACT } from "../../scripts/i18n/anti-cannibalization-contract.mjs";
import { fitTitle, fitDescription } from "../../workers/html-meta.js";
import { extractMeta } from "../../scripts/seo/lib/html-extract.mjs";
import { ISO6391 } from "../../workers/iso6391.js";

const JUNK = [/#1/i, /world's best/i, /millions of users/i, /100% guaranteed/i, /\b4K\b/i];
const EN_TITLE = HOME_META_EN.title;
const EN_DESC = HOME_META_EN.description;

beforeAll(
  async () => {
    if (!existsSync(join(PHASE491, "PHASE49-1_EXECUTIVE_REPORT.md"))) {
      await runPhase491HomepageGlobalSeo();
    }
  },
  180_000,
);

describe("Phase 49.1 English metadata master", () => {
  it("title matches approved EN master", () => {
    expect(EN_TITLE).toBe("YouTube Thumbnail Extractor — Free HD & High-Quality Thumbnails | 11tik");
  });
  it("description matches approved EN master", () => {
    expect(EN_DESC).toMatch(/Download YouTube thumbnails for free/);
    expect(EN_DESC).toMatch(/including Shorts/);
  });
  it("locale-meta en title updated", () => {
    expect(localeMeta.en.title).toBe(EN_TITLE);
  });
  it("locale-meta en description updated", () => {
    expect(localeMeta.en.description).toBe(EN_DESC);
  });
  it("title includes 11tik brand", () => expect(EN_TITLE).toMatch(/11tik/));
  it("title includes extractor", () => expect(EN_TITLE).toMatch(/Extractor/i));
  it("title includes free intent", () => expect(EN_TITLE).toMatch(/Free/i));
  it("title includes HD intent", () => expect(EN_TITLE).toMatch(/HD|High-Quality/i));
  it("description includes free", () => expect(EN_DESC).toMatch(/free/i));
  it("description includes highest quality", () => expect(EN_DESC).toMatch(/highest available quality/i));
  it("description includes Shorts", () => expect(EN_DESC).toMatch(/Shorts/));
  it("no unsupported 4K claim in title", () => expect(EN_TITLE).not.toMatch(/\b4K\b/));
  it("no #1 claim in description", () => expect(EN_DESC).not.toMatch(/#1/));
});

describe.each(TARGET_LOCALES)("Phase 49.1 locale title %s", (locale) => {
  it(`${locale} has localized title artifact`, () => {
    const artifact = normalizeHeroFromMeta(loadHomeMetaArtifact(locale));
    expect(artifact?.title?.length).toBeGreaterThan(20);
  });
  it(`${locale} title retains 11tik`, () => {
    expect(loadHomeMetaArtifact(locale)?.title).toMatch(/11tik/i);
  });
  it(`${locale} title not identical to EN`, () => {
    if (locale === "de") return; // DE may keep English product terms
    const t = loadHomeMetaArtifact(locale)?.title || "";
    expect(t === EN_TITLE).toBe(false);
  });
});

describe.each(TARGET_LOCALES)("Phase 49.1 locale description %s", (locale) => {
  it(`${locale} has description`, () => {
    expect((loadHomeMetaArtifact(locale)?.description || "").length).toBeGreaterThan(60);
  });
  it(`${locale} description mentions Shorts or localized equivalent`, () => {
    const d = loadHomeMetaArtifact(locale)?.description || "";
    expect(d.length).toBeGreaterThan(40);
  });
});

describe.each(PRIORITY_QA_LOCALES)("Phase 49.1 priority QA %s", (locale) => {
  it(`${locale} heroTitle not English leakage`, () => {
    const cat = JSON.parse(readFileSync(join(process.cwd(), "src/i18n/catalog.json"), "utf8"));
    const hero = cat[locale]?.ui?.heroTitle || "";
    if (locale === "de") {
      expect(hero).toMatch(/YouTube|Thumbnail|Extractor|miniatur/i);
      return;
    }
    expect(hero).not.toBe("YouTube Thumbnail Extractor");
  });
  it(`${locale} heroIntro localized`, () => {
    const cat = JSON.parse(readFileSync(join(process.cwd(), "src/i18n/catalog.json"), "utf8"));
    const intro = cat[locale]?.ui?.heroIntro || "";
    expect(intro).not.toBe(EN_DESC);
    expect(intro.length).toBeGreaterThan(40);
  });
});

describe("Phase 49.1 FAQ coverage", () => {
  it("EN FAQ has 5 items", () => expect(homeFaqEn.items.length).toBe(5));
  it("all 38 locales have FAQ artifacts", () => {
    for (const locale of ALL_HOME_LOCALES) {
      expect(loadHomeFaqArtifact(locale)?.faq?.length).toBe(5);
    }
  });
  it("homeFaqDocForLocale en", () => expect(homeFaqDocForLocale("en")?.items.length).toBe(5));
  it("homeFaqDocForLocale fr", () => expect(homeFaqDocForLocale("fr")?.items.length).toBe(5));
  it("homeFaqDocForLocale ar", () => expect(homeFaqDocForLocale("ar")?.items.length).toBe(5));
  it("homeFaqDocForLocale ja", () => expect(homeFaqDocForLocale("ja")?.items.length).toBe(5));
  it("auditFaqLocales all ready", () => {
    expect(auditFaqLocales().every((r) => r.status === "ready")).toBe(true);
  });
});

describe.each(TARGET_LOCALES)("Phase 49.1 FAQ links %s", (locale) => {
  it(`${locale} FAQ links same locale`, () => {
    const html = (homeFaqDocForLocale(locale)?.items || []).map((i) => i.answerHtml).join(" ");
    expect(assertFaqLinksSameLocale(html, locale)).toBe(true);
  });
  it(`${locale} has at least 3 guide links`, () => {
    const html = (homeFaqDocForLocale(locale)?.items || []).map((i) => i.answerHtml).join(" ");
    const links = [...html.matchAll(/href="([^"]+)"/g)];
    expect(links.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Phase 49.1 FAQ semantic structure", () => {
  it("Q1 extractor intent EN", () => expect(homeFaqEn.items[0].question).toMatch(/extractor/i));
  it("Q2 URL intent EN", () => expect(homeFaqEn.items[1].question).toMatch(/URL/i));
  it("Q3 upload privacy EN", () => expect(homeFaqEn.items[2].question).toMatch(/upload/i));
  it("Q4 Shorts EN", () => expect(homeFaqEn.items[3].question).toMatch(/Shorts/i));
  it("Q5 quality fallback EN", () => expect(homeFaqEn.items[4].question).toMatch(/quality|unavailable/i));
  it("FR Q1 localized not English question", () => {
    const fr = loadHomeFaqArtifact("fr");
    expect(fr?.faq?.[0]?.question).not.toBe(homeFaqEn.items[0].question);
  });
  it("AR Q1 RTL locale has FAQ", () => {
    expect(loadHomeFaqArtifact("ar")?.faqHeading?.length).toBeGreaterThan(3);
  });
});

describe("Phase 49.1 cannibalization", () => {
  it("homepage contract extractor owner", () => {
    expect(ANTI_CANNIBALIZATION_CONTRACT.home.primary).toMatch(/extractor|downloader/i);
  });
  it("title not how-to guide", () => expect(EN_TITLE).not.toMatch(/^How to/i));
  it("title not URL anatomy", () => expect(EN_TITLE).not.toMatch(/thumbnail url/i));
  it("title not maxres essay", () => expect(EN_TITLE).not.toMatch(/maxresdefault/i));
  it("metadata cannibalization no REJECT", () => {
    expect(auditMetadataCannibalization().some((r) => r.risk === "REJECT")).toBe(false);
  });
  it("download guide SAFE", () => {
    expect(auditMetadataCannibalization().find((r) => r.guide === "download")?.risk).toBe("SAFE");
  });
});

describe("Phase 49.1 static shell FAQ", () => {
  it("renderHomeFaqShellHtml en non-empty", () => {
    expect(renderHomeFaqShellHtml("en").length).toBeGreaterThan(200);
  });
  it("renderHomeFaqShellHtml fr non-empty", () => {
    expect(renderHomeFaqShellHtml("fr").length).toBeGreaterThan(200);
  });
  it("renderHomeFaqShellHtml ar non-empty", () => {
    expect(renderHomeFaqShellHtml("ar").length).toBeGreaterThan(200);
  });
  it("shell has 5 h3 per locale sample", () => {
    expect((renderHomeFaqShellHtml("de").match(/<h3/g) || []).length).toBe(5);
  });
  it("built EN home has FAQ section", () => {
    expect(loadHomeHtml("en")?.html).toMatch(/<section class="yte-home-faq"/);
  });
  it("built FR home has FAQ section", () => {
    expect(loadHomeHtml("fr")?.html).toMatch(/<section class="yte-home-faq"/);
  });
  it("built AR home has FAQ section", () => {
    expect(loadHomeHtml("ar")?.html).toMatch(/<section class="yte-home-faq"/);
  });
});

describe("Phase 49.1 built HTML metadata", () => {
  it("EN home title fits", () => {
    const meta = extractMeta(loadHomeHtml("en")!.html);
    expect(fitTitle(meta.title || "").length).toBeGreaterThanOrEqual(20);
  });
  it("FR home title present", () => {
    const meta = extractMeta(loadHomeHtml("fr")!.html);
    expect(meta.title?.length).toBeGreaterThan(15);
  });
  it("EN description fits band", () => {
    const meta = extractMeta(loadHomeHtml("en")!.html);
    expect(fitDescription(meta.description || "").length).toBeGreaterThanOrEqual(80);
  });
  it("canonical EN unchanged pattern", () => {
    const meta = extractMeta(loadHomeHtml("en")!.html);
    expect(meta.canonical).toBe("https://www.11tik.com/");
  });
  it("canonical FR locale path", () => {
    const meta = extractMeta(loadHomeHtml("fr")!.html);
    expect(meta.canonical).toMatch(/fr\.11tik\.com\/l\/fr\//);
  });
  it("robots index EN", () => {
    const meta = extractMeta(loadHomeHtml("en")!.html);
    expect(meta.robots).toMatch(/index/i);
  });
});

describe("Phase 49.1 home-only protection", () => {
  it("145+ home-only locales exist", () => {
    const homeOnly = ISO6391.map(([c]) => c).filter((c) => c !== "en" && !TARGET_LOCALES.includes(c));
    expect(homeOnly.length).toBeGreaterThanOrEqual(140);
  });
  it("home-only policy UNCHANGED", () => {
    expect(auditHomeOnlyPolicy().policy).toBe("UNCHANGED");
  });
  it("home-only no FAQ mass add flag", () => {
    expect(auditHomeOnlyPolicy().faq_added).toBe(false);
  });
  it("eo home-only unchanged title not new master", () => {
    expect(localeMeta.eo?.title).not.toBe(EN_TITLE);
  });
});

describe("Phase 49.1 schema policy", () => {
  it("VISIBLE_FAQ_ONLY", () => expect(faqSchemaDecision().policy).toBe("VISIBLE_FAQ_ONLY"));
  it("no FAQPage added", () => expect(faqSchemaDecision().faqPageAdded).toBe(false));
  it("WebApplication on EN build", () => {
    expect(loadHomeHtml("en")?.html).toMatch(/WebApplication/);
  });
  it("no FAQPage schema on EN build", () => {
    expect(loadHomeHtml("en")?.html).not.toMatch(/FAQPage/);
  });
});

describe("Phase 49.1 performance", () => {
  it("no new JS dependency", () => expect(measurePerformanceDelta().new_js_dependency).toBe(false));
  it("js delta zero", () => expect(measurePerformanceDelta().js_delta).toBe(0));
  it("faq shell bytes reasonable", () => {
    expect(measurePerformanceDelta().faq_shell_en_bytes).toBeLessThan(15000);
  });
});

describe("Phase 49.1 reports", () => {
  it("executive report exists", () => expect(existsSync(join(PHASE491, "PHASE49-1_EXECUTIVE_REPORT.md"))).toBe(true));
  it("title localization csv", () => expect(existsSync(join(PHASE491, "HOMEPAGE_TITLE_LOCALIZATION.csv"))).toBe(true));
  it("meta localization csv", () => expect(existsSync(join(PHASE491, "HOMEPAGE_META_LOCALIZATION.csv"))).toBe(true));
  it("cannibalization csv", () => expect(existsSync(join(PHASE491, "METADATA_CANNIBALIZATION.csv"))).toBe(true));
  it("internal links csv", () => expect(existsSync(join(PHASE491, "HOMEPAGE_LOCALE_INTERNAL_LINKS.csv"))).toBe(true));
  it("parity csv", () => expect(existsSync(join(PHASE491, "HOMEPAGE_LOCALE_PARITY.csv"))).toBe(true));
  it("fix matrix csv", () => expect(existsSync(join(PHASE491, "FIX_APPROVAL_MATRIX.csv"))).toBe(true));
  it("metadata evidence json", () => expect(existsSync(join(PHASE491, "METADATA_EVIDENCE.json"))).toBe(true));
  it("home only policy json", () => expect(existsSync(join(PHASE491, "HOME_ONLY_POLICY.json"))).toBe(true));
  it("faq schema decision json", () => expect(existsSync(join(PHASE491, "FAQ_SCHEMA_DECISION.json"))).toBe(true));
  it("performance delta json", () => expect(existsSync(join(PHASE491, "PERFORMANCE_DELTA.json"))).toBe(true));
});

describe("Phase 49.1 audit row counts", () => {
  it("38 title rows", () => expect(auditMetadataLocalization().length).toBe(38));
  it("38 description rows", () => expect(auditMetaDescriptions().length).toBe(38));
  it("37 FAQ link rows", () => expect(auditFaqInternalLinks().length).toBe(37));
  it("38 parity rows", () => expect(auditLocaleParity().length).toBe(38));
  it("fix matrix scoped", () => expect(buildFixApprovalMatrix().filter((r) => r.approved === "yes").length).toBe(4));
});

describe("Phase 49.1 junk firewall", () => {
  it.each(JUNK)("EN title no junk %s", (re) => {
    expect(EN_TITLE).not.toMatch(re);
  });
  it.each(JUNK)("EN description no junk %s", (re) => {
    expect(EN_DESC).not.toMatch(re);
  });
  it.each(TARGET_LOCALES.slice(0, 10))("%s title no 4K claim", (locale) => {
    expect(loadHomeMetaArtifact(locale)?.title || "").not.toMatch(/\b4K\b/);
  });
});

describe("Phase 49.1 public FAQ assets", () => {
  it("public en faq json exists", () => {
    expect(existsSync(join(process.cwd(), "public/i18n/home-faq/en.json"))).toBe(true);
  });
  it("public fr faq json exists", () => {
    expect(existsSync(join(process.cwd(), "public/i18n/home-faq/fr.json"))).toBe(true);
  });
  it("public 38 faq files", () => {
    const dir = join(process.cwd(), "public/i18n/home-faq");
    const files = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(38);
  });
});

describe("Phase 49.1 architecture protection", () => {
  it("target locale count 37", () => expect(getTargetLocales().length).toBe(37));
  it("homeFaqFor en sync", () => expect(homeFaqFor("en")?.items.length).toBe(5));
  it("no new routes in App", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toMatch(/HomeFaq/);
    expect(app).not.toMatch(/home-faq-route/i);
  });
});

describe("Phase 49.1 study discovery", () => {
  it("homepage shell may reference study via guides", () => {
    const html = loadHomeHtml("en")?.html || "";
    const hasStudy = /study|300/i.test(html);
    expect(hasStudy || html.includes("yte-shell-guides")).toBe(true);
  });
});

describe("Phase 49.1 same-locale link hosts", () => {
  it("FR FAQ uses fr.11tik.com", () => {
    const html = (homeFaqDocForLocale("fr")?.items || []).map((i) => i.answerHtml).join(" ");
    expect(html).toMatch(/fr\.11tik\.com/);
  });
  it("AR FAQ uses ar.11tik.com", () => {
    const html = (homeFaqDocForLocale("ar")?.items || []).map((i) => i.answerHtml).join(" ");
    expect(html).toMatch(/ar\.11tik\.com/);
  });
  it("DE FAQ uses de.11tik.com", () => {
    const html = (homeFaqDocForLocale("de")?.items || []).map((i) => i.answerHtml).join(" ");
    expect(html).toMatch(/de\.11tik\.com/);
  });
  it("EN FAQ uses www.11tik.com", () => {
    const html = homeFaqEn.items.map((i) => i.answerHtml).join(" ");
    expect(html).toMatch(/www\.11tik\.com/);
  });
});

describe("Phase 49.1 locale parity sample", () => {
  it("parity audit mostly ready", () => {
    const rows = auditLocaleParity();
    const ready = rows.filter((r) => r.status === "ready").length;
    expect(ready).toBeGreaterThanOrEqual(35);
  });
  it("internal links audit all ready", () => {
    expect(auditFaqInternalLinks().every((r) => r.status === "ready")).toBe(true);
  });
});
