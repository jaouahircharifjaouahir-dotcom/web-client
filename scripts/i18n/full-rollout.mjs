#!/usr/bin/env node
/**
 * GTX-only multilingual rollout for TARGET_LANGUAGES (config/target-languages.json).
 * Resumable. Does NOT deploy/commit/push.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { loadDotEnv } from "./load-env.mjs";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";
import { scanPublishability, collectReadyLocaleLocs } from "./publish.mjs";
import {
  planTranslationWork,
  runFullTranslationRollout,
  validateAllArtifacts,
} from "./translate-pipeline.mjs";
import { providerConfigReport, readProviderEnv } from "./provider-config.mjs";
import { extensionPresent } from "../../translator/capture/gtx-client.mjs";
import { auditGeneratedFiles } from "./audit-generated.mjs";
import { scanInternalLinks } from "./validate-internal-links.mjs";
import { generateStaticSite } from "../generate-static-site.mjs";
import { parseSitemapLocs } from "../../workers/sitemap-canonicals.js";
import { RTL_CODES } from "../../workers/iso6391.js";
import {
  assertAllTargetsHaveGtxMapping,
  getTargetLocales,
  targetLanguageSummary,
} from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
loadDotEnv(join(ROOT, ".env"));
if (!process.env.TRANSLATE_ENABLED) process.env.TRANSLATE_ENABLED = "1";
if (!process.env.TRANSLATION_PROVIDER) process.env.TRANSLATION_PROVIDER = "chrome_gtx";

const STAGED = join(ROOT, "dist-assets");
const REPORT_PATH = join(ROOT, "tmp", "i18n-full-rollout-audit.json");

function parseArgs(argv) {
  const out = { translateOnly: false, generateOnly: false, skipTests: false };
  for (const arg of argv) {
    if (arg === "--translate-only") out.translateOnly = true;
    if (arg === "--generate-only") out.generateOnly = true;
    if (arg === "--skip-tests") out.skipTests = true;
    const m = /^--maxJobs=(\d+)$/.exec(arg);
    if (m) out.maxJobs = Number(m[1]);
  }
  return out;
}

function run(cmd) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.stderr || err.message || err).slice(0, 500) };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = readProviderEnv();
  const targetLocales = getTargetLocales();
  const targetSummary = targetLanguageSummary();
  assertAllTargetsHaveGtxMapping();

  const audit = {
    generatedAt: new Date().toISOString(),
    authorization: "target-languages-gtx-rollout",
    provider: providerConfigReport(env),
    targetLanguages: targetSummary,
  };

  const inventory = buildContentInventory();
  const localizable = localizableContent(inventory);

  audit.inventory = {
    contentItems: localizable.length,
    articles: localizable.filter((i) => i.type === "article").length,
    utilities: localizable.filter((i) => i.type === "utility").length,
    targetLocales: targetLocales.length,
    theoreticalLocalizedPages: localizable.length * targetLocales.length,
  };

  const planBefore = planTranslationWork({ inventory, locales: targetLocales });
  audit.before = {
    ready: planBefore.summary.ready,
    missing: planBefore.summary.missing,
    stale: planBefore.summary.stale,
    failed: planBefore.summary.failed,
    queued: planBefore.queue.length,
  };

  console.error(
    `[i18n] TARGET_LANGUAGES=${targetLocales.length} queued=${planBefore.queue.length} mode=${planBefore.rolloutMode} locale=${planBefore.queue[0]?.locale ?? "-"} concurrency=${env.concurrency}`,
  );

  if (!args.generateOnly) {
    if (env.provider !== "chrome_gtx") {
      audit.blocked = true;
      audit.blocker = "Requires TRANSLATION_PROVIDER=chrome_gtx";
      writeReport(audit);
      console.error(JSON.stringify(audit, null, 2));
      process.exit(1);
    }
    if (!extensionPresent()) {
      audit.blocked = true;
      audit.blocker = "translator/extension missing";
      writeReport(audit);
      console.error(JSON.stringify(audit, null, 2));
      process.exit(1);
    }

    const t0 = Date.now();
    const stats = await runFullTranslationRollout({
      inventory,
      env,
      locales: targetLocales,
      concurrency: env.concurrency,
      maxJobs: args.maxJobs ?? Infinity,
      onProgress: (p) => {
        if (p.stats.apiCalls % 4 === 0 || p.remaining === 0) {
          process.stderr.write(
            `[i18n] apiCalls=${p.stats.apiCalls} ok=${p.stats.succeeded} fail=${p.stats.failed} remaining=${p.remaining ?? "?"} locale=${p.stats.currentLocale ?? p.unit?.locale ?? "?"}\n`,
          );
        }
      },
    });
    audit.translation = {
      runtimeMs: Date.now() - t0,
      runtimeMinutes: Number(((Date.now() - t0) / 60000).toFixed(1)),
      ...stats,
    };
  }

  if (!args.translateOnly) {
    const g0 = Date.now();
    generateStaticSite(STAGED);
    audit.generation = { runtimeMs: Date.now() - g0, staged: STAGED };

    const manifest = scanPublishability(inventory);
    const files = auditGeneratedFiles(STAGED);
    const links = scanInternalLinks(manifest);
    const sitemapLocs = parseSitemapLocs(readFileSync(join(STAGED, "sitemap.xml"), "utf8"));
    const localeLocs = collectReadyLocaleLocs(manifest);

    audit.after = {
      ready: manifest.counts.ready,
      stale: manifest.counts.stale,
      missing: manifest.counts.missing,
      failed: manifest.counts.failed + manifest.counts.invalid,
      draft: manifest.counts.draft,
    };
    audit.generated = files;
    audit.internalLinks = links;
    audit.sitemap = {
      totalLocs: sitemapLocs.length,
      localizedLocs: localeLocs.length,
      englishLocs: sitemapLocs.length - localeLocs.length,
    };
    audit.hreflang = { linkCount: files.hreflangLinks };
    audit.rtl = {
      pages: files.rtlPages,
      locales: targetLocales.filter((l) => RTL_CODES.has(l)).length,
    };
    audit.artifacts = validateAllArtifacts(inventory, targetLocales);
  }

  if (!args.skipTests && !args.translateOnly) {
    audit.tests = {
      lint: run("npm run lint"),
      typecheck: run("npm run typecheck"),
      test: run("npm test"),
    };
  }

  audit.architecture = {
    workerZero: true,
    urlPattern: "https://{lang}.11tik.com/l/{lang}{canonicalPath}",
    provider: "chrome_gtx",
    targetManifest: "config/target-languages.json",
  };

  audit.finalStatus =
    audit.after?.ready === audit.inventory.theoreticalLocalizedPages
      ? "TARGET LANGUAGE ROLLOUT COMPLETE"
      : "TARGET LANGUAGE ROLLOUT INCOMPLETE";

  writeReport(audit);
  console.log(JSON.stringify(audit, null, 2));
  console.log(`\nWrote ${REPORT_PATH}`);
}

function writeReport(audit) {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
