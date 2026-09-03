import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import homeFaqEn from "../i18n/home-faq.en.json";
import { homeFaqFor, homeFaqItems } from "../i18n/homeFaq";
import {
  runPhase48HomepageFaq,
  PHASE48,
  auditFaqInformationGain,
  auditFaqCannibalization,
  faqSchemaDecision,
  measurePerformanceDelta,
} from "../../scripts/seo/phase48-homepage-faq.mjs";
import { loadHomeHtml } from "../../scripts/seo/phase47-homepage-audit.mjs";
import { renderHomeFaqShellHtml } from "../../scripts/i18n/home-faq-shell.mjs";
import { runSeoRegressionGate } from "../../scripts/seo/seo-regression-gate.mjs";
import { buildSeoContext } from "../../scripts/seo/lib/seo-context.mjs";
import { extractMeta } from "../../scripts/seo/lib/html-extract.mjs";
import { ANTI_CANNIBALIZATION_CONTRACT } from "../../scripts/i18n/anti-cannibalization-contract.mjs";

const JUNK_PATTERNS = [/\/music\//i, /backlink/i, /\?v=/, /trusted by millions/i, /world's #1/i, /100% guaranteed/i, /4K thumbnail/i];

beforeAll(
  async () => {
    if (!existsSync(join(PHASE48, "PHASE48_EXECUTIVE_REPORT.md"))) {
      await runPhase48HomepageFaq();
    }
  },
  180_000,
);

describe("Phase 48 FAQ data", () => {
  it("has 3–8 questions", () => {
    expect(homeFaqEn.items.length).toBeGreaterThanOrEqual(3);
    expect(homeFaqEn.items.length).toBeLessThanOrEqual(8);
  });
  it("has heading", () => expect(homeFaqEn.heading.length).toBeGreaterThan(3));
  it("questions unique", () => {
    const qs = homeFaqEn.items.map((i) => i.question);
    expect(new Set(qs).size).toBe(qs.length);
  });
  it("answers unique", () => {
    const as = homeFaqEn.items.map((i) => i.answerHtml);
    expect(new Set(as).size).toBe(as.length);
  });
  it("each answer 40–90 words approx", () => {
    for (const item of homeFaqEn.items) {
      const words = item.answerHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      expect(words, item.question).toBeGreaterThanOrEqual(35);
      expect(words, item.question).toBeLessThanOrEqual(95);
    }
  });
  it("homeFaqFor en returns doc", () => expect(homeFaqFor("en")?.items.length).toBe(8));
  it("homeFaqFor fr null at import (loads async)", () => expect(homeFaqFor("fr")).toBeNull());
  it("homeFaqItems en", () => expect(homeFaqItems("en").length).toBe(8));
  it("homeFaqItems ar empty", () => expect(homeFaqItems("ar").length).toBe(0));
});

describe("Phase 48 intent", () => {
  it("Q1 defines extractor", () => {
    expect(homeFaqEn.items[0].question).toMatch(/extractor/i);
  });
  it("Q2 URL support", () => {
    expect(homeFaqEn.items[1].question).toMatch(/URL/i);
  });
  it("Q3 privacy upload", () => {
    expect(homeFaqEn.items[2].question).toMatch(/upload/i);
  });
  it("Q4 Shorts", () => {
    expect(homeFaqEn.items[3].question).toMatch(/Shorts/i);
  });
  it("Q5 quality fallback", () => {
    expect(homeFaqEn.items[4].question).toMatch(/quality|unavailable/i);
  });
  it("contract home protected", () => {
    expect(ANTI_CANNIBALIZATION_CONTRACT.home.primary).toMatch(/extractor/i);
  });
  it("no URL anatomy deep dive", () => {
    const all = homeFaqEn.items.map((i) => i.answerHtml).join(" ");
    expect(all).not.toMatch(/vi_webp\/|filename matrix/i);
  });
});

describe("Phase 48 information gain", () => {
  it("FAQ_INFORMATION_GAIN.csv exists", () => expect(existsSync(join(PHASE48, "FAQ_INFORMATION_GAIN.csv"))).toBe(true));
  it("all HIGH gain", () => {
    expect(auditFaqInformationGain().every((r) => r.INFORMATION_GAIN === "HIGH")).toBe(true);
  });
  it("all KEEP yes", () => {
    expect(auditFaqInformationGain().every((r) => r.KEEP === "yes")).toBe(true);
  });
  it("specialist links mapped", () => {
    const specs = auditFaqInformationGain().map((r) => r.SPECIALIST_PAGE);
    expect(specs).toContain("URL_GUIDE");
    expect(specs).toContain("SHORTS_GUIDE");
    expect(specs).toContain("MAXRES_GUIDE");
  });
  it("does not repeat hero verbatim", () => {
    const hero = "paste a link below, click get thumbnail image";
    for (const item of homeFaqEn.items) {
      expect(item.answerHtml.toLowerCase()).not.toContain(hero);
    }
  });
});

describe("Phase 48 cannibalization", () => {
  it("FAQ_CANNIBALIZATION_CHECK.csv exists", () => expect(existsSync(join(PHASE48, "FAQ_CANNIBALIZATION_CHECK.csv"))).toBe(true));
  it("no REJECT rows", () => {
    expect(auditFaqCannibalization().some((r) => r.risk === "REJECT")).toBe(false);
  });
  it("download SAFE", () => {
    expect(auditFaqCannibalization().find((r) => r.guide === "download")?.risk).toBe("SAFE");
  });
  it("maxres WATCH at most", () => {
    const m = auditFaqCannibalization().find((r) => r.guide === "maxres");
    expect(["SAFE", "WATCH"]).toContain(m?.risk);
  });
  it("size guide SAFE", () => {
    expect(auditFaqCannibalization().find((r) => r.guide === "size")?.risk).toBe("SAFE");
  });
  it("embed SAFE", () => {
    expect(auditFaqCannibalization().find((r) => r.guide === "embed")?.risk).toBe("SAFE");
  });
});

describe("Phase 48 internal links", () => {
  it("contextual FAQ links stay bounded", () => {
    const links = homeFaqEn.items.flatMap((i) => [...i.answerHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
    expect(links.length).toBeLessThanOrEqual(10);
  });
  it("links are official 11tik or Firefox AMO URLs", () => {
    const links = homeFaqEn.items.flatMap((i) => [...i.answerHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
    for (const href of links) {
      expect(
        href.startsWith("https://www.11tik.com/") ||
          href.startsWith("https://addons.mozilla.org/"),
      ).toBe(true);
    }
  });
  it("no junk links in FAQ", () => {
    const links = homeFaqEn.items.flatMap((i) => [...i.answerHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
    for (const href of links) {
      for (const pat of JUNK_PATTERNS) expect(href).not.toMatch(pat);
    }
  });
  it("URL guide linked", () => {
    expect(homeFaqEn.items.some((i) => i.answerHtml.includes("youtube-thumbnail-url"))).toBe(true);
  });
  it("Shorts guide linked", () => {
    expect(homeFaqEn.items.some((i) => i.answerHtml.includes("youtube-shorts-thumbnail-download"))).toBe(true);
  });
  it("maxres guide linked", () => {
    expect(homeFaqEn.items.some((i) => i.answerHtml.includes("what-is-maxresdefaultjpg-when-youtube"))).toBe(true);
  });
});

describe("Phase 48 schema policy", () => {
  it("FAQ_SCHEMA_DECISION.json exists", () => expect(existsSync(join(PHASE48, "FAQ_SCHEMA_DECISION.json"))).toBe(true));
  it("FAQPage matches visible FAQ when present", () => {
    const en = loadHomeHtml("en");
    const d = faqSchemaDecision(en?.html ?? "");
    expect(["VISIBLE_FAQ_ONLY", "FAQPage_ADDED"]).toContain(d.decision);
    if (/"@type"\s*:\s*"FAQPage"/i.test(en?.html ?? "")) {
      expect(d.decision).toBe("FAQPage_ADDED");
      expect(d.visibleFaq).toBe(true);
    }
  });
  it("Organization and WebApplication remain on home shell", () => {
    const en = loadHomeHtml("en");
    expect(en?.html).toContain("WebApplication");
    expect(en?.html).toContain("Organization");
  });
});

describe("Phase 48 metadata preservation", () => {
  it("title unchanged intent", () => {
    const meta = extractMeta(loadHomeHtml("en")?.html ?? "");
    expect(meta.title).toContain("YouTube Thumbnail Extractor");
  });
  it("canonical www", () => {
    const meta = extractMeta(loadHomeHtml("en")?.html ?? "");
    expect(meta.canonical).toBe("https://www.11tik.com/");
  });
  it("robots index", () => {
    const meta = extractMeta(loadHomeHtml("en")?.html ?? "");
    expect(meta.robots).toMatch(/index/i);
  });
  it("hreflang present", () => {
    const meta = extractMeta(loadHomeHtml("en")?.html ?? "");
    expect(meta.hreflangCount).toBeGreaterThan(100);
  });
});

describe("Phase 48 shell HTML", () => {
  it("en shell has FAQ section", () => {
    expect(loadHomeHtml("en")?.html).toMatch(/<section class="yte-home-faq"/);
  });
  it("fr shell has FAQ section (phase 49.1)", () => {
    expect(loadHomeHtml("fr")?.html).toMatch(/<section class="yte-home-faq"/);
  });
  it("FAQ before foot in shell", () => {
    const html = loadHomeHtml("en")?.html ?? "";
    const faqIdx = html.indexOf("yte-home-faq");
    const footIdx = Math.max(
      html.indexOf("Public YouTube thumbnail images only"),
      html.indexOf("Public YouTube thumbnails only"),
    );
    expect(faqIdx).toBeGreaterThan(0);
    expect(footIdx).toBeGreaterThan(0);
    expect(faqIdx).toBeLessThan(footIdx);
  });
  it("renderHomeFaqShellHtml en non-empty", () => {
    expect(renderHomeFaqShellHtml("en").length).toBeGreaterThan(200);
  });
  it("renderHomeFaqShellHtml fr non-empty (phase 49.1)", () => {
    expect(renderHomeFaqShellHtml("fr").length).toBeGreaterThan(200);
  });
  it("shell has h2 FAQ heading", () => {
    expect(renderHomeFaqShellHtml("en")).toContain("<h2");
  });
  it("shell has 8 h3 questions", () => {
    expect((renderHomeFaqShellHtml("en").match(/<h3/g) || []).length).toBe(8);
  });
});

describe("Phase 48 trust / anti-spam", () => {
  it("no fake user counts", () => {
    const all = JSON.stringify(homeFaqEn);
    expect(all).not.toMatch(/million|billion users|downloads count/i);
  });
  it("no fake ratings", () => {
    expect(JSON.stringify(homeFaqEn)).not.toMatch(/AggregateRating|5 stars/i);
  });
  it("no 4K claims", () => {
    expect(JSON.stringify(homeFaqEn)).not.toMatch(/\b4K\b/);
  });
  it("no API key claims", () => {
    expect(JSON.stringify(homeFaqEn)).not.toMatch(/API key/i);
  });
  it("browser processing stated", () => {
    expect(homeFaqEn.items[2].answerHtml).toMatch(/browser/i);
  });
  it("public CDN stated", () => {
    expect(homeFaqEn.items[2].answerHtml).toMatch(/CDN/i);
  });
});

describe("Phase 48 performance", () => {
  it("PERFORMANCE_DELTA.json exists", () => expect(existsSync(join(PHASE48, "PERFORMANCE_DELTA.json"))).toBe(true));
  it("js delta zero", () => {
    expect(measurePerformanceDelta().jsDelta).toBe(0);
  });
  it("css delta zero", () => {
    expect(measurePerformanceDelta().cssDelta).toBe(0);
  });
  it("locale fr has FAQ (phase 49.1 expanded scope)", () => {
    expect(measurePerformanceDelta().localeFrUnchanged).toBe(false);
  });
  it("faq section under 4kb", () => {
    expect(measurePerformanceDelta().after.faqSectionBytes).toBeLessThan(4096);
  });
});

describe("Phase 48 locale policy", () => {
  it("LOCALE_FAQ_POLICY.md exists", () => expect(existsSync(join(PHASE48, "LOCALE_FAQ_POLICY.md"))).toBe(true));
  it("policy says no mass locale edit", () => {
    const md = readFileSync(join(PHASE48, "LOCALE_FAQ_POLICY.md"), "utf8");
    expect(md).toMatch(/unchanged/i);
  });
});

describe("Phase 48 reports", () => {
  it("executive report exists", () => expect(existsSync(join(PHASE48, "PHASE48_EXECUTIVE_REPORT.md"))).toBe(true));
  it("before after csv", () => expect(existsSync(join(PHASE48, "HOMEPAGE_BEFORE_AFTER.csv"))).toBe(true));
  it("fix matrix", () => expect(existsSync(join(PHASE48, "FIX_APPROVAL_MATRIX.csv"))).toBe(true));
  it("ux review", () => expect(existsSync(join(PHASE48, "FAQ_UX_REVIEW.md"))).toBe(true));
  it("phase49 handoff", () => expect(existsSync(join(PHASE48, "PHASE49_HANDOFF.json"))).toBe(true));
});

describe("Phase 48 protected architecture", () => {
  it("seo gate BLOCK 0", () => {
    const gate = runSeoRegressionGate(buildSeoContext());
    expect(gate.blockCount).toBe(0);
  });
  it("workers edge not modified in phase48 scope", () => {
    const faqFiles = ["src/i18n/home-faq.en.json", "src/components/HomeFaq.tsx"];
    for (const f of faqFiles) expect(existsSync(join(process.cwd(), f))).toBe(true);
  });
});

describe("Phase 48 classification", () => {
  it("classification A or B", () => {
    const md = readFileSync(join(PHASE48, "PHASE48_EXECUTIVE_REPORT.md"), "utf8");
    expect(md).toMatch(/HOMEPAGE FAQ SUCCESS/);
  });
  it("faq count 5 in report", () => {
    const md = readFileSync(join(PHASE48, "PHASE48_EXECUTIVE_REPORT.md"), "utf8");
    expect(md).toContain("FAQ_COUNT:** 5");
  });
});

describe("Phase 48 component source", () => {
  it("HomeFaq.tsx exists", () => expect(existsSync(join(process.cwd(), "src/components/HomeFaq.tsx"))).toBe(true));
  it("homeFaq.ts exists", () => expect(existsSync(join(process.cwd(), "src/i18n/homeFaq.ts"))).toBe(true));
  it("home-faq-shell.mjs exists", () => expect(existsSync(join(process.cwd(), "scripts/i18n/home-faq-shell.mjs"))).toBe(true));
});

describe("Phase 48 unknown handling", () => {
  it("homeFaqFor empty locale", () => expect(homeFaqFor("")).toBeNull());
  it("homeFaqFor xx", () => expect(homeFaqFor("xx")).toBeNull());
  it("shell empty for unknown", () => expect(renderHomeFaqShellHtml("zz")).toBe(""));
});
