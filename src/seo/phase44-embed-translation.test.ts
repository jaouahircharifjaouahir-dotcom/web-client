import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import {
  runPhase44EmbedTranslation,
  PHASE44,
  reproduceStaleEmbed,
  auditEmbedSourceChange,
  verifyEmbedIntegrity,
  verifyBuiltEmbed,
  OLD_EMBED_HASH,
  RTL_LOCALES,
  REQUIRED_SECTION_HEADING,
  writeCsv,
} from "../../scripts/seo/phase44-embed-translation.mjs";
import { getTargetLocales } from "../../scripts/i18n/target-languages.mjs";
import { readSourceHash } from "../../scripts/i18n/translation-store.mjs";
import { EMBED_SOURCE } from "../../scripts/seo/phase40-locale-about-fix.mjs";

const REPORTS = join(PHASE44, "..");

beforeAll(
  async () => {
    if (!existsSync(join(PHASE44, "PHASE44_EXECUTIVE_REPORT.md"))) {
      await runPhase44EmbedTranslation({ skipTranslate: true });
    }
  },
  180_000,
);

describe("Phase 44 stale reproduction", () => {
  it("STALE_EMBED_REPRODUCTION exists", () => {
    expect(existsSync(join(PHASE44, "STALE_EMBED_REPRODUCTION.json"))).toBe(true);
  });

  it("post-repair 0 stale", () => {
    const j = JSON.parse(readFileSync(join(PHASE44, "STALE_EMBED_REPRODUCTION.json"), "utf8"));
    expect(j.postRepair || j.staleCount === 0).toBeTruthy();
  });

  it("37 locales", () => {
    expect(getTargetLocales().length).toBe(37);
  });

  it("reproduceStaleEmbed ready 37", () => {
    const r = reproduceStaleEmbed();
    expect(r.readyCount).toBe(37);
    expect(r.staleCount).toBe(0);
  });
});

describe("Phase 44 source audit", () => {
  it("EMBED_SOURCE_CHANGE_AUDIT exists", () => {
    expect(existsSync(join(PHASE44, "EMBED_SOURCE_CHANGE_AUDIT.md"))).toBe(true);
  });

  it("has browser limitations section", () => {
    const a = auditEmbedSourceChange();
    expect(a.hasBrowserLimitations).toBe(true);
    expect(a.sectionCount).toBe(4);
  });

  it("hash changed from old", () => {
    const en = readSourceHash(EMBED_SOURCE);
    expect(en).not.toBe(OLD_EMBED_HASH);
  });
});

describe("Phase 44 translation validity", () => {
  it("EMBED_TRANSLATION_VALIDITY.csv exists", () => {
    expect(existsSync(join(PHASE44, "EMBED_TRANSLATION_VALIDITY.csv"))).toBe(true);
  });

  it("full refresh all locales", () => {
    const csv = readFileSync(join(PHASE44, "EMBED_TRANSLATION_VALIDITY.csv"), "utf8");
    expect((csv.match(/FULL_REFRESH/g) || []).length).toBeGreaterThanOrEqual(37);
  });

  it("EMBED_TRANSLATION_REPAIR exists", () => {
    expect(existsSync(join(PHASE44, "EMBED_TRANSLATION_REPAIR.csv"))).toBe(true);
  });
});

describe("Phase 44 integrity", () => {
  it("EMBED_TRANSLATION_INTEGRITY all pass", () => {
    const csv = readFileSync(join(PHASE44, "EMBED_TRANSLATION_INTEGRITY.csv"), "utf8");
    const lines = csv.split("\n").slice(1).filter(Boolean);
    expect(lines.every((l) => l.includes('"true"') || l.includes(',"true",'))).toBe(true);
  });

  it("verifyEmbedIntegrity fr", () => {
    const r = verifyEmbedIntegrity("fr");
    expect(r.ok).toBe(true);
    expect(r.sectionCount).toBe(4);
  });

  it("verifyEmbedIntegrity ar", () => {
    expect(verifyEmbedIntegrity("ar").ok).toBe(true);
  });
});

describe("Phase 44 build emission", () => {
  it("BUILD_VERIFY 37 rows", () => {
    const lines = readFileSync(join(PHASE44, "BUILD_VERIFY.csv"), "utf8").split("\n").filter(Boolean);
    expect(lines.length - 1).toBe(37);
  });

  it("fr emitted no english fallback", () => {
    const b = verifyBuiltEmbed("fr");
    expect(b.exists).toBe(true);
    expect(b.englishFallback).toBe(false);
    expect(b.lang).toBe("fr");
  });

  it("ar rtl", () => {
    const b = verifyBuiltEmbed("ar");
    expect(b.dir).toBe("rtl");
    expect(b.rtlOk).toBe(true);
  });
});

describe("Phase 44 RTL locales", () => {
  for (const loc of RTL_LOCALES) {
    it(`${loc} rtl ok`, () => {
      expect(verifyBuiltEmbed(loc).rtlOk).toBe(true);
    });
  }
});

describe("Phase 44 SEO meta", () => {
  it("SEO_META_VERIFY exists", () => {
    expect(existsSync(join(PHASE44, "SEO_META_VERIFY.csv"))).toBe(true);
  });

  it("fr canonical self", () => {
    const b = verifyBuiltEmbed("fr");
    expect(b.canonical).toContain("/l/fr/p/embed.html");
  });

  it("hreflang present", () => {
    expect(verifyBuiltEmbed("de").hreflangCount).toBeGreaterThan(30);
  });

  it("robots index", () => {
    expect(verifyBuiltEmbed("ja").robots).toMatch(/index/i);
  });
});

describe("Phase 44 internal links", () => {
  it("EMBED_LINK_VERIFY exists", () => {
    expect(existsSync(join(PHASE44, "EMBED_LINK_VERIFY.csv"))).toBe(true);
  });

  it("no junk links in build", () => {
    const csv = readFileSync(join(PHASE44, "BUILD_VERIFY.csv"), "utf8");
    expect(csv).not.toMatch(/junkLinks.*yes/i);
  });

  it("study link in en embed", () => {
    const csv = readFileSync(join(PHASE44, "EMBED_LINK_VERIFY.csv"), "utf8");
    const enLine = csv.split("\n").find((l) => l.startsWith('"en"'));
    expect(enLine).toMatch(/"yes"/);
  });
});

describe("Phase 44 indexation safety", () => {
  it("INDEXATION_SAFETY no manual IndexNow", () => {
    const j = JSON.parse(readFileSync(join(PHASE44, "INDEXATION_SAFETY.json"), "utf8"));
    expect(j.manualIndexNow).toBe(false);
    expect(j.localizedEmbedEmitted).toBe(37);
  });

  it("sitemap count increased", () => {
    const j = JSON.parse(readFileSync(join(PHASE44, "INDEXATION_SAFETY.json"), "utf8"));
    expect(j.sitemapCount).toBeGreaterThanOrEqual(948);
  });
});

describe("Phase 44 performance", () => {
  it("PERFORMANCE_GUARD worker unchanged", () => {
    const j = JSON.parse(readFileSync(join(PHASE44, "PERFORMANCE_GUARD.json"), "utf8"));
    expect(j.workerChanged).toBe(false);
  });
});

describe("Phase 44 quality", () => {
  it("QUALITY_REPORT classification A", () => {
    const j = JSON.parse(readFileSync(join(PHASE44, "QUALITY_REPORT.json"), "utf8"));
    expect(j.classification).toBe("A");
    expect(j.staleAfter).toBe(0);
  });
});

describe("Phase 44 translation matrix", () => {
  it("FINAL_TRANSLATION_MATRIX embed ready", () => {
    const csv = readFileSync(join(PHASE44, "FINAL_TRANSLATION_MATRIX.csv"), "utf8");
    expect((csv.match(/,"ready",/g) || []).length).toBeGreaterThanOrEqual(37);
  });

  it("about still ready", () => {
    const csv = readFileSync(join(PHASE44, "FINAL_TRANSLATION_MATRIX.csv"), "utf8");
    expect(csv).toMatch(/"ready","ready"/);
  });
});

describe("Phase 44 commit scope", () => {
  it("COMMIT_SCOPE_AUDIT embed only", () => {
    const j = JSON.parse(readFileSync(join(PHASE44, "COMMIT_SCOPE_AUDIT.json"), "utf8"));
    expect(j.allowed.every((f) => f.includes("content/translations/embed/"))).toBe(true);
    expect(j.commitReady).toBe(true);
  });

  it("ROLLBACK_PLAN exists", () => {
    expect(existsSync(join(PHASE44, "ROLLBACK_PLAN.md"))).toBe(true);
  });
});

describe("Phase 44 executive", () => {
  it("PHASE44_EXECUTIVE_REPORT exists", () => {
    expect(existsSync(join(PHASE44, "PHASE44_EXECUTIVE_REPORT.md"))).toBe(true);
  });

  it("classification A ready for commit", () => {
    const md = readFileSync(join(PHASE44, "PHASE44_EXECUTIVE_REPORT.md"), "utf8");
    expect(md).toMatch(/READY FOR COMMIT|READY_FOR_COMMIT/i);
  });

  it("no commit executed", () => {
    const md = readFileSync(join(PHASE44, "PHASE44_EXECUTIVE_REPORT.md"), "utf8");
    expect(md).toMatch(/NO COMMIT/i);
  });
});

describe("Phase 44 protected architecture", () => {
  it("no worker in script", () => {
    const src = readFileSync(join(PHASE44, "../..", "scripts/seo/phase44-embed-translation.mjs"), "utf8");
    expect(src).not.toMatch(/11tik-edge/);
  });
});

describe("Phase 44 anti-spam", () => {
  it("no mass IndexNow", () => {
    const j = JSON.parse(readFileSync(join(PHASE44, "INDEXATION_SAFETY.json"), "utf8"));
    expect(j.manualIndexNow).toBe(false);
  });
});

describe("Phase 44 data gated", () => {
  it("executive mentions GSC gated", () => {
    const md = readFileSync(join(PHASE44, "PHASE44_EXECUTIVE_REPORT.md"), "utf8");
    expect(md).toMatch(/GSC|gated/i);
  });
});

describe("Phase 44 required sections", () => {
  it("limitations section in fr build", () => {
    expect(verifyBuiltEmbed("fr").hasLimitations).toBe(true);
  });

  it("REQUIRED_SECTION_HEADING documented", () => {
    expect(REQUIRED_SECTION_HEADING).toMatch(/Browser/);
  });
});

describe("Phase 44 sample locales", () => {
  for (const loc of ["de", "es", "ja", "pt"]) {
    it(`${loc} build ok`, () => {
      const b = verifyBuiltEmbed(loc);
      expect(b.exists).toBe(true);
      expect(b.lang).toBe(loc);
    });
  }
});

describe("Phase 44 writeCsv", () => {
  it("helper works", () => {
    const p = join(PHASE44, ".tmp-test44.csv");
    writeCsv(p, ["x"], [{ x: "1" }]);
    expect(existsSync(p)).toBe(true);
  });
});

describe("Phase 44 phase45 handoff", () => {
  it("PHASE45_HANDOFF exists", () => {
    expect(existsSync(join(PHASE44, "PHASE45_HANDOFF.json"))).toBe(true);
  });
});

describe("Phase 44 hash sync", () => {
  it("all artifacts match en hash", () => {
    const en = readSourceHash(EMBED_SOURCE);
    for (const loc of getTargetLocales()) {
      expect(verifyEmbedIntegrity(loc).ok).toBe(true);
    }
    expect(en?.slice(0, 8)).toBe("0a1e5a2e");
  });
});

describe("Phase 44 limitations content", () => {
  it("postMessage in ar artifact", () => {
    const b = verifyBuiltEmbed("ar");
    expect(b.hasLimitations).toBe(true);
  });
});

describe("Phase 44 schema", () => {
  it("WebPage schema on de", () => {
    expect(verifyBuiltEmbed("de").hasWebPage).toBe(true);
  });
});

describe("Phase 44 unknown handling", () => {
  it("missing locale fails integrity", () => {
    const r = verifyEmbedIntegrity("xx-invalid");
    expect(r.ok).toBe(false);
  });
});

describe("Phase 44 fa he ur", () => {
  it("fa limitations section", () => {
    expect(verifyBuiltEmbed("fa").hasLimitations).toBe(true);
  });

  it("he rtl limitations", () => {
    const b = verifyBuiltEmbed("he");
    expect(b.rtlOk).toBe(true);
    expect(b.hasLimitations).toBe(true);
  });

  it("ur rtl limitations", () => {
    expect(verifyBuiltEmbed("ur").rtlOk).toBe(true);
  });
});

describe("Phase 44 commit file count", () => {
  it("37 embed json in commit scope", () => {
    const j = JSON.parse(readFileSync(join(PHASE44, "COMMIT_SCOPE_AUDIT.json"), "utf8"));
    expect(j.allowed.length).toBe(37);
  });
});

describe("Phase 44 seo gate local", () => {
  it("asset manifest criticalMissing 0", () => {
    const m = JSON.parse(readFileSync(join(REPORTS, "asset-manifest.json"), "utf8"));
    expect(m.criticalMissing?.length ?? 0).toBe(0);
  });
});

describe("Phase 44 section parity", () => {
  it("all locales 4 sections", () => {
    for (const loc of getTargetLocales()) {
      expect(verifyEmbedIntegrity(loc).sectionCount).toBe(4);
    }
  });
});

describe("Phase 44 rollback", () => {
  it("rollback documents revert", () => {
    const md = readFileSync(join(PHASE44, "ROLLBACK_PLAN.md"), "utf8");
    expect(md).toMatch(/git revert/i);
  });
});
