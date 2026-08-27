/**
 * IndexNow submitter — build/publish-time only.
 * Diffs staged public HTML against a persisted baseline snapshot, then POSTs
 * only changed HTTPS URLs (grouped by host) with retries / checkpointing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INDEXNOW_KEY, INDEXNOW_KEY_PATH } from "./indexnow-key.mjs";
import {
  INDEXNOW_LIVE_SNAPSHOT_URL,
  INDEXNOW_SNAPSHOT_REL,
  buildIndexNowSnapshot,
  diffIndexNowSnapshots,
  dedupeUrls,
  groupUrlsByHost,
  serializeSnapshot,
} from "./indexnow-snapshot.mjs";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_BATCH_SIZE = 100; // well under 10k API max; polite rate limiting
export const INDEXNOW_MAX_RETRIES = 4;
export const INDEXNOW_BASE_DELAY_MS = 500;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function defaultCheckpointPath() {
  return join(ROOT, "tmp", "indexnow-checkpoint.json");
}

export function shouldSubmitIndexNow(env = process.env) {
  if (env.INDEXNOW_SUBMIT === "0") return false;
  if (env.INDEXNOW_SUBMIT === "1") return true;
  // Cloudflare Workers Builds / Pages CI
  return env.WORKERS_CI === "1" || env.CF_PAGES === "1";
}

export function keyLocationForHost(host) {
  return `https://${host}${INDEXNOW_KEY_PATH}`;
}

export function buildIndexNowPayload(host, urlList) {
  return {
    host,
    key: INDEXNOW_KEY,
    keyLocation: keyLocationForHost(host),
    urlList: dedupeUrls(urlList),
  };
}

function sleep(ms, wait = globalThis.sleep) {
  if (typeof wait === "function") return wait(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classify IndexNow HTTP status.
 * 200/202 = success; 429/5xx = retryable; 400/403/422 = fatal.
 */
export function classifyIndexNowStatus(status) {
  if (status === 200 || status === 202) return "success";
  if (status === 429 || status >= 500) return "retryable";
  if (status === 400 || status === 403 || status === 422) return "fatal";
  if (status >= 400) return "fatal";
  return "retryable";
}

export async function postIndexNowBatch(payload, { fetchImpl = fetch, endpoint = INDEXNOW_ENDPOINT } = {}) {
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  return { status: res.status, ok: res.ok, body: text.slice(0, 500) };
}

export async function submitIndexNowBatches(urls, options = {}) {
  const {
    fetchImpl = fetch,
    batchSize = INDEXNOW_BATCH_SIZE,
    maxRetries = INDEXNOW_MAX_RETRIES,
    baseDelayMs = INDEXNOW_BASE_DELAY_MS,
    sleepFn,
    onBatch,
  } = options;

  const byHost = groupUrlsByHost(urls);
  const results = [];
  const pending = [];

  for (const [host, hostUrls] of byHost) {
    for (let i = 0; i < hostUrls.length; i += batchSize) {
      const chunk = hostUrls.slice(i, i + batchSize);
      const payload = buildIndexNowPayload(host, chunk);
      // Ensure key never appears in logs as a accidental dump of full env — log host + count only.
      let attempt = 0;
      let last = null;
      while (attempt <= maxRetries) {
        last = await postIndexNowBatch(payload, { fetchImpl, endpoint: options.endpoint });
        const kind = classifyIndexNowStatus(last.status);
        if (kind === "success") {
          results.push({ host, urls: chunk, status: last.status, attempts: attempt + 1 });
          if (onBatch) onBatch({ host, urls: chunk, status: last.status });
          break;
        }
        if (kind === "fatal" || attempt === maxRetries) {
          pending.push({ host, urls: chunk, status: last.status, body: last.body, attempts: attempt + 1 });
          break;
        }
        const delay = baseDelayMs * 2 ** attempt;
        await sleep(delay, sleepFn);
        attempt += 1;
      }
      // Polite gap between successful batches
      if (hostUrls.length > batchSize) await sleep(baseDelayMs, sleepFn);
    }
  }

  return { results, pending, submittedCount: results.reduce((n, r) => n + r.urls.length, 0) };
}

export function readCheckpoint(path = defaultCheckpointPath()) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function writeCheckpoint(checkpoint, path = defaultCheckpointPath()) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(checkpoint, null, 2)}\n`);
}

export async function loadPreviousSnapshot({
  liveUrl = INDEXNOW_LIVE_SNAPSHOT_URL,
  checkpointPath = defaultCheckpointPath(),
  fetchImpl = fetch,
} = {}) {
  const local = readCheckpoint(checkpointPath);
  if (local?.snapshot?.urls) return { source: "checkpoint", snapshot: local.snapshot, pending: local.pending || [] };

  try {
    const res = await fetchImpl(liveUrl, { method: "GET", headers: { accept: "application/json" } });
    if (res.ok) {
      const snapshot = await res.json();
      if (snapshot?.urls && typeof snapshot.urls === "object") {
        return { source: "live", snapshot, pending: [] };
      }
    }
  } catch {
    // offline / first run
  }
  return { source: "empty", snapshot: { v: 1, generatedAt: null, urlCount: 0, urls: {} }, pending: [] };
}

/**
 * After static generation: write snapshot asset, optionally submit IndexNow delta.
 *
 * @param {string} staged dist-assets root
 * @param {{ writeFile?: Function, submit?: boolean, fetchImpl?: typeof fetch }} [options]
 */
export async function runIndexNowAfterStaticGeneration(staged, options = {}) {
  const writeFile =
    options.writeFile ||
    ((rel, contents) => {
      const full = join(staged, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, contents);
    });

  const next = buildIndexNowSnapshot(staged, options);
  writeFile(INDEXNOW_SNAPSHOT_REL, serializeSnapshot(next));

  const submit = options.submit ?? shouldSubmitIndexNow(options.env || process.env);
  const checkpointPath = options.checkpointPath || defaultCheckpointPath();
  const previousPack = await loadPreviousSnapshot({
    liveUrl: options.liveSnapshotUrl || INDEXNOW_LIVE_SNAPSHOT_URL,
    checkpointPath,
    fetchImpl: options.fetchImpl || fetch,
  });

  // Resume: merge any pending URLs from a crashed prior run with fresh diff.
  const diff = diffIndexNowSnapshots(previousPack.snapshot, next);
  const pendingFromCheckpoint = (previousPack.pending || []).flatMap((p) => p.urls || []);
  let notify = dedupeUrls([...diff.notify, ...pendingFromCheckpoint]);

  const log = options.log || ((msg, extra) => console.log(`[indexnow] ${msg}`, extra ?? ""));

  if (!submit) {
    writeCheckpoint(
      {
        snapshot: next,
        pending: [],
        lastRunAt: new Date().toISOString(),
        lastSubmitSkipped: true,
        reason: "submit-disabled",
      },
      checkpointPath,
    );
    log("snapshot written; submit skipped", { urlCount: next.urlCount, notify: notify.length });
    return {
      submitted: false,
      snapshot: next,
      diff,
      notify,
      submitResult: null,
    };
  }

  // Empty baseline: do not mass-submit the whole site unless explicitly requested.
  const emptyBaseline = previousPack.source === "empty" || Object.keys(previousPack.snapshot.urls || {}).length === 0;
  if (emptyBaseline && (options.env || process.env).INDEXNOW_SUBMIT_BASELINE !== "1") {
    writeCheckpoint(
      {
        snapshot: next,
        pending: [],
        lastRunAt: new Date().toISOString(),
        lastSubmitSkipped: true,
        reason: "empty-baseline",
      },
      checkpointPath,
    );
    log("empty baseline — wrote snapshot only (no mass submit)", { urlCount: next.urlCount });
    return {
      submitted: false,
      snapshot: next,
      diff,
      notify: [],
      submitResult: null,
      baselineSkipped: true,
    };
  }

  if (notify.length === 0) {
    writeCheckpoint(
      {
        snapshot: next,
        pending: [],
        lastRunAt: new Date().toISOString(),
        lastSubmitSkipped: false,
        reason: "unchanged",
      },
      checkpointPath,
    );
    log("unchanged build — zero submissions", { urlCount: next.urlCount });
    return {
      submitted: true,
      snapshot: next,
      diff,
      notify: [],
      submitResult: { results: [], pending: [], submittedCount: 0 },
    };
  }

  log("submitting changed URLs", {
    added: diff.added.length,
    updated: diff.updated.length,
    deleted: diff.deleted.length,
    notify: notify.length,
    baseline: previousPack.source,
  });

  const submitResult = await submitIndexNowBatches(notify, {
    fetchImpl: options.fetchImpl || fetch,
    batchSize: options.batchSize,
    maxRetries: options.maxRetries,
    baseDelayMs: options.baseDelayMs,
    sleepFn: options.sleepFn,
    endpoint: options.endpoint,
  });

  // Idempotent checkpoint: advance snapshot always; keep only failed pending chunks.
  writeCheckpoint(
    {
      snapshot: next,
      pending: submitResult.pending,
      lastRunAt: new Date().toISOString(),
      lastSubmitSkipped: false,
      lastSubmittedCount: submitResult.submittedCount,
      failures: submitResult.pending.map((p) => ({
        host: p.host,
        status: p.status,
        count: p.urls.length,
        // Do not persist response bodies that might echo the key.
      })),
    },
    checkpointPath,
  );

  if (submitResult.pending.length) {
    log("partial failure — pending retained for resume", {
      failedBatches: submitResult.pending.length,
      submittedCount: submitResult.submittedCount,
    });
  } else {
    log("submit complete", { submittedCount: submitResult.submittedCount });
  }

  return {
    submitted: true,
    snapshot: next,
    diff,
    notify,
    submitResult,
  };
}

/** Assert key is not embedded in a client-facing string blob (tests). */
export function assertKeyNotInClientBundle(text) {
  if (String(text).includes(INDEXNOW_KEY) && !String(text).includes(`${INDEXNOW_KEY}.txt`)) {
    // Allow the public verification filename path; forbid bare key in JS bundles.
    const withoutFileRefs = String(text).replaceAll(`${INDEXNOW_KEY}.txt`, "");
    if (withoutFileRefs.includes(INDEXNOW_KEY)) {
      throw new Error("IndexNow key leaked into client-facing content");
    }
  }
}
