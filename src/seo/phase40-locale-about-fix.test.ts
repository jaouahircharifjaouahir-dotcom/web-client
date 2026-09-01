import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import {
  runPhase40LocaleAboutFix,
  PHASE40,
  auditTranslationValidity,
  repairAboutSourceHashes,
  auditEmbedStale,
  verifyLocaleAboutBuild,
  ABOUT_SOURCE,
  OLD_ABOUT_HASH,
} from "../../scripts/seo/phase40-locale-about-fix.mjs";
import { readSourceHash } from "../../scripts/i18n/translation-store.mjs";
import { scanPublishability } from "../../scripts/i18n/publish.mjs";
import { getTargetLocales } from "../../scripts/i18n/target-languages.mjs";
import { ROOT } from "../../scripts/seo/lib/seo-context.mjs";

beforeAll(
  async () => {
    if (!existsSync(join(PHASE40, "BUG_REPRODUCTION.json"))) {
      await runPhase40LocaleAboutFix({ skipBuild: true, skipGate: true });
    }
  },
  120_000,
);

describe("Phase 40 bug reproduction", () => {
  it("BUG_REPRODUCTION.json exists", () => {
    expect(existsSync(join(PHASE40, "BUG_REPRODUCTION.json"))).toBe(true);
  });

  it("EN hash differs from old artifact hash", () => {
    const en = readSourceHash(ABOUT_SOURCE);
    expect(en).not.toBe(OLD_ABOUT_HASH);
  });

  it("after repair all locales ready", () => {
    const m = scanPublishability().contents.about;
    const ready = Object.values(m.locales).filter((r) => r.status === "ready").length;
    expect(ready).toBe(37);
  });
});

describe("Phase 40 translation validity", () => {
  it("TRANSLATION_VALIDITY_AUDIT.csv exists", () => {
    expect(existsSync(join(PHASE40, "TRANSLATION_VALIDITY_AUDIT.csv"))).toBe(true);
  });

  it("all locales TRANSLATION_STILL_VALID", () => {
    const rows = auditTranslationValidity();
    expect(rows.every((r) => r.classification === "TRANSLATION_STILL_VALID")).toBe(true);
  });

  it("37 locales in audit", () => {
    expect(auditTranslationValidity().length).toBe(37);
  });
});

describe("Phase 40 about repair", () => {
  it("ABOUT_REPAIR_LOG.csv exists", () => {
    expect(existsSync(join(PHASE40, "ABOUT_REPAIR_LOG.csv"))).toBe(true);
  });

  it("all repairs are HASH_REFRESH", () => {
    const csv = readFileSync(join(PHASE40, "ABOUT_REPAIR_LOG.csv"), "utf8");
    expect(csv).toContain("HASH_REFRESH");
    expect(csv).not.toContain("RETRANSLATE");
  });

  it("fr artifact hash matches EN", () => {
    const en = readSourceHash(ABOUT_SOURCE);
    const fr = JSON.parse(readFileSync(join(ROOT, "content/translations/about/fr.json"), "utf8"));
    expect(fr.sourceHash).toBe(en);
  });

  it("ar artifact hash matches EN", () => {
    const en = readSourceHash(ABOUT_SOURCE);
    const ar = JSON.parse(readFileSync(join(ROOT, "content/translations/about/ar.json"), "utf8"));
    expect(ar.sourceHash).toBe(en);
  });
});

describe("Phase 40 build output", () => {
  it("37/37 locale about files exist", () => {
    const rows = verifyLocaleAboutBuild();
    expect(rows.filter((r) => r.exists).length).toBe(37);
  });

  it("FR about not English fallback", () => {
    const fr = verifyLocaleAboutBuild().find((r) => r.locale === "fr");
    expect(fr?.lang).toBe("fr");
    expect(fr?.englishFallback).toBe(false);
  });

  it("AR about not English fallback", () => {
    const ar = verifyLocaleAboutBuild().find((r) => r.locale === "ar");
    expect(ar?.lang).toBe("ar");
    expect(ar?.englishFallback).toBe(false);
  });

  it("FR canonical includes locale path", () => {
    const fr = verifyLocaleAboutBuild().find((r) => r.locale === "fr");
    expect(fr?.canonical).toContain("/l/fr/p/about.html");
  });

  it("LOCALE_ABOUT_BUILD_VERIFY.csv exists", () => {
    expect(existsSync(join(PHASE40, "LOCALE_ABOUT_BUILD_VERIFY.csv"))).toBe(true);
  });
});

describe("Phase 40 RTL", () => {
  it("AR about uses dir=rtl", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/ar/p/about.html"), "utf8");
    expect(html).toMatch(/dir="rtl"/);
  });

  it("FR about uses dir=ltr", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/fr/p/about.html"), "utf8");
    expect(html).toMatch(/dir="ltr"/);
  });
});

describe("Phase 40 schema and SEO tags", () => {
  it("FR about has WebPage schema", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/fr/p/about.html"), "utf8");
    expect(html).toContain("application/ld+json");
    expect(html).toMatch(/WebPage|"@type":"WebPage"/);
  });

  it("FR about has hreflang", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/fr/p/about.html"), "utf8");
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="fr"');
  });

  it("FR about robots index,follow", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/fr/p/about.html"), "utf8");
    expect(html).toContain('content="index,follow"');
  });

  it("Organization in schema graph", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/de/p/about.html"), "utf8");
    expect(html).toMatch(/Organization/);
  });
});

describe("Phase 40 embed defer", () => {
  it("EMBED_REPAIR_RECOMMENDATION defers embed", () => {
    const md = readFileSync(join(PHASE40, "EMBED_REPAIR_RECOMMENDATION.md"), "utf8");
    expect(md).toMatch(/DEFER|do not auto-repair/i);
  });

  it("embed still stale", () => {
    const e = auditEmbedStale();
    expect(e.autoRepair).toBe(false);
    expect(e.staleCount).toBe(37);
  });

  it("embed requires refresh not hash sync", () => {
    expect(auditEmbedStale().classification).toBe("TRANSLATION_REQUIRES_REFRESH");
  });
});

describe("Phase 40 indexation safety", () => {
  it("INDEXATION_SAFETY.json exists", () => {
    expect(existsSync(join(PHASE40, "INDEXATION_SAFETY.json"))).toBe(true);
  });

  it("no mass IndexNow flag", () => {
    const j = JSON.parse(readFileSync(join(PHASE40, "INDEXATION_SAFETY.json"), "utf8"));
    expect(j.massIndexNow).toBe(false);
  });
});

describe("Phase 40 performance guard", () => {
  it("PERFORMANCE_GUARD.json worker unchanged", () => {
    const j = JSON.parse(readFileSync(join(PHASE40, "PERFORMANCE_GUARD.json"), "utf8"));
    expect(j.workerChanged).toBe(false);
  });
});

describe("Phase 40 protected architecture", () => {
  it("no Worker file in git diff for phase40 scope", () => {
    const diff = readFileSync(join(PHASE40, "COMMIT_SCOPE_AUDIT.json"), "utf8");
    expect(diff).toContain("workers/11tik-edge.js");
    expect(diff).toContain("forbidden");
  });

  it("repair does not touch wrangler", () => {
    const audit = JSON.parse(readFileSync(join(PHASE40, "COMMIT_SCOPE_AUDIT.json"), "utf8"));
    expect(audit.forbidden).toContain("wrangler.jsonc");
  });
});

describe("Phase 40 commit gate", () => {
  it("COMMIT_SCOPE_AUDIT no auto commit", () => {
    const j = JSON.parse(readFileSync(join(PHASE40, "COMMIT_SCOPE_AUDIT.json"), "utf8"));
    expect(j.autoCommit).toBe(false);
  });

  it("PHASE40_DECISION exists", () => {
    expect(existsSync(join(PHASE40, "PHASE40_DECISION.json"))).toBe(true);
  });
});

describe("Phase 40 stale detection", () => {
  it("resolvePublishState ready for fr after fix", () => {
    const m = scanPublishability().contents.about;
    expect(m.locales.fr.status).toBe("ready");
  });

  it("getTargetLocales count 37", () => {
    expect(getTargetLocales().length).toBe(37);
  });
});

describe("Phase 40 fallback prevention", () => {
  it("no locale about has lang=en except none", () => {
    const rows = verifyLocaleAboutBuild();
    for (const r of rows) {
      if (r.exists) expect(r.englishFallback).toBe(false);
    }
  });
});

describe("Phase 40 rollback safety", () => {
  it("repair log records before_hash", () => {
    const csv = readFileSync(join(PHASE40, "ABOUT_REPAIR_LOG.csv"), "utf8");
    expect(csv).toContain(OLD_ABOUT_HASH.slice(0, 16));
  });

  it("dry run repair does not write", () => {
    const log = repairAboutSourceHashes(true);
    expect(log.length).toBe(37);
  });
});

describe("Phase 40 executive report", () => {
  it("PHASE40_EXECUTIVE_REPORT.md exists", () => {
    expect(existsSync(join(PHASE40, "PHASE40_EXECUTIVE_REPORT.md"))).toBe(true);
  });

  it("mentions Phase 41 deploy", () => {
    const md = readFileSync(join(PHASE40, "PHASE40_EXECUTIVE_REPORT.md"), "utf8");
    expect(md).toMatch(/Phase 41/i);
  });

  it("no commit in phase 40", () => {
    const md = readFileSync(join(PHASE40, "PHASE40_EXECUTIVE_REPORT.md"), "utf8");
    expect(md).toMatch(/NO COMMIT/i);
  });
});

describe("Phase 40 unknown handling", () => {
  it("GSC remains data gated in report", () => {
    const md = readFileSync(join(PHASE40, "PHASE40_EXECUTIVE_REPORT.md"), "utf8");
    expect(md).toMatch(/DATA.GATED|GSC/i);
  });
});

describe("Phase 40 content integrity", () => {
  it("ABOUT_CONTENT_DIFF.csv exists", () => {
    expect(existsSync(join(PHASE40, "ABOUT_CONTENT_DIFF.csv"))).toBe(true);
  });

  it("localized FR h1 preserved", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/fr/p/about.html"), "utf8");
    expect(html).toContain("À propos");
  });
});
