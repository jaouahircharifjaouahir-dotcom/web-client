#!/usr/bin/env node
/**
 * Production smoke test — live HTTP checks against 11tik.com.
 * Usage:
 *   npm run production:smoke
 *   npm run production:smoke -- --subset=scheduled
 *   SMOKE_EXPECTED_SITEMAP_LOCS=1096 npm run production:smoke
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUEST_TIMEOUT_MS,
  REDIRECT_MAX_HOPS,
  SMOKE_USER_AGENT,
  buildSmokeCases,
  evaluateSmokeCase,
  filterSmokeCases,
  resolveGitSha,
  scheduledSmokeCaseIds,
  smokeOrigins,
} from "./production-smoke-lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_DIR = join(ROOT, "reports");
const REPORT_PATH = join(REPORT_DIR, "production-smoke.json");

function parseArgs(argv) {
  const out = { subset: null, delayMs: 100 };
  for (const arg of argv) {
    if (arg.startsWith("--subset=")) out.subset = arg.slice("--subset=".length);
    if (arg.startsWith("--delay-ms=")) out.delayMs = Number(arg.slice("--delay-ms=".length)) || 100;
  }
  return out;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function headerRecord(res) {
  const out = {};
  for (const [k, v] of res.headers.entries()) out[k.toLowerCase()] = v;
  return out;
}

async function followRedirectChain(startUrl, { manualFirst = true } = {}) {
  const hops = [];
  let url = startUrl;
  for (let i = 0; i < REDIRECT_MAX_HOPS; i += 1) {
    const res = await fetchWithTimeout(url, {
      redirect: i === 0 && manualFirst ? "manual" : "follow",
      headers: { "User-Agent": SMOKE_USER_AGENT, "Cache-Control": "no-cache" },
    });
    hops.push({ url, status: res.status, location: res.headers.get("location") });
    if (res.status < 300 || res.status >= 400) {
      const body = res.status === 301 || res.status === 302 ? "" : await res.text();
      return { hops, final: res, body, headers: headerRecord(res) };
    }
    const next = res.headers.get("location");
    if (!next) break;
    url = new URL(next, url).href;
  }
  return { hops, error: `redirect chain exceeded ${REDIRECT_MAX_HOPS} hops` };
}

async function probeCase(testCase) {
  const started = Date.now();
  const result = {
    id: testCase.id,
    category: testCase.category,
    severity: testCase.severity,
    url: testCase.url,
    pass: true,
    block: [],
    warn: [],
    info: [],
    status: null,
    location: null,
    headers: {},
    durationMs: 0,
  };

  try {
    const redirectManual = Boolean(testCase.redirectManual);
    const res = await fetchWithTimeout(testCase.url, {
      redirect: redirectManual ? "manual" : "follow",
      headers: { "User-Agent": SMOKE_USER_AGENT, "Cache-Control": "no-cache" },
    });
    const headers = headerRecord(res);
    const body =
      redirectManual || testCase.status === 301 || testCase.status === 410 ? "" : await res.text();

    result.status = res.status;
    result.location = headers.location ?? null;
    result.headers = {
      "content-type": headers["content-type"] ?? null,
      "strict-transport-security": headers["strict-transport-security"] ?? null,
      "cf-cache-status": headers["cf-cache-status"] ?? null,
      "cache-control": headers["cache-control"] ?? null,
      "content-encoding": headers["content-encoding"] ?? null,
    };

    const evalResult = evaluateSmokeCase(testCase, {
      status: res.status,
      headers,
      body,
      location: result.location,
    });
    result.block = evalResult.block;
    result.warn = evalResult.warn;
    result.info = evalResult.info;

    if (testCase.verifyFinal && result.location && res.status >= 300 && res.status < 400) {
      const finalUrl = new URL(result.location, testCase.url).href;
      const chain = await followRedirectChain(finalUrl, { manualFirst: false });
      if (chain.error) {
        result.block.push(chain.error);
      } else {
        const vf = testCase.verifyFinal;
        if (vf.status && chain.final.status !== vf.status) {
          result.block.push(`final status=${chain.final.status} expected=${vf.status}`);
        }
        if (vf.contentTypeIncludes) {
          const ct = chain.headers["content-type"] ?? "";
          if (!ct.toLowerCase().includes(vf.contentTypeIncludes)) {
            result.block.push(`final content-type=${ct}`);
          }
        }
        if (vf.urlPrefix && !chain.final.url.startsWith(vf.urlPrefix)) {
          result.block.push(`final url=${chain.final.url}`);
        }
      }
    }

    if (testCase.severity === "BLOCK" && result.block.length) result.pass = false;
    if (testCase.severity === "WARN" && (result.block.length || result.warn.length)) result.pass = false;
  } catch (err) {
    result.pass = false;
    result.block.push(err instanceof Error ? err.message : String(err));
  }

  result.durationMs = Date.now() - started;
  return result;
}

function summarize(results) {
  let pass = 0;
  let warn = 0;
  let fail = 0;
  for (const r of results) {
    const hasBlock = r.block.length > 0 && r.severity === "BLOCK";
    const hasWarnOnly = r.warn.length > 0 && !hasBlock;
    if (hasBlock) fail += 1;
    else if (hasWarnOnly || (r.severity === "WARN" && !r.pass)) warn += 1;
    else pass += 1;
  }
  return { pass, warn, fail };
}

function printReport(results, meta) {
  console.log("11tik production smoke");
  console.log(`origin=${meta.origin} git=${meta.gitSha ?? "unknown"} cases=${results.length}`);
  for (const r of results) {
    const flag = r.block.length && r.severity === "BLOCK" ? "FAIL" : r.warn.length ? "WARN" : "PASS";
    console.log(`${flag} [${r.severity}] ${r.id} ${r.url} (${r.status ?? "err"}) ${r.durationMs}ms`);
    for (const m of r.block) console.log(`  BLOCK: ${m}`);
    for (const m of r.warn) console.log(`  WARN: ${m}`);
    for (const m of r.info) console.log(`  INFO: ${m}`);
  }
  console.log("");
  console.log(`Summary: pass=${meta.summary.pass} warn=${meta.summary.warn} fail=${meta.summary.fail} duration=${meta.durationMs}ms`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const origins = smokeOrigins();
  let cases = buildSmokeCases(origins);

  if (args.subset === "scheduled") {
    cases = filterSmokeCases(cases, { onlyIds: scheduledSmokeCaseIds() });
  }

  const started = Date.now();
  const results = [];
  for (const testCase of cases) {
    results.push(await probeCase(testCase));
    if (args.delayMs > 0) await new Promise((r) => setTimeout(r, args.delayMs));
  }

  const summary = summarize(results);
  const report = {
    timestamp: new Date().toISOString(),
    origin: origins.www,
    gitSha: resolveGitSha(),
    total: results.length,
    pass: summary.pass,
    warn: summary.warn,
    fail: summary.fail,
    durationMs: Date.now() - started,
    cases: results,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  printReport(results, {
    origin: origins.www,
    gitSha: report.gitSha,
    summary,
    durationMs: report.durationMs,
  });

  console.log(`JSON report: ${REPORT_PATH}`);

  if (summary.fail > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
