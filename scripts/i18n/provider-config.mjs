/**
 * Build-time translation provider configuration.
 * Active path: chrome_gtx only. Never logs secret values.
 */

export const PROVIDER_IDS = Object.freeze(["chrome_gtx"]);
export const LEGACY_PROVIDER_IDS = Object.freeze(["google_cloud", "local_nllb", "openai"]);

export function readProviderEnv() {
  return {
    enabled: process.env.TRANSLATE_ENABLED === "1",
    provider: String(process.env.TRANSLATION_PROVIDER || "chrome_gtx").toLowerCase(),
    rateLimitMs: Number(process.env.TRANSLATE_RATE_LIMIT_MS || 80),
    maxRetries: Number(process.env.TRANSLATE_MAX_RETRIES || 3),
    batchSize: Number(process.env.TRANSLATE_BATCH_SIZE || 1),
    timeoutMs: Number(process.env.TRANSLATE_TIMEOUT_MS || 120_000),
    concurrency: Number(process.env.TRANSLATE_CONCURRENCY || 4),
    gtxConcurrency: Number(process.env.TRANSLATE_GTX_CONCURRENCY || 8),
    rolloutMode: String(process.env.TRANSLATE_ROLLOUT_MODE || "locale-first").toLowerCase(),
  };
}

export function validateProviderConfig(env = readProviderEnv()) {
  const errors = [];
  if (!env.enabled) errors.push("TRANSLATE_ENABLED is not 1");
  if (!PROVIDER_IDS.includes(env.provider)) {
    errors.push(
      `unsupported provider: ${env.provider} (active: chrome_gtx; legacy removed: ${LEGACY_PROVIDER_IDS.join(", ")})`,
    );
  }
  if (!Number.isFinite(env.rateLimitMs) || env.rateLimitMs < 0) errors.push("invalid TRANSLATE_RATE_LIMIT_MS");
  if (!Number.isFinite(env.maxRetries) || env.maxRetries < 0) errors.push("invalid TRANSLATE_MAX_RETRIES");
  if (!Number.isFinite(env.batchSize) || env.batchSize < 1) errors.push("invalid TRANSLATE_BATCH_SIZE");
  if (!Number.isFinite(env.timeoutMs) || env.timeoutMs < 1000) errors.push("invalid TRANSLATE_TIMEOUT_MS");
  return { ok: errors.length === 0, errors, env };
}

/** Safe report for CLI — never includes secret values. */
export function providerConfigReport(env = readProviderEnv()) {
  const validation = validateProviderConfig({ ...env, enabled: true });
  const configValidIfEnabled = validateProviderConfig(env);
  return {
    translateEnabled: env.enabled,
    provider: env.provider,
    credentialsPresent: env.provider === "chrome_gtx",
    credentialsSource: env.provider === "chrome_gtx" ? "translator/extension embedded GTX key" : null,
    configurationValid: env.enabled ? configValidIfEnabled.ok : validation.ok,
    configurationErrors: env.enabled ? configValidIfEnabled.errors : [],
    rateLimitMs: env.rateLimitMs,
    maxRetries: env.maxRetries,
    batchSize: env.batchSize,
    timeoutMs: env.timeoutMs,
    concurrency: env.concurrency,
    gtxConcurrency: env.gtxConcurrency,
    rolloutMode: env.rolloutMode,
    model: "chrome-extension-gtx-translate-pa",
    localEngine: true,
  };
}

export function assertProviderReady() {
  const env = readProviderEnv();
  const result = validateProviderConfig(env);
  if (!result.ok) {
    throw new Error(`Translation provider not configured: ${result.errors.join("; ")}`);
  }
  return env;
}
