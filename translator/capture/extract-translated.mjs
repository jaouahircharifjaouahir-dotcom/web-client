/**
 * Capture helpers: map English structured payload → GTX-translated payload
 * using DOM-aware text-node translation (never blind HTML send).
 */
import {
  collectPayloadStrings,
  setPayloadString,
  translateHtmlFragment,
  translatePlainStrings,
} from "../../scripts/i18n/dom-translate.mjs";
import { translateBatchGtx } from "./gtx-client.mjs";
import { gtxCodeForLocale } from "../locale/gtx-locale-map.mjs";

function isHtmlPath(path) {
  return (
    path.endsWith(".html") ||
    path.endsWith("Html") ||
    path.includes("answerHtml") ||
    path.includes("captionHtml")
  );
}

/**
 * Translate a structured i18n payload with the Chrome GTX engine.
 */
export async function translatePayloadWithGtx(sourcePayload, { locale, env = {} } = {}) {
  const target = gtxCodeForLocale(locale);
  if (!target) throw new Error(`No GTX language mapping for locale: ${locale}`);

  const payload = structuredClone(sourcePayload);
  const entries = collectPayloadStrings(payload);
  const plainEntries = entries.filter((e) => !isHtmlPath(e.path));
  const htmlEntries = entries.filter((e) => isHtmlPath(e.path));

  const usage = { sourceCharacters: 0, translatedCharacters: 0, apiCalls: 0, retries: 0, targetLanguageCode: target };

  if (plainEntries.length) {
    const translated = await translatePlainStrings(
      plainEntries.map((e) => e.value),
      async (protectedStrings) => {
        const { translations, usage: batchUsage } = await translateBatchGtx(protectedStrings, { target, env });
        usage.sourceCharacters += batchUsage.sourceCharacters;
        usage.translatedCharacters += batchUsage.translatedCharacters;
        usage.apiCalls += batchUsage.apiCalls;
        usage.retries += batchUsage.retries;
        return translations;
      },
    );
    plainEntries.forEach((e, i) => setPayloadString(payload, e.path, translated[i]));
  }

  await Promise.all(
    htmlEntries.map(async (entry) => {
      const translatedHtml = await translateHtmlFragment(entry.value, async (strings) => {
        const { translations, usage: batchUsage } = await translateBatchGtx(strings, { target, env });
        usage.sourceCharacters += batchUsage.sourceCharacters;
        usage.translatedCharacters += batchUsage.translatedCharacters;
        usage.apiCalls += batchUsage.apiCalls;
        usage.retries += batchUsage.retries;
        return translations;
      });
      setPayloadString(payload, entry.path, translatedHtml);
    }),
  );

  return { data: payload, usage };
}
