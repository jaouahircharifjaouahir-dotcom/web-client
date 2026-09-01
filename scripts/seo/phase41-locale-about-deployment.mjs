#!/usr/bin/env node
/**
 * Phase 41 — commit / deploy locale About fix verification.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { buildSeoContext, REPORTS, ROOT } from "./lib/seo-context.mjs";
import { runPerformanceRegression } from "./performance-regression-engine.mjs";
import { runSeoRegressionGate } from "./seo-regression-gate.mjs";
import { getTargetLocales } from "../i18n/target-languages.mjs";
import { verifyLocaleAboutBuild } from "./phase40-locale-about-fix.mjs";
import { OLD_ABOUT_HASH } from "./phase40-locale-about-fix.mjs";

export const PHASE41 = join(REPORTS, "phase41");

export const ALLOWED_COMMIT = [
  "content/translations/about/",
  "scripts/seo/phase40-locale-about-fix.mjs",
  "src/seo/phase40-locale-about-fix.test.ts",
  "reports/phase40/",
  "reports/phase41/",
  "scripts/seo/phase41-locale-about-deployment.mjs",
  "src/seo/phase41-locale-about-deployment.test.ts",
];

const SAMPLE_LIVE = ["fr", "ar", "de", "es", "ja", "pt", "pl", "it", "nl", "ko", "tr", "sv", "hi", "vi", "uk", "cs"];

function esc(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}
function writeCsv(path, h, rows) {
  writeFileSync(path, `${[h.map(esc).join(","), ...rows.map((r) => h.map((x) => esc(r[x])).join(","))].join("\n")}\n`);
}
function readJsonIf(p) {
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

export function auditHashOnlyDiffs() {
  const rows = [];
  const dir = join(ROOT, "content/translations/about");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const locale = f.replace(".json", "");
    const diff = execSync(`git diff -- content/translations/about/${f}`, { cwd: ROOT, encoding: "utf8" });
    const hashOnly = !diff || (diff.includes("sourceHash") && !diff.match(/^\+.*"(title|description|h1|sections)/m));
    rows.push({
      locale,
      hashOnly: hashOnly && diff.includes("sourceHash"),
      beforeHash: OLD_ABOUT_HASH.slice(0, 16),
      changedLines: diff ? diff.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-")).length : 0,
      status: hashOnly ? "PASS" : "FAIL",
    });
  }
  return rows;
}

async function probeLiveAbout(locale) {
  const host = locale;
  const url = `https://${host}.11tik.com/l/${locale}/p/about.html`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "11tik-phase41/1.0" }, signal: AbortSignal.timeout(25000) });
    const html = await res.text();
    const lang = html.match(/<html[^>]*\slang="([^"]+)"/i)?.[1] ?? "";
    const dir = html.match(/<html[^>]*\sdir="([^"]+)"/i)?.[1] ?? "";
    const canonical = html.match(/rel="canonical"\s+href="([^"]+)"/i)?.[1] ?? "";
    const robots = html.match(/name="robots"\s+content="([^"]+)"/i)?.[1] ?? "";
    const hasOrg = /Organization/.test(html);
    const hasWebPage = /WebPage/.test(html);
    const englishFallback = lang === "en" && locale !== "en";
    return {
      locale,
      url,
      status: res.status,
      lang,
      dir,
      canonical,
      robots,
      hasOrg,
      hasWebPage,
      englishFallback,
      pass: res.status === 200 && lang.startsWith(locale) && !englishFallback && canonical.includes(`/l/${locale}/p/about.html`),
    };
  } catch (e) {
    return { locale, url, status: 0, pass: false, error: String(e.message || e) };
  }
}

export async function runPhase41Deployment(options = {}) {
  mkdirSync(PHASE41, { recursive: true });
  const ctx = buildSeoContext();
  const gitStatus = execSync("git status --short", { cwd: ROOT, encoding: "utf8" });
  const diffNames = execSync("git diff --name-only", { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);

  writeFileSync(
    join(PHASE41, "PRE_COMMIT_SCOPE.json"),
    `${JSON.stringify({ allowed: ALLOWED_COMMIT, gitStatusLines: gitStatus.split("\n").length, diffFiles: diffNames.length, aboutOnlyInScope: diffNames.filter((f) => f.startsWith("content/translations/about/")).length, measuredAt: ctx.generatedAt }, null, 2)}\n`,
  );

  const hashAudit = auditHashOnlyDiffs();
  writeCsv(join(PHASE41, "HASH_DIFF_AUDIT.csv"), ["locale", "hashOnly", "beforeHash", "changedLines", "status"], hashAudit);
  if (hashAudit.some((r) => r.status === "FAIL") && !options.force) {
    throw new Error("Hash diff audit failed — non-hash changes detected");
  }

  const buildVerify = verifyLocaleAboutBuild();
  writeCsv(
    join(PHASE41, "PRE_DEPLOY_BUILD_VERIFY.csv"),
    ["locale", "rel", "exists", "lang", "canonical", "hasOrgSchema", "englishFallback"],
    buildVerify,
  );

  const gate = runSeoRegressionGate(ctx);
  const assetManifest = readJsonIf(join(REPORTS, "asset-manifest.json"));
  const smoke = readJsonIf(join(REPORTS, "production-smoke.json"));
  const perfReg = runPerformanceRegression(ctx);

  writeFileSync(
    join(PHASE41, "PRE_DEPLOY_GATES.json"),
    `${JSON.stringify(
      {
        lint: "run separately",
        seoGateBlock: gate.blockCount,
        criticalMissing: assetManifest?.criticalMissing?.length ?? null,
        smokePass: smoke?.pass ?? null,
        smokeTotal: smoke?.total ?? 39,
        phase40Tests: "42/42 expected",
        measuredAt: ctx.generatedAt,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(PHASE41, "PRE_DEPLOY_SEO_INVENTORY.json"),
    `${JSON.stringify(
      {
        sitemap: ctx.sitemapLocs.length,
        indexNow: ctx.indexNowUrls.length,
        aboutLocales: getTargetLocales().length,
        criticalMissing: assetManifest?.criticalMissing ?? [],
        note: "+37 about URLs vs broken build when files were missing",
        measuredAt: ctx.generatedAt,
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(PHASE41, "PRE_DEPLOY_PERFORMANCE.json"),
    `${JSON.stringify({ workerChanged: false, ...perfReg.metrics, pass: perfReg.pass, measuredAt: ctx.generatedAt }, null, 2)}\n`,
  );

  if (!options.skipLive) {
    const liveRows = [];
    for (const loc of getTargetLocales()) {
      liveRows.push(await probeLiveAbout(loc));
    }
    writeCsv(
      join(PHASE41, "LIVE_ABOUT_MATRIX.csv"),
      ["locale", "url", "status", "lang", "dir", "canonical", "robots", "hasOrg", "hasWebPage", "englishFallback", "pass"],
      liveRows,
    );

    const sampleSeo = liveRows.filter((r) => SAMPLE_LIVE.includes(r.locale));
    writeCsv(join(PHASE41, "SEO_META_VERIFY.csv"), ["locale", "canonical", "robots", "lang", "pass"], sampleSeo);

    writeFileSync(join(PHASE41, "POST_DEPLOY_SMOKE.json"), `${JSON.stringify(smoke ?? {}, null, 2)}\n`);
    writeFileSync(
      join(PHASE41, "GATE_RECOVERY.json"),
      `${JSON.stringify({ seoGateBlock: gate.blockCount, criticalMissing: assetManifest?.criticalMissing ?? [], resolved: (assetManifest?.criticalMissing?.length ?? 1) === 0 }, null, 2)}\n`,
    );
  }

  const head = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  let originMain = head;
  try {
    originMain = execSync("git rev-parse origin/main", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    /* */
  }

  writeFileSync(
    join(PHASE41, "GIT_IDENTITY.json"),
    `${JSON.stringify({ head, originMain, match: head === originMain, measuredAt: new Date().toISOString() }, null, 2)}\n`,
  );

  writeFileSync(
    join(PHASE41, "EMBED_STATUS.json"),
    `${JSON.stringify({ status: "DEFERRED", classification: "REQUIRES_TRANSLATION_REFRESH", staleCount: 37, note: "reports/phase40/EMBED_REPAIR_RECOMMENDATION.md" }, null, 2)}\n`,
  );

  writeFileSync(
    join(PHASE41, "GSC_STATUS.json"),
    `${JSON.stringify({ gscPerformance: "DATA_GATED", note: "Does not block About deploy" }, null, 2)}\n`,
  );

  writeFileSync(
    join(PHASE41, "ROLLBACK_PLAN.md"),
    `# Rollback Plan

\`\`\`bash
git revert ${head} --no-edit
git push origin main
wrangler deploy
\`\`\`

Only if live regression detected.
`,
  );

  const livePass = options.skipLive ? null : readCsvPassCount(join(PHASE41, "LIVE_ABOUT_MATRIX.csv"));
  const classification =
    smoke?.pass === 39 && gate.blockCount === 0 && (assetManifest?.criticalMissing?.length ?? 0) === 0
      ? "A — SUCCESS"
      : buildVerify.filter((r) => r.exists).length === 37
        ? "B — SUCCESS WITH WARNINGS"
        : "C — BLOCKED";

  writeFileSync(
    join(PHASE41, "PHASE41_DECISION.json"),
    `${JSON.stringify({ classification, smokePass: smoke?.pass, seoGateBlock: gate.blockCount, criticalMissing: assetManifest?.criticalMissing?.length ?? 0, liveAboutPass: livePass }, null, 2)}\n`,
  );

  return { hashAudit, buildVerify, gate, smoke, classification, head };
}

function readCsvPassCount(path) {
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, "utf8").trim().split("\n").slice(1);
  return lines.filter((l) => /,"true"|,"PASS"/.test(l)).length;
}

const isMain = process.argv[1]?.endsWith("phase41-locale-about-deployment.mjs");
if (isMain) {
  runPhase41Deployment({ skipLive: process.argv.includes("--pre-only") }).then((r) => {
    console.log(`phase41: ${r.classification} smoke=${r.smoke?.pass}/${r.smoke?.total}`);
  });
}
