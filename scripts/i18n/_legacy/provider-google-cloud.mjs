/**
 * Google Cloud Translation build-time provider (official API v3).
 * Never imported from browser/Worker bundles.
 */
import { TranslationServiceClient } from "@google-cloud/translate";
import { googleCodeForLocale } from "./google-locale-map.mjs";
import { withRetry, sleep } from "./rate-limiter.mjs";
import {
  collectPayloadStrings,
  setPayloadString,
  translateHtmlFragment,
  translatePlainStrings,
} from "./dom-translate.mjs";
import { restoreStructured } from "./translate-protect.mjs";

let clientSingleton = null;

function getClient() {
  if (!clientSingleton) clientSingleton = new TranslationServiceClient();
  return clientSingleton;
}

function parentPath(env) {
  const project = env.googleProject;
  const location = env.googleLocation || "global";
  return `projects/${project}/locations/${location}`;
}

function isHtmlPath(path) {
  return (
    path.endsWith(".html") ||
    path.endsWith("Html") ||
    path.includes("answerHtml") ||
    path.includes("captionHtml")
  );
}

async function translateBatchGoogle(strings, { targetCode, env }) {
  if (!strings.length) return { translations: [], usage: { sourceCharacters: 0, translatedCharacters: 0, apiCalls: 0 } };
  const client = getClient();
  const parent = parentPath(env);
  const batchSize = Math.min(env.batchSize || 50, 100);

  const translations = [];
  const usage = { sourceCharacters: 0, translatedCharacters: 0, apiCalls: 0 };

  for (let i = 0; i < strings.length; i += batchSize) {
    const chunk = strings.slice(i, i + batchSize);
    const sourceChars = chunk.reduce((n, s) => n + s.length, 0);
    const [response] = await withRetry(
      async () => {
        try {
          return await client.translateText({
            parent,
            contents: chunk,
            mimeType: "text/plain",
            sourceLanguageCode: "en",
            targetLanguageCode: targetCode,
          });
        } catch (err) {
          const status = err?.code || err?.status;
          const retryable = status === 429 || status === 503 || status === 500 || status === 408;
          if (retryable) {
            const e = new Error(err.message || String(err));
            e.status = status;
            e.retryable = true;
            throw e;
          }
          throw err;
        }
      },
      { maxRetries: env.maxRetries, baseDelayMs: 1000 },
    );

    const batch = response?.translations || [];
    if (batch.length !== chunk.length) {
      throw new Error(`Google returned ${batch.length} translations; expected ${chunk.length}`);
    }
    for (const t of batch) translations.push(t.translatedText || "");
    usage.sourceCharacters += sourceChars;
    usage.translatedCharacters += batch.reduce((n, t) => n + (t.translatedText?.length || 0), 0);
    usage.apiCalls += 1;
    if (env.rateLimitMs > 0) await sleep(env.rateLimitMs);
  }
  return { translations, usage };
}

export async function translateStructuredPayload(sourcePayload, { locale, env }) {
  const targetCode = googleCodeForLocale(locale);
  if (!targetCode) throw new Error(`No Google Cloud language mapping for locale: ${locale}`);

  const payload = structuredClone(sourcePayload);
  const entries = collectPayloadStrings(payload);
  const plainEntries = entries.filter((e) => !isHtmlPath(e.path));
  const htmlEntries = entries.filter((e) => isHtmlPath(e.path));

  let usage = { sourceCharacters: 0, translatedCharacters: 0, apiCalls: 0 };

  if (plainEntries.length) {
    const translated = await translatePlainStrings(
      plainEntries.map((e) => e.value),
      async (protectedStrings) => {
        const { translations, usage: batchUsage } = await translateBatchGoogle(protectedStrings, { targetCode, env });
        usage.sourceCharacters += batchUsage.sourceCharacters;
        usage.translatedCharacters += batchUsage.translatedCharacters;
        usage.apiCalls += batchUsage.apiCalls;
        return translations;
      },
    );
    plainEntries.forEach((e, i) => setPayloadString(payload, e.path, translated[i]));
  }

  for (const entry of htmlEntries) {
    const translatedHtml = await translateHtmlFragment(entry.value, async (strings) => {
      const { translations, usage: batchUsage } = await translateBatchGoogle(strings, { targetCode, env });
      usage.sourceCharacters += batchUsage.sourceCharacters;
      usage.translatedCharacters += batchUsage.translatedCharacters;
      usage.apiCalls += batchUsage.apiCalls;
      return translations;
    });
    setPayloadString(payload, entry.path, translatedHtml);
  }

  return {
    data: restoreStructured(payload, new Map()),
    usage: {
      sourceCharacters: usage.sourceCharacters,
      translatedCharacters: usage.translatedCharacters,
      apiCalls: usage.apiCalls,
      targetLanguageCode: targetCode,
    },
  };
}

export async function smokeTestGoogleCloud(env) {
  const result = await translateStructuredPayload(
    { ping: "Hello from 11tik build-time translation smoke test." },
    { locale: "fr", env },
  );
  return {
    ok: Boolean(result?.data?.ping && result.data.ping !== "Hello from 11tik build-time translation smoke test."),
    provider: "google_cloud",
    targetLanguageCode: result.usage?.targetLanguageCode,
  };
}

/** Optional live fetch of supported target languages (requires credentials). */
export async function fetchGoogleSupportedTargetCodes(env) {
  const client = getClient();
  const parent = parentPath(env);
  const [response] = await client.getSupportedLanguages({ parent, displayLanguageCode: "en" });
  return (response?.languages || [])
    .filter((l) => l.supportTarget)
    .map((l) => l.languageCode);
}

export function resetClientForTests() {
  clientSingleton = null;
}
