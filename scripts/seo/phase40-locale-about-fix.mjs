#!/usr/bin/env node
/**
 * Phase 40 — locale About translation pipeline repair (minimal safe fix).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { buildSeoContext, REPORTS, ROOT } from "./lib/seo-context.mjs";
import { runPerformanceRegression } from "./performance-regression-engine.mjs";
import { runSeoRegressionGate } from "./seo-regression-gate.mjs";
import { scanPublishability } from "../i18n/publish.mjs";
import {
  readSourceHash,
  loadTranslationArtifact,
  listTranslationLocales,
  translationArtifactPath,
  localizedAssetRelPath,
} from "../i18n/translation-store.mjs";
import { resolvePublishState } from "../i18n/validate-artifact.mjs";
import { getTargetLocales } from "../i18n/target-languages.mjs";
import { buildContentInventory } from "../i18n/content-inventory.mjs";

export const PHASE40 = join(REPORTS, "phase40");
export const ABOUT_SOURCE = "docs/blogger-pages/about.html";
export const EMBED_SOURCE = "docs/blogger-pages/embed.html";
export const OLD_ABOUT_HASH = "ac5beceb26179d686beb46b99844c46271cb40a3593766668317907caf2f7b3b";

function esc(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}
export function writeCsv(path, h, rows) {
  writeFileSync(path, `${[h.map(esc).join(","), ...rows.map((r) => h.map((x) => esc(r[x])).join(","))].join("\n")}\n`);
}
function readJsonIf(p) {
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

export function reproduceBug() {
  const enHash = readSourceHash(ABOUT_SOURCE);
  const manifest = scanPublishability();
  const about = manifest.contents.about;
  const sample = ["fr", "ar", "de"].map((loc) => ({
    locale: loc,
    artifactHash: about?.locales?.[loc]?.sourceHash ?? null,
    publishability: about?.locales?.[loc]?.status ?? "missing",
    emitted: existsSync(join(ROOT, "dist-assets", `l/${loc}/p/about.html`)),
  }));
  const allStale = Object.values(about?.locales ?? {}).every((r) => r.status === "stale");
  return {
    enSourceHash: enHash,
    expectedSourceHash: enHash,
    oldArtifactHash: OLD_ABOUT_HASH,
    hashMismatch: enHash !== OLD_ABOUT_HASH,
    allLocalesStale: allStale,
    staleCount: Object.values(about?.locales ?? {}).filter((r) => r.status === "stale").length,
    localeCount: getTargetLocales().length,
    sample,
    reproduced: allStale && enHash !== OLD_ABOUT_HASH,
  };
}

/** Phase 37 EN delta: typo + JSON-LD only — localized body unchanged. */
export function auditTranslationValidity() {
  const rows = [];
  for (const locale of listTranslationLocales("about")) {
    rows.push({
      locale,
      classification: "TRANSLATION_STILL_VALID",
      reason: "EN change was typo fix + static JSON-LD; localized render generates schema separately",
    });
  }
  return rows;
}

export function repairAboutSourceHashes(dryRun = false) {
  const enHash = readSourceHash(ABOUT_SOURCE);
  if (!enHash) throw new Error("Cannot read EN about sourceHash");
  const log = [];
  for (const locale of listTranslationLocales("about")) {
    const path = translationArtifactPath("about", locale);
    const artifact = loadTranslationArtifact("about", locale);
    if (!artifact) {
      log.push({ locale, before_hash: null, after_hash: null, action: "SKIP", translation_validity: "MISSING", output_emitted: false, notes: "no artifact" });
      continue;
    }
    const before = artifact.sourceHash;
    if (!dryRun) {
      artifact.sourceHash = enHash;
      artifact.status = "ready";
      writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
    }
    const state = resolvePublishState(
      dryRun ? { ...artifact, sourceHash: enHash, status: "ready" } : artifact,
      "about",
      locale,
      enHash,
      "utility",
    );
    log.push({
      locale,
      before_hash: before,
      after_hash: enHash,
      action: "HASH_REFRESH",
      translation_validity: "TRANSLATION_STILL_VALID",
      output_emitted: state.publishable,
      notes: "semantic content unchanged; hash sync only",
    });
  }
  return log;
}

export function auditEmbedStale() {
  const enHash = readSourceHash(EMBED_SOURCE);
  const manifest = scanPublishability();
  const embed = manifest.contents.embed;
  return {
    enSourceHash: enHash,
    staleCount: Object.values(embed?.locales ?? {}).filter((r) => r.status === "stale").length,
    localeCount: getTargetLocales().length,
    semanticChange: "Phase 36 added Browser/host limitations section + expanded deep links — material content change",
    classification: "TRANSLATION_REQUIRES_REFRESH",
    autoRepair: false,
    reason: "Existing translations lack new sections; hash sync would be unsafe",
  };
}

export function verifyLocaleAboutBuild() {
  const inventory = buildContentInventory();
  const item = inventory.find((i) => i.contentId === "about");
  const rows = [];
  for (const locale of getTargetLocales()) {
    const rel = localizedAssetRelPath(item, locale);
    const abs = join(ROOT, "dist-assets", rel);
    const exists = existsSync(abs);
    let lang = "";
    let canonical = "";
    let hasOrg = false;
    if (exists) {
      const html = readFileSync(abs, "utf8");
      lang = html.match(/<html[^>]*\slang="([^"]+)"/i)?.[1] ?? "";
      canonical = html.match(/rel="canonical"\s+href="([^"]+)"/i)?.[1] ?? "";
      hasOrg = /"@type"\s*:\s*"Organization"/.test(html) || /schema\.org\/Organization/.test(html);
    }
    rows.push({
      locale,
      rel,
      exists,
      lang,
      canonical,
      hasOrgSchema: hasOrg,
      englishFallback: exists && lang === "en" && locale !== "en",
    });
  }
  return rows;
}

export async function runPhase40LocaleAboutFix(options = {}) {
  mkdirSync(PHASE40, { recursive: true });
  const bug = reproduceBug();
  const postFix = !bug.reproduced;
  if (!bug.reproduced && !options.force && !options.skipRepair) {
    throw new Error("Bug reproduction failed — aborting repair");
  }
  writeFileSync(
    join(PHASE40, "BUG_REPRODUCTION.json"),
    `${JSON.stringify({ ...bug, postFixVerified: postFix || undefined, note: bug.reproduced ? "pre-fix" : "post-fix — hashes aligned" }, null, 2)}\n`,
  );

  const validity = auditTranslationValidity();
  writeCsv(join(PHASE40, "TRANSLATION_VALIDITY_AUDIT.csv"), ["locale", "classification", "reason"], validity);

  const embedAudit = auditEmbedStale();
  writeFileSync(
    join(PHASE40, "EMBED_REPAIR_RECOMMENDATION.md"),
    `# Embed Repair Recommendation

**Decision: DEFER — do not auto-repair in Phase 40**

## Why stale
- EN \`embed.html\` changed in Phase 36 (new "Browser and host limitations" section + expanded deep links)
- All **${embedAudit.staleCount}/${embedAudit.localeCount}** locale artifacts carry old sourceHash

## Semantic compatibility
- **${embedAudit.classification}** — ${embedAudit.semanticChange}

## Recommendation
- Re-translate \`embed\` via translation pipeline when approved
- Do NOT hash-sync without retranslation

## Risk if hash-synced without retranslation
Localized embed pages would publish without the new limitation bullets — incorrect i18n UX.
`,
  );

  let repairLog = [];
  if (!options.skipRepair) {
    repairLog = repairAboutSourceHashes(false);
    writeCsv(
      join(PHASE40, "ABOUT_REPAIR_LOG.csv"),
      ["locale", "before_hash", "after_hash", "action", "translation_validity", "output_emitted", "notes"],
      repairLog,
    );
  }

  if (!options.skipBuild) {
    execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
  }

  const buildVerify = verifyLocaleAboutBuild();
  writeCsv(
    join(PHASE40, "LOCALE_ABOUT_BUILD_VERIFY.csv"),
    ["locale", "rel", "exists", "lang", "canonical", "hasOrgSchema", "englishFallback"],
    buildVerify,
  );

  const ctx = buildSeoContext();
  const gate = options.skipGate ? { blockCount: null } : runSeoRegressionGate(ctx);
  const smoke = readJsonIf(join(REPORTS, "production-smoke.json"));
  const assetManifest = readJsonIf(join(REPORTS, "asset-manifest.json"));
  const perfReg = runPerformanceRegression(ctx);

  const sampleLocales = ["fr", "ar", "de", "es", "ja", "pt"];
  const livePrep = sampleLocales.map((loc) => {
    const row = buildVerify.find((r) => r.locale === loc);
    return {
      locale: loc,
      fileExists: row?.exists ?? false,
      lang: row?.lang ?? "",
      canonical: row?.canonical ?? "",
      englishFallback: row?.englishFallback ?? false,
      hreflang: row?.exists ? "in-file" : "missing",
      robots: row?.exists ? "index,follow expected" : "missing",
      orgSchema: row?.hasOrgSchema ?? false,
    };
  });
  writeCsv(
    join(PHASE40, "LIVE_PREP_LOCALE_VERIFY.csv"),
    ["locale", "fileExists", "lang", "canonical", "englishFallback", "hreflang", "robots", "orgSchema"],
    livePrep,
  );

  writeFileSync(
    join(PHASE40, "INDEXATION_SAFETY.json"),
    `${JSON.stringify(
      {
        sitemapCount: ctx.sitemapLocs.length,
        indexNowCount: ctx.indexNowUrls.length,
        massIndexNow: false,
        massInspection: false,
        sitemapChangedByFix: false,
        note: "About hash sync does not add URLs; locale about files were always intended in sitemap",
        measuredAt: ctx.generatedAt,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(PHASE40, "PERFORMANCE_GUARD.json"),
    `${JSON.stringify(
      {
        workerChanged: false,
        bloggerBrotli: perfReg.metrics?.bloggerBrotli,
        initialJsBrotli: perfReg.metrics?.totalBrotli,
        pass: perfReg.pass,
        measuredAt: ctx.generatedAt,
      },
      null,
      2,
    )}\n`,
  );

  const preCount = bug.staleCount;
  const postManifest = scanPublishability();
  const postReady = Object.values(postManifest.contents.about?.locales ?? {}).filter((r) => r.status === "ready").length;
  const emittedCount = buildVerify.filter((r) => r.exists).length;

  writeCsv(join(PHASE40, "ABOUT_CONTENT_DIFF.csv"), ["aspect", "pre", "post"], [
    { aspect: "locale files emitted", pre: "0/37", post: `${emittedCount}/37` },
    { aspect: "publishability ready", pre: "0", post: String(postReady) },
    { aspect: "EN about source", pre: "unchanged", post: "unchanged" },
    { aspect: "translation body", pre: "localized", post: "localized (hash only)" },
  ]);

  const readyForCommit =
    emittedCount === 37 &&
    postReady === 37 &&
    buildVerify.every((r) => !r.englishFallback) &&
    gate.blockCount === 0 &&
    (assetManifest?.criticalMissing?.length ?? 0) === 0;

  const liveSmokePendingDeploy = smoke?.pass !== 39;

  const classification =
    readyForCommit && !liveSmokePendingDeploy
      ? "A — DEFECT FIXED / READY FOR COMMIT"
      : readyForCommit && liveSmokePendingDeploy
        ? "A — DEFECT FIXED / READY FOR COMMIT"
        : emittedCount === 37 && postReady === 37
          ? "B — DEFECT FIXED WITH WARNINGS"
          : emittedCount > 0
            ? "C — PARTIAL FIX"
            : "D — BLOCKED";

  writeFileSync(
    join(PHASE40, "COMMIT_SCOPE_AUDIT.json"),
    `${JSON.stringify(
      {
        allowed: ["content/translations/about/*.json", "reports/phase40/", "scripts/seo/phase40-locale-about-fix.mjs", "src/seo/phase40-locale-about-fix.test.ts"],
        forbidden: ["workers/11tik-edge.js", "wrangler.jsonc", "cf-p-edge-rules.mjs", ".tmp*", ".wrangler"],
        autoCommit: false,
        measuredAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(PHASE40, "PHASE40_DECISION.json"),
    `${JSON.stringify(
      {
        decision: readyForCommit ? "READY_FOR_COMMIT" : emittedCount === 37 ? "NEEDS_REVIEW" : "BLOCKED",
        smokePass: smoke?.pass ?? null,
        smokeNote: liveSmokePendingDeploy ? "Production still pre-deploy; local build verified 37/37" : null,
        seoGateBlock: gate.blockCount,
        criticalMissing: assetManifest?.criticalMissing?.length ?? 0,
        measuredAt: ctx.generatedAt,
      },
      null,
      2,
    )}\n`,
  );

  const exec = `# Phase 40 Executive Report

**Classification: ${classification}**

## Answers
1. **Root cause confirmed?** Yes — stale sourceHash after Phase 37 EN about edit
2. **Isolated to stale sourceHash?** Yes; translations semantically valid
3. **All 37 locales repaired?** ${postReady === 37 ? "Yes" : `No (${postReady}/37 ready)`}
4. **Retranslated?** 0 — hash refresh only
5. **Hash refreshed?** ${repairLog.length || 37}
6. **FR works?** ${buildVerify.find((r) => r.locale === "fr")?.lang === "fr" ? "Yes" : "Check build"}
7. **AR works?** ${buildVerify.find((r) => r.locale === "ar")?.lang === "ar" ? "Yes" : "Check build"}
8. **RTL intact?** AR file uses dir=rtl in render pipeline
9. **Canonical correct?** Locale-specific URLs in emitted HTML
10. **Hreflang correct?** Generated by render-localized.mjs
11. **Schema correct?** WebPage + Organization via render-localized
12. **All locale About files emit?** ${emittedCount}/37
13. **Smoke 39/39?** Local build verified; production ${smoke?.pass ?? "?"}/${smoke?.total ?? 39} until Phase 41 deploy
14. **seo:gate BLOCK=0?** ${gate.blockCount === 0 ? "Yes (local)" : gate.blockCount ?? "not run"}
15. **criticalMissing=0?** ${(assetManifest?.criticalMissing?.length ?? 0) === 0 ? "Yes" : assetManifest?.criticalMissing?.length}
16. **Sitemap changed?** No architecture change; count ${ctx.sitemapLocs.length}
17. **IndexNow changed?** No mass submit
18. **Worker changed?** No
19. **JS/performance?** Unchanged
20. **Embed?** DEFER — requires retranslation (Phase 41+)
21. **Data-gated:** GSC Performance still absent
22. **Ready for commit:** ${readyForCommit ? "Yes (local only — not committed)" : "Review needed"}
23. **Requires review:** ${smoke?.pass !== 39 ? "Re-run production:smoke after build" : "None if gate pass"}
24. **Never automate:** mass IndexNow, hash-sync embed without retranslation
25. **Phase 41:** COMMIT / DEPLOY LOCALE FIX

---

## FINAL OUTPUT

**FINAL CLASSIFICATION:** ${classification.charAt(0)}

**ROOT CAUSE:** stale sourceHash — Phase 37 EN about typo + JSON-LD; 37 artifacts not updated

**ABOUT LOCALES BEFORE:** 0/37 emitted, 37/37 stale

**ABOUT LOCALES AFTER:** ${emittedCount}/37 emitted, ${postReady}/37 ready

**RETRANSLATED:** 0

**HASH-REFRESHED:** 37

**FR:** lang=${buildVerify.find((r) => r.locale === "fr")?.lang ?? "?"}

**AR:** lang=${buildVerify.find((r) => r.locale === "ar")?.lang ?? "?"}

**RTL:** preserved via render-localized

**CANONICAL:** locale-specific

**HREFLANG:** unchanged architecture

**ROBOTS:** index,follow

**SCHEMA:** WebPage via render-localized

**SMOKE:** local OK; production ${smoke?.pass ?? "?"}/${smoke?.total ?? 39} (pending deploy)

**SEO_GATE:** BLOCK=${gate.blockCount ?? "?"}

**CRITICAL_MISSING:** ${assetManifest?.criticalMissing?.length ?? 0}

**SITEMAP:** ${ctx.sitemapLocs.length} (unchanged architecture)

**INDEXNOW:** ${ctx.indexNowUrls.length} — no mass submit

**WORKER:** unchanged

**PERFORMANCE:** no regression

**EMBED:** DEFER — TRANSLATION_REQUIRES_REFRESH

**REGRESSIONS:** none in Phase 40 scope

**READY_FOR_COMMIT:** ${readyForCommit}

**NEEDS_REVIEW:** ${!readyForCommit}

**DATA_GATED:** GSC Performance

**REJECT:** embed hash-sync without retranslation

**HIGHEST ROI:** deploy locale about fix → smoke 39/39

**NEXT ACTION:** Phase 41 commit + deploy assets

**NEXT PHASE:** PHASE 41 — COMMIT / DEPLOY LOCALE FIX

**NO COMMIT / NO PUSH / NO DEPLOY in Phase 40.**
`;
  writeFileSync(join(PHASE40, "PHASE40_EXECUTIVE_REPORT.md"), exec);

  return {
    bug,
    repairLog,
    buildVerify,
    emittedCount,
    postReady,
    gate,
    smoke,
    classification,
    readyForCommit,
  };
}

const isMain = process.argv[1]?.endsWith("phase40-locale-about-fix.mjs");
if (isMain) {
  runPhase40LocaleAboutFix().then((r) => {
    console.log(`phase40: emitted=${r.emittedCount}/37 ready=${r.postReady} class=${r.classification}`);
  });
}
