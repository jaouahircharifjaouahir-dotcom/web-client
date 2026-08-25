/**
 * HTTP client that mirrors the Google Translate Chrome extension TranslationAPI.
 *
 * Extension path (from translator/extension/popup_compiled.js):
 *   https://translate-pa.googleapis.com/v1/translate
 *   params.client=gtx
 *   query.source_language / query.target_language / query.text
 *   key=<extension embedded key>
 *
 * Local tooling only — never import from Worker/browser production bundles.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { acquireGtxSlot, withRetry } from "../../scripts/i18n/rate-limiter.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXTENSION_POPUP = join(ROOT, "translator", "extension", "popup_compiled.js");
const EXTENSION_MAIN = join(ROOT, "translator", "extension", "main_compiled.js");

const DEFAULT_BASE = "https://translate-pa.googleapis.com";
const TRANSLATE_PATH = "/v1/translate";

let cachedKey = null;

/** Extract the same API key the Chrome extension embeds (public Web Store extension). */
export function extractExtensionApiKey() {
  if (cachedKey) return cachedKey;
  const candidates = [EXTENSION_POPUP, EXTENSION_MAIN];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const src = readFileSync(path, "utf8");
    const m = /getApiKey\(\)\{return"([^"]+)"\}/.exec(src);
    if (m?.[1]) {
      cachedKey = m[1];
      return cachedKey;
    }
  }
  throw new Error("Could not extract Google Translate extension API key from translator/extension/");
}

export function extensionPresent() {
  return existsSync(join(ROOT, "translator", "extension", "manifest.json"));
}

/**
 * Translate one plain-text string via the extension's One Platform endpoint.
 */
export async function translateTextGtx(text, { source = "en", target, display = "en", key, signal } = {}) {
  if (!String(text || "").length) return { translatedText: "", detectedSource: source };
  const apiKey = key || extractExtensionApiKey();
  const url = new URL(TRANSLATE_PATH, DEFAULT_BASE);
  url.searchParams.set("params.client", "gtx");
  url.searchParams.set("query.source_language", source);
  url.searchParams.set("query.target_language", target);
  url.searchParams.set("query.display_language", display);
  url.searchParams.set("query.text", text);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("data_types", "TRANSLATION");

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json+protobuf", Accept: "application/json+protobuf" },
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`GTX HTTP ${res.status}: ${detail.slice(0, 200)}`);
    err.status = res.status;
    err.retryable = res.status === 429 || res.status >= 500;
    throw err;
  }

  const body = await res.json();
  // Response shape observed: ["translated text", null, null, null, null, "en"]
  const translatedText = Array.isArray(body) ? String(body[0] ?? "") : String(body?.translation ?? body ?? "");
  const detectedSource = Array.isArray(body) ? String(body[5] ?? source) : source;
  return {
    translatedText,
    detectedSource,
    sourceCharacters: text.length,
    translatedCharacters: translatedText.length,
  };
}

function gtxConcurrency(env) {
  const raw = env.gtxConcurrency ?? env.translateGtxConcurrency ?? process.env.TRANSLATE_GTX_CONCURRENCY ?? 8;
  return Math.max(1, Number(raw) || 8);
}

/**
 * Translate many strings with bounded parallel GTX requests + shared rate gate.
 */
export async function translateBatchGtx(strings, { target, env = {}, source = "en", signal } = {}) {
  const list = Array.isArray(strings) ? strings : [];
  if (!list.length) {
    return { translations: [], usage: { sourceCharacters: 0, translatedCharacters: 0, apiCalls: 0, retries: 0 } };
  }

  const usage = { sourceCharacters: 0, translatedCharacters: 0, apiCalls: 0, retries: 0 };
  const rateLimitMs = Number(env.rateLimitMs ?? 80);
  const maxRetries = Number(env.maxRetries ?? 3);
  const key = extractExtensionApiKey();
  const concurrency = Math.min(gtxConcurrency(env), list.length);
  const out = new Array(list.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next;
      next += 1;
      if (i >= list.length) return;
      const text = list[i];
      const release = await acquireGtxSlot(rateLimitMs);
      try {
        const result = await withRetry(
          async (attempt) => {
            if (attempt > 0) usage.retries += 1;
            return translateTextGtx(text, { source, target, key, signal });
          },
          { maxRetries, baseDelayMs: 800 },
        );
        out[i] = result.translatedText;
        usage.sourceCharacters += result.sourceCharacters;
        usage.translatedCharacters += result.translatedCharacters;
        usage.apiCalls += 1;
      } finally {
        release();
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { translations: out, usage };
}

export async function smokeTestGtx() {
  const { translatedText } = await translateTextGtx("Hello from 11tik", { target: "fr" });
  return {
    ok: Boolean(translatedText) && translatedText !== "Hello from 11tik",
    sample: translatedText,
    provider: "chrome_gtx",
    extensionPresent: extensionPresent(),
  };
}
