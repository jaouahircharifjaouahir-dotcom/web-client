/**
 * Build-time translation pipeline (API calls ONLY when explicitly authorized).
 *
 * Never import this from Worker/browser bundles.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";
import {
  hashSource,
  loadTranslationArtifact,
  normalizeSource,
  readSourceHash,
  saveTranslationArtifact,
} from "./translation-store.mjs";
import { validateTranslationArtifact } from "./validate-artifact.mjs";
import { extractStructuredSource, loadStructuredSourceFromItem } from "./extract-source.mjs";
import { translateWithProvider, providerSmokeTest } from "./provider.mjs";
import { assertProviderReady, providerConfigReport, readProviderEnv } from "./provider-config.mjs";
import { validateTranslationOutput } from "./translate-quality.mjs";
import { runPool } from "./concurrency-pool.mjs";
import { getTargetLocales } from "./target-languages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CHECKPOINT_REL = join("tmp", "i18n-translate-checkpoint.json");
export const ROLLOUT_LOG_REL = join("tmp", "i18n-rollout-log.jsonl");
export const ROLLOUT_STATS_REL = join("tmp", "i18n-rollout-stats.json");

function markStaleIfNeeded(artifact, currentHash) {
  if (!artifact) return null;
  if (artifact.sourceHash !== currentHash && artifact.status === "ready") {
    return { ...artifact, status: "stale" };
  }
  return artifact;
}

function shouldSkipUnit(artifact, sourceHash, contentId, locale, contentType) {
  if (!artifact) return false;
  if (artifact.sourceHash !== sourceHash || artifact.status === "stale") return false;
  if (artifact.status !== "ready") return false;
  const v = validateTranslationArtifact(artifact, {
    contentId,
    locale,
    currentSourceHash: sourceHash,
    contentType,
  });
  return v.ok;
}

export function resolveRolloutLocales(options = {}) {
  if (options.locales) return options.locales;
  // Global major languages only — never the full ISO 639-1 table.
  return getTargetLocales();
}

/** locale-first = finish all content for one language before the next (no cross-locale batches). */
export function resolveRolloutMode(options = {}) {
  const raw = String(
    options.rolloutMode ?? options.env?.rolloutMode ?? process.env.TRANSLATE_ROLLOUT_MODE ?? "locale-first",
  ).toLowerCase();
  return raw === "mixed" || raw === "content-first" ? "mixed" : "locale-first";
}

const ACTION_RANK = { translate: 0, retranslate: 1, complete: 2, retry: 3 };

function queueItemLocale(queue, summary, item, locale, sourceHash, force) {
  let artifact = loadTranslationArtifact(item.contentId, locale);
  artifact = markStaleIfNeeded(artifact, sourceHash);
  if (!force && shouldSkipUnit(artifact, sourceHash, item.contentId, locale, item.type)) {
    summary.ready += 1;
    summary.skipped += 1;
    return;
  }
  const base = {
    contentId: item.contentId,
    locale,
    sourceHash,
    type: item.type,
    sourceRel: item.sourceRel,
  };
  if (!artifact) {
    summary.missing += 1;
    queue.push({ ...base, action: "translate" });
    return;
  }
  if (artifact.sourceHash !== sourceHash || artifact.status === "stale") {
    summary.stale += 1;
    queue.push({ ...base, action: "retranslate" });
    return;
  }
  if (artifact.status === "failed") {
    summary.failed += 1;
    queue.push({ ...base, action: "retry" });
    return;
  }
  summary.draft += 1;
  queue.push({ ...base, action: "complete" });
}

export function planTranslationWork(options = {}) {
  const inventory = options.inventory ?? buildContentInventory();
  const locales = resolveRolloutLocales(options);
  const force = Boolean(options.force);
  const rolloutMode = resolveRolloutMode(options);
  const items = localizableContent(inventory);
  const queue = [];
  const summary = { missing: 0, stale: 0, ready: 0, draft: 0, failed: 0, noSource: 0, skipped: 0 };

  if (rolloutMode === "locale-first") {
    for (const locale of locales) {
      for (const item of items) {
        const sourceHash = readSourceHash(item.sourceRel);
        if (!sourceHash) {
          summary.noSource += 1;
          continue;
        }
        queueItemLocale(queue, summary, item, locale, sourceHash, force);
      }
    }
    queue.sort((a, b) => {
      const byAction = (ACTION_RANK[a.action] ?? 9) - (ACTION_RANK[b.action] ?? 9);
      if (byAction !== 0) return byAction;
      return a.contentId.localeCompare(b.contentId);
    });
  } else {
    for (const item of items) {
      const sourceHash = readSourceHash(item.sourceRel);
      if (!sourceHash) {
        summary.noSource += locales.length;
        continue;
      }
      for (const locale of locales) {
        queueItemLocale(queue, summary, item, locale, sourceHash, force);
      }
    }
    queue.sort((a, b) => (ACTION_RANK[a.action] ?? 9) - (ACTION_RANK[b.action] ?? 9));
  }

  return {
    contentCount: items.length,
    localeCount: locales.length,
    theoretical: items.length * locales.length,
    rolloutMode,
    summary,
    queue,
    apiCallsWouldBe: queue.filter((q) => ["translate", "retranslate", "retry", "complete"].includes(q.action)).length,
  };
}

/** Pick the next rollout batch — locale-first never mixes languages in one batch. */
export function selectRolloutBatch(queue, { concurrency, maxJobs, jobsDone, rolloutMode, locales } = {}) {
  if (!queue?.length) return { batch: [], currentLocale: null };
  const budget = Math.min(Math.max(1, concurrency || 1), maxJobs - jobsDone, queue.length);
  if (rolloutMode !== "locale-first") {
    return { batch: queue.slice(0, budget), currentLocale: queue[0]?.locale ?? null };
  }

  const currentLocale = queue[0].locale;
  const seen = new Set();
  const batch = [];
  for (const unit of queue) {
    if (unit.locale !== currentLocale) break;
    const key = `${unit.contentId}:${unit.locale}`;
    if (seen.has(key)) continue;
    seen.add(key);
    batch.push(unit);
    if (batch.length >= budget) break;
  }
  return { batch, currentLocale };
}

export function applyStaleMarkers(options = {}) {
  const inventory = options.inventory ?? buildContentInventory();
  const locales = resolveRolloutLocales(options);
  let updated = 0;
  for (const item of localizableContent(inventory)) {
    const sourceHash = readSourceHash(item.sourceRel);
    if (!sourceHash) continue;
    for (const locale of locales) {
      const artifact = loadTranslationArtifact(item.contentId, locale);
      if (!artifact) continue;
      if (artifact.sourceHash !== sourceHash && artifact.status === "ready") {
        saveTranslationArtifact({ ...artifact, contentId: item.contentId, status: "stale" });
        updated += 1;
      }
    }
  }
  return updated;
}

export function assertBuildTimeTranslationAllowed() {
  assertProviderReady();
  return true;
}

export function readEnglishSourceNormalized(sourceRel) {
  const abs = join(ROOT, sourceRel);
  if (!existsSync(abs)) return null;
  const raw = readFileSync(abs, "utf8");
  return { normalized: normalizeSource(raw), sourceHash: hashSource(raw) };
}

function buildPayloadFromSource(structured) {
  return {
    title: structured.title,
    description: structured.description,
    h1: structured.h1,
    ogTitle: structured.ogTitle,
    ogDescription: structured.ogDescription,
    imageAlt: structured.imageAlt,
    faqHeading: structured.faqHeading,
    images: structured.images,
    sections: structured.sections,
    faq: structured.faq,
    conclusionHtml: structured.conclusionHtml,
    bioHtml: structured.bioHtml,
  };
}

function buildArtifact(contentId, locale, sourceHash, translated, status) {
  return {
    contentId,
    articleId: contentId,
    locale,
    sourceHash,
    status,
    ...translated,
  };
}

const inFlightUnits = new Map();

async function translateContentUnitInner(unit, options = {}) {
  const { contentId, locale, sourceHash, type, sourceRel } = unit;
  const force = Boolean(options.force || unit.force);
  const existing = loadTranslationArtifact(contentId, locale);
  if (!force && shouldSkipUnit(existing, sourceHash, contentId, locale, type)) {
    return { skipped: true, artifact: existing, reason: "ready-current" };
  }

  assertBuildTimeTranslationAllowed();
  const abs = join(ROOT, sourceRel);
  const raw = readFileSync(abs, "utf8");
  const structured = extractStructuredSource(raw, { contentType: type });
  const payload = buildPayloadFromSource(structured);

  let translated;
  let usage = null;
  try {
    const providerResult = await translateWithProvider(payload, locale, options.env);
    translated = providerResult.data ?? providerResult;
    usage = providerResult.usage ?? null;
  } catch (err) {
    const failed = buildArtifact(contentId, locale, sourceHash, existing || payload, "failed");
    failed.error = String(err?.message || err).slice(0, 500);
    saveTranslationArtifact(failed);
    return { ok: false, artifact: failed, error: failed.error, usage };
  }

  const artifact = buildArtifact(contentId, locale, sourceHash, translated, "draft");
  const quality = validateTranslationOutput(artifact, structured, {
    contentId,
    locale,
    sourceHash,
    contentType: type,
  });

  if (!quality.ok) {
    artifact.status = "failed";
    artifact.validationErrors = quality.errors;
    saveTranslationArtifact(artifact);
    return { ok: false, artifact, errors: quality.errors, usage };
  }

  artifact.status = "ready";
  saveTranslationArtifact(artifact);
  return { ok: true, artifact, usage, newlyTranslated: !existing || existing.status !== "ready" };
}

export async function translateContentUnit(unit, options = {}) {
  const key = `${unit.contentId}:${unit.locale}`;
  if (inFlightUnits.has(key)) return inFlightUnits.get(key);
  const job = translateContentUnitInner(unit, options);
  inFlightUnits.set(key, job);
  try {
    return await job;
  } finally {
    inFlightUnits.delete(key);
  }
}

function initRolloutStats() {
  return {
    startedAt: new Date().toISOString(),
    apiCalls: 0,
    succeeded: 0,
    failed: 0,
    skippedReady: 0,
    newlyTranslated: 0,
    retries: 0,
    remaining: null,
    currentLocale: null,
    rolloutMode: null,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    sourceCharacters: 0,
    translatedCharacters: 0,
    googleApiCalls: 0,
    failedItems: [],
  };
}

export function loadRolloutStats() {
  const path = join(ROOT, ROLLOUT_STATS_REL);
  if (!existsSync(path)) return initRolloutStats();
  try {
    return { ...initRolloutStats(), ...JSON.parse(readFileSync(path, "utf8")) };
  } catch {
    return initRolloutStats();
  }
}

function saveRolloutStats(stats) {
  const path = join(ROOT, ROLLOUT_STATS_REL);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(stats, null, 2)}\n`);
}

function appendRolloutLog(entry) {
  const path = join(ROOT, ROLLOUT_LOG_REL);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}\n`);
}

function applyUsage(stats, usage) {
  if (!usage) return;
  stats.promptTokens += usage.prompt_tokens || 0;
  stats.completionTokens += usage.completion_tokens || 0;
  stats.totalTokens += usage.total_tokens || 0;
  stats.sourceCharacters += usage.sourceCharacters || 0;
  stats.translatedCharacters += usage.translatedCharacters || 0;
  stats.googleApiCalls += usage.apiCalls || 0;
  stats.retries += usage.retries || 0;
}

function writeCheckpoint(state) {
  const path = join(ROOT, CHECKPOINT_REL);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

/**
 * Full resumable rollout: re-plans after each job batch, skips ready+current automatically.
 * Default TRANSLATE_ROLLOUT_MODE=locale-first — one language at a time, all pages/articles.
 */
export async function runFullTranslationRollout(options = {}) {
  assertBuildTimeTranslationAllowed();
  const env = options.env ?? readProviderEnv();
  const locales = resolveRolloutLocales({ ...options, env });
  const rolloutMode = resolveRolloutMode({ ...options, env });
  const concurrency = Math.max(1, Number(options.concurrency ?? env.concurrency ?? 1));
  const stats = loadRolloutStats();
  if (!stats.startedAt) stats.startedAt = new Date().toISOString();
  stats.rolloutMode = rolloutMode;
  const maxJobs = options.maxJobs ?? Infinity;
  let jobsDone = 0;
  let statsLock = Promise.resolve();

  const bumpStats = async (fn) => {
    statsLock = statsLock.then(fn);
    await statsLock;
  };

  while (jobsDone < maxJobs) {
    const plan = planTranslationWork({ inventory: options.inventory, locales, rolloutMode });
    if (plan.queue.length === 0) {
      stats.remaining = 0;
      stats.currentLocale = null;
      saveRolloutStats(stats);
      break;
    }
    const remainingBefore = plan.queue.length;
    stats.remaining = remainingBefore;
    const { batch, currentLocale } = selectRolloutBatch(plan.queue, {
      concurrency,
      maxJobs,
      jobsDone,
      rolloutMode,
      locales,
    });
    if (!batch.length) break;
    stats.currentLocale = currentLocale;
    let completedInBatch = 0;

    await runPool(batch, Math.min(concurrency, batch.length), async (unit) => {
      const result = await translateContentUnit(unit, { env, force: options.force });
      await bumpStats(async () => {
        jobsDone += 1;
        completedInBatch += 1;
        stats.apiCalls += 1;
        stats.remaining = Math.max(0, remainingBefore - completedInBatch);
        stats.currentLocale = unit.locale;
        if (result.skipped) stats.skippedReady += 1;
        else if (result.ok) {
          stats.succeeded += 1;
          if (result.newlyTranslated) stats.newlyTranslated += 1;
        } else {
          stats.failed += 1;
          if (stats.failedItems.length < 500) {
            stats.failedItems.push({
              contentId: unit.contentId,
              locale: unit.locale,
              errors: result.errors,
              error: result.error,
            });
          }
        }
        applyUsage(stats, result.usage);
        saveRolloutStats(stats);
        appendRolloutLog({
          at: new Date().toISOString(),
          contentId: unit.contentId,
          locale: unit.locale,
          action: unit.action,
          ok: result.ok,
          skipped: result.skipped,
          status: result.artifact?.status,
        });
        writeCheckpoint({
          last: { contentId: unit.contentId, locale: unit.locale },
          stats,
          remaining: stats.remaining,
          currentLocale: stats.currentLocale,
          rolloutMode,
          concurrency,
        });
        if (options.onProgress) {
          options.onProgress({ stats, remaining: stats.remaining, unit, result });
        }
      });
      return result;
    });

    const planAfter = planTranslationWork({ inventory: options.inventory, locales, rolloutMode });
    stats.remaining = planAfter.queue.length;
    stats.currentLocale = planAfter.queue[0]?.locale ?? null;
    saveRolloutStats(stats);
    writeCheckpoint({
      last: { contentId: batch[batch.length - 1]?.contentId, locale: batch[batch.length - 1]?.locale },
      stats,
      remaining: stats.remaining,
      currentLocale: stats.currentLocale,
      rolloutMode,
      concurrency,
    });
    if (options.onProgress) {
      options.onProgress({ stats, remaining: stats.remaining, unit: batch[batch.length - 1], result: null });
    }
  }

  stats.finishedAt = new Date().toISOString();
  if (stats.remaining == null) stats.remaining = 0;
  saveRolloutStats(stats);
  return stats;
}

export async function runTranslationBatch(options = {}) {
  assertBuildTimeTranslationAllowed();
  const inventory = options.inventory ?? buildContentInventory();
  const env = options.env ?? readProviderEnv();
  const locales = resolveRolloutLocales({ ...options, env });
  const plan = planTranslationWork({ inventory, locales, force: options.force });
  const limit = options.limit ?? Infinity;
  const filterContentId = options.contentId || null;
  const filterLocale = options.locale || null;
  let queue = plan.queue;
  if (filterContentId) queue = queue.filter((q) => q.contentId === filterContentId);
  if (filterLocale) queue = queue.filter((q) => q.locale === filterLocale);
  queue = queue.slice(0, limit);

  const concurrency = Math.max(1, Number(options.concurrency ?? env.concurrency ?? 1));
  const results = { processed: 0, succeeded: 0, failed: 0, skipped: 0, items: [] };

  await runPool(queue, Math.min(concurrency, queue.length || 1), async (unit) => {
    const result = await translateContentUnit(unit, { env, force: options.force });
    results.processed += 1;
    if (result.skipped) results.skipped += 1;
    else if (result.ok) results.succeeded += 1;
    else results.failed += 1;
    results.items.push({
      contentId: unit.contentId,
      locale: unit.locale,
      ok: result.ok,
      skipped: result.skipped,
      status: result.artifact?.status,
      errors: result.errors,
    });
    writeCheckpoint({
      last: { contentId: unit.contentId, locale: unit.locale, status: result.artifact?.status },
      totals: results,
    });
    return result;
  });

  return results;
}

export async function runProviderSmokeTest() {
  assertBuildTimeTranslationAllowed();
  return providerSmokeTest();
}

export function inspectInventory() {
  const inventory = buildContentInventory();
  const localizable = localizableContent(inventory);
  const plan = planTranslationWork({ inventory });
  return {
    inventory: {
      total: inventory.length,
      localizable: localizable.length,
      articles: localizable.filter((i) => i.type === "article").length,
      utilities: localizable.filter((i) => i.type === "utility").length,
      items: localizable.map((i) => ({
        contentId: i.contentId,
        type: i.type,
        canonicalPath: i.canonicalPath,
        hasSource: Boolean(i.sourceRel),
      })),
    },
    plan,
    provider: providerConfigReport(),
  };
}

export function validateAllArtifacts(inventory = buildContentInventory(), locales = getTargetLocales()) {
  const items = localizableContent(inventory);
  const issues = [];
  let ready = 0;
  let stale = 0;
  let missing = 0;
  let failed = 0;
  let draft = 0;

  for (const item of items) {
    const sourceHash = readSourceHash(item.sourceRel);
    for (const locale of locales) {
      const artifact = loadTranslationArtifact(item.contentId, locale);
      if (!artifact) {
        missing += 1;
        continue;
      }
      if (!sourceHash) continue;
      if (artifact.sourceHash !== sourceHash) stale += 1;
      else if (artifact.status === "ready") {
        const v = validateTranslationArtifact(artifact, {
          contentId: item.contentId,
          locale,
          currentSourceHash: sourceHash,
          contentType: item.type,
        });
        if (v.ok) ready += 1;
        else {
          failed += 1;
          issues.push({ contentId: item.contentId, locale, errors: v.errors });
        }
      } else if (artifact.status === "failed") failed += 1;
      else draft += 1;
    }
  }

  return { ready, stale, missing, failed, draft, issues };
}

export { providerConfigReport, loadStructuredSourceFromItem, extractStructuredSource };
