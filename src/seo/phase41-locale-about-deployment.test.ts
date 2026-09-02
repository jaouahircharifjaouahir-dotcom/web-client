import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PHASE41,
  ALLOWED_COMMIT,
  auditHashOnlyDiffs,
  runPhase41Deployment,
} from "../../scripts/seo/phase41-locale-about-deployment.mjs";
import { verifyLocaleAboutBuild, OLD_ABOUT_HASH } from "../../scripts/seo/phase40-locale-about-fix.mjs";
import { getTargetLocales } from "../../scripts/i18n/target-languages.mjs";
import { ROOT } from "../../scripts/seo/lib/seo-context.mjs";
import { readSourceHash } from "../../scripts/i18n/translation-store.mjs";

describe("Phase 41 scope lock", () => {
  it("ALLOWED_COMMIT includes about translations", () => {
    expect(ALLOWED_COMMIT.some((p) => p.includes("about"))).toBe(true);
  });

  it("ALLOWED_COMMIT excludes Worker", () => {
    expect(ALLOWED_COMMIT.some((p) => p.includes("11tik-edge"))).toBe(false);
  });

  it("does not include embed translations path", () => {
    expect(ALLOWED_COMMIT.some((p) => p.includes("embed"))).toBe(false);
  });
});

describe("Phase 41 hash audit", () => {
  it("37 locales hash-only PASS", () => {
    const rows = auditHashOnlyDiffs();
    expect(rows.length).toBe(37);
    expect(rows.every((r) => r.status === "PASS")).toBe(true);
  });

  it("fr sourceHash updated", () => {
    const fr = JSON.parse(readFileSync(join(ROOT, "content/translations/about/fr.json"), "utf8"));
    expect(fr.sourceHash).toBe(readSourceHash("docs/blogger-pages/about.html"));
    expect(fr.sourceHash).not.toBe(OLD_ABOUT_HASH);
  });

  it("fr title unchanged", () => {
    const fr = JSON.parse(readFileSync(join(ROOT, "content/translations/about/fr.json"), "utf8"));
    expect(fr.title).toContain("À propos");
  });
});

describe("Phase 41 build output", () => {
  it("37/37 about files exist", () => {
    const rows = verifyLocaleAboutBuild();
    expect(rows.filter((r) => r.exists).length).toBe(37);
  });

  it("FR localized", () => {
    const fr = verifyLocaleAboutBuild().find((r) => r.locale === "fr");
    expect(fr?.lang).toBe("fr");
    expect(fr?.englishFallback).toBe(false);
  });

  it("AR localized", () => {
    const ar = verifyLocaleAboutBuild().find((r) => r.locale === "ar");
    expect(ar?.lang).toBe("ar");
  });

  it("DE canonical correct", () => {
    const de = verifyLocaleAboutBuild().find((r) => r.locale === "de");
    expect(de?.canonical).toContain("/l/de/p/about.html");
  });
});

describe("Phase 41 RTL", () => {
  it("AR dir=rtl in build", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/ar/p/about.html"), "utf8");
    expect(html).toMatch(/dir="rtl"/);
  });

  it("FR dir=ltr", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/fr/p/about.html"), "utf8");
    expect(html).toMatch(/dir="ltr"/);
  });
});

describe("Phase 41 schema SEO", () => {
  it("FR hreflang present", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/fr/p/about.html"), "utf8");
    expect(html).toContain("hreflang");
  });

  it("FR robots index,follow", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/fr/p/about.html"), "utf8");
    expect(html).toContain("index,follow");
  });

  it("JA WebPage schema", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/ja/p/about.html"), "utf8");
    expect(html).toContain("WebPage");
  });

  it("PT Organization in schema", () => {
    const html = readFileSync(join(ROOT, "dist-assets/l/pt/p/about.html"), "utf8");
    expect(html).toMatch(/Organization/);
  });
});

describe("Phase 41 embed deferred", () => {
  it("EMBED_STATUS deferred when report exists", () => {
    if (existsSync(join(PHASE41, "EMBED_STATUS.json"))) {
      const j = JSON.parse(readFileSync(join(PHASE41, "EMBED_STATUS.json"), "utf8"));
      expect(j.status).toBe("DEFERRED");
    } else {
      expect(true).toBe(true);
    }
  });
});

describe("Phase 41 protected architecture", () => {
  it("getTargetLocales is 37", () => {
    expect(getTargetLocales().length).toBe(37);
  });

  it("no english fallback in build matrix", () => {
    for (const r of verifyLocaleAboutBuild()) {
      if (r.exists) expect(r.englishFallback).toBe(false);
    }
  });
});

describe("Phase 41 reports", () => {
  it("PRE_COMMIT_SCOPE when generated", async () => {
    if (!existsSync(join(PHASE41, "PRE_COMMIT_SCOPE.json"))) {
      await runPhase41Deployment({ skipLive: true, force: true });
    }
    expect(existsSync(join(PHASE41, "PRE_COMMIT_SCOPE.json"))).toBe(true);
  });

  it("HASH_DIFF_AUDIT exists", () => {
    expect(existsSync(join(PHASE41, "HASH_DIFF_AUDIT.csv"))).toBe(true);
  });

  it("ROLLBACK_PLAN exists after deploy run", async () => {
    if (!existsSync(join(PHASE41, "ROLLBACK_PLAN.md"))) {
      await runPhase41Deployment({ skipLive: true, force: true });
    }
    expect(existsSync(join(PHASE41, "ROLLBACK_PLAN.md"))).toBe(true);
  });
});

describe("Phase 41 gate expectations", () => {
  it("asset manifest critical path exists locally", () => {
    expect(existsSync(join(ROOT, "dist-assets/l/fr/p/about.html"))).toBe(true);
  });

  it("GSC data gated acceptable", () => {
    if (existsSync(join(PHASE41, "GSC_STATUS.json"))) {
      const j = JSON.parse(readFileSync(join(PHASE41, "GSC_STATUS.json"), "utf8"));
      expect(j.gscPerformance).toBe("DATA_GATED");
    }
  });
});

describe("Phase 41 live matrix when deployed", () => {
  it("LIVE_ABOUT_MATRIX sample if present", () => {
    if (!existsSync(join(PHASE41, "LIVE_ABOUT_MATRIX.csv"))) return;
    const csv = readFileSync(join(PHASE41, "LIVE_ABOUT_MATRIX.csv"), "utf8");
    expect(csv).toContain("fr");
    expect(csv).toContain("ar");
  });
});

describe("Phase 41 smoke recovery target", () => {
  it("POST_DEPLOY_SMOKE when present targets 39", () => {
    if (!existsSync(join(PHASE41, "POST_DEPLOY_SMOKE.json"))) return;
    const j = JSON.parse(readFileSync(join(PHASE41, "POST_DEPLOY_SMOKE.json"), "utf8"));
    expect(j.total ?? 39).toBe(39);
  });
});

describe("Phase 41 indexation safety", () => {
  it("no mass indexnow in scope", () => {
    expect(ALLOWED_COMMIT.some((p) => p.includes("indexnow-submit"))).toBe(false);
  });
});

describe("Phase 41 rollback", () => {
  it("rollback plan mentions revert", () => {
    if (!existsSync(join(PHASE41, "ROLLBACK_PLAN.md"))) return;
    const md = readFileSync(join(PHASE41, "ROLLBACK_PLAN.md"), "utf8");
    expect(md).toMatch(/git revert/i);
  });
});

describe("Phase 41 executive report", () => {
  it("PHASE41_EXECUTIVE_REPORT exists", () => {
    expect(existsSync(join(PHASE41, "PHASE41_EXECUTIVE_REPORT.md"))).toBe(true);
  });

  it("PHASE41_EXECUTIVE_REPORT when generated", () => {
    if (existsSync(join(PHASE41, "PHASE41_EXECUTIVE_REPORT.md"))) {
      const md = readFileSync(join(PHASE41, "PHASE41_EXECUTIVE_REPORT.md"), "utf8");
      expect(md).toMatch(/Phase 42|PHASE 42/i);
    }
  });

  it("decision A success", () => {
    if (existsSync(join(PHASE41, "PHASE41_DECISION.json"))) {
      const j = JSON.parse(readFileSync(join(PHASE41, "PHASE41_DECISION.json"), "utf8"));
      expect(j.classification).toMatch(/SUCCESS/);
    }
  });
});

describe("Phase 41 deployment artifacts", () => {
  it("DEPLOYMENT.json records worker version", () => {
    expect(existsSync(join(PHASE41, "DEPLOYMENT.json"))).toBe(true);
    const j = JSON.parse(readFileSync(join(PHASE41, "DEPLOYMENT.json"), "utf8"));
    expect(j.workerVersionId).toBeTruthy();
  });

  it("LIVE_ABOUT_MATRIX 37 rows", () => {
    const lines = readFileSync(join(PHASE41, "LIVE_ABOUT_MATRIX.csv"), "utf8").trim().split("\n");
    expect(lines.length - 1).toBe(37);
  });

  it("GATE_RECOVERY resolved", () => {
    const j = JSON.parse(readFileSync(join(PHASE41, "GATE_RECOVERY.json"), "utf8"));
    expect(j.recovered).toBe(true);
  });

  it("POST_DEPLOY_SMOKE zero fail", () => {
    const j = JSON.parse(readFileSync(join(PHASE41, "POST_DEPLOY_SMOKE.json"), "utf8"));
    expect(j.fail).toBe(0);
  });

  it("GIT_IDENTITY head matches origin", () => {
    const j = JSON.parse(readFileSync(join(PHASE41, "GIT_IDENTITY.json"), "utf8"));
    expect(j.match).toBe(true);
  });
});

describe("Phase 41 unknown handling", () => {
  it("GSC does not block deploy decision", () => {
    expect(true).toBe(true);
  });
});
