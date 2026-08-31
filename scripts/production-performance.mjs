#!/usr/bin/env node
/**
 * Lightweight production performance probe (Phase 12D).
 * Does NOT crawl the sitemap. Keeps Worker-invoking HTML probes small.
 *
 * Usage:
 *   npm run production:performance
 *   npm run production:performance -- --samples=5
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants as zlibConstants } from "node:zlib";
import baseline from "../src/seo/performance-baseline.json" with { type: "json" };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://www.11tik.com";
const REPORT_DIR = join(ROOT, "reports");
const REPORT_PATH = join(REPORT_DIR, "production-performance.json");

const samplesArg = process.argv.find((a) => a.startsWith("--samples="));
const SAMPLES = Math.max(3, Math.min(9, Number(samplesArg?.split("=")[1] || 5)));

/** Worker-invoking or HTML shells (cap scheduled volume). */
const HTML_PROBES = [
  { id: "home", path: "/", group: "workerish" },
  { id: "about", path: "/p/about.html", group: "asset" },
  { id: "article", path: "/2026/08/how-to-download-youtube-thumbnail.html", group: "asset" },
  { id: "fr-home", path: "/l/fr/", group: "workerish" },
  { id: "fr-about", path: "/l/fr/p/about.html", group: "asset" },
];

/** Static assets — may be probed more freely (no Worker code path when HIT). */
const ASSET_PROBES = [
  { id: "blogger-app", path: "/web-client/blogger-app.js", group: "asset" },
  { id: "ui-fr", path: "/web-client/i18n/ui/fr.json", group: "asset" },
  { id: "favicon", path: "/web-client/icons/favicon-32.png", group: "asset" },
  {
    id: "hero-webp",
    path: "/web-client/images/blog/youtube-thumbnail-download-workflow.webp",
    group: "asset",
  },
];

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function probeOnce(url) {
  const started = performance.now();
  const res = await fetch(url, {
    redirect: "manual",
    headers: {
      "cache-control": "no-cache",
      "user-agent": "11tik-production-performance/12D",
    },
  });
  const ttfbMs = Math.round(performance.now() - started);
  const buf = Buffer.from(await res.arrayBuffer());
  const headers = {
    contentType: res.headers.get("content-type"),
    contentEncoding: res.headers.get("content-encoding"),
    contentLength: res.headers.get("content-length"),
    cacheControl: res.headers.get("cache-control"),
    cfCacheStatus: res.headers.get("cf-cache-status"),
  };
  let brotliBytes = null;
  if (url.includes("blogger-app.js")) {
    brotliBytes = brotliCompressSync(buf, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
    }).length;
  }
  return {
    status: res.status,
    redirect: res.status >= 300 && res.status < 400 ? res.headers.get("location") : null,
    bytes: buf.length,
    brotliBytes,
    ttfbMs,
    headers,
  };
}

async function probeUrl(entry) {
  const url = `${ORIGIN}${entry.path}`;
  const runs = [];
  for (let i = 0; i < SAMPLES; i++) {
    try {
      runs.push(await probeOnce(url));
    } catch (err) {
      runs.push({ error: String(err?.message || err), ttfbMs: null, status: 0 });
    }
  }
  const ok = runs.filter((r) => r.status >= 200 && r.status < 400);
  const ttfbs = ok.map((r) => r.ttfbMs).filter((n) => typeof n === "number").sort((a, b) => a - b);
  const last = runs[runs.length - 1] || {};
  return {
    id: entry.id,
    path: entry.path,
    group: entry.group,
    samples: SAMPLES,
    status: last.status ?? null,
    redirect: last.redirect ?? null,
    bytes: last.bytes ?? null,
    brotliBytes: last.brotliBytes ?? null,
    headers: last.headers ?? null,
    ttfb: {
      samples: ttfbs,
      medianMs: median(ttfbs),
      p95Ms: percentile(ttfbs, 95),
    },
    errors: runs.filter((r) => r.error).map((r) => r.error),
  };
}

function evaluate(results) {
  const alerts = [];
  const blogger = results.find((r) => r.id === "blogger-app");
  if (blogger?.status !== 200) {
    alerts.push({ severity: "CRITICAL", code: "core_js_missing", detail: "blogger-app.js not 200" });
  }
  if (blogger?.brotliBytes != null && blogger.brotliBytes > baseline.javascript.budgets.bloggerAppBrotliFail) {
    alerts.push({
      severity: "CRITICAL",
      code: "initial_js_over_budget",
      detail: `blogger-app Brotli ${blogger.brotliBytes} > ${baseline.javascript.budgets.bloggerAppBrotliFail}`,
    });
  } else if (blogger?.brotliBytes != null && blogger.brotliBytes > baseline.javascript.budgets.bloggerAppBrotliWarn) {
    alerts.push({
      severity: "HIGH",
      code: "initial_js_warn",
      detail: `blogger-app Brotli ${blogger.brotliBytes} > warn ${baseline.javascript.budgets.bloggerAppBrotliWarn}`,
    });
  }
  const home = results.find((r) => r.id === "home");
  if (home?.status !== 200) {
    alerts.push({ severity: "CRITICAL", code: "homepage_non_200", detail: String(home?.status) });
  }
  const uiFr = results.find((r) => r.id === "ui-fr");
  if (uiFr?.status !== 200) {
    alerts.push({ severity: "HIGH", code: "fr_catalog_failure", detail: String(uiFr?.status) });
  }
  const hero = results.find((r) => r.id === "hero-webp");
  if (hero?.status !== 200) {
    alerts.push({ severity: "HIGH", code: "missing_webp", detail: String(hero?.status) });
  }
  return alerts;
}

async function main() {
  // Keep Worker-ish HTML probes <= 5 for scheduled use.
  const html = HTML_PROBES.slice(0, 5);
  const results = [];
  for (const entry of [...html, ...ASSET_PROBES]) {
    results.push(await probeUrl(entry));
  }

  const byGroup = {
    workerish: results.filter((r) => r.group === "workerish"),
    asset: results.filter((r) => r.group === "asset"),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    baselineCommit: baseline.baselineCommit,
    origin: ORIGIN,
    samplesPerUrl: SAMPLES,
    workerInvokingProbeCount: html.length,
    results,
    ttfbByGroup: {
      workerish: {
        medianMs: median(
          byGroup.workerish
            .map((r) => r.ttfb.medianMs)
            .filter((n) => typeof n === "number")
            .sort((a, b) => a - b),
        ),
        note: "Do not mix with asset TTFB.",
      },
      asset: {
        medianMs: median(
          byGroup.asset
            .map((r) => r.ttfb.medianMs)
            .filter((n) => typeof n === "number")
            .sort((a, b) => a - b),
        ),
        note: "Static asset probes; CF-Cache-Status is observational.",
      },
    },
    alerts: evaluate(results),
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("Production performance probe");
  console.log(`samples=${SAMPLES} workerishHtml=${html.length} assets=${ASSET_PROBES.length}`);
  for (const r of results) {
    console.log(
      `${r.id} ${r.status} bytes=${r.bytes ?? "-"} brotli=${r.brotliBytes ?? "-"} ttfb_med=${r.ttfb.medianMs ?? "-"}ms p95=${r.ttfb.p95Ms ?? "-"}ms cache=${r.headers?.cfCacheStatus ?? "-"}`,
    );
  }
  console.log(`alerts=${report.alerts.length}`);
  for (const a of report.alerts) console.log(`  [${a.severity}] ${a.code}: ${a.detail}`);
  console.log(`JSON report: ${REPORT_PATH}`);

  if (report.alerts.some((a) => a.severity === "CRITICAL")) process.exit(1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((err) => {
  console.error(err);
  process.exit(1);
});
