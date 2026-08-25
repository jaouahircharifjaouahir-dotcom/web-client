/**
 * Build-time provider: Chrome Google Translate extension engine (GTX).
 * Implements the same translate-pa One Platform API the extension uses.
 */
import { translatePayloadWithGtx } from "../../translator/capture/extract-translated.mjs";
import { smokeTestGtx, extensionPresent } from "../../translator/capture/gtx-client.mjs";
import { gtxCodeForLocale } from "../../translator/locale/gtx-locale-map.mjs";

export async function translateStructuredPayload(sourcePayload, { locale, env }) {
  if (!extensionPresent()) {
    throw new Error("translator/extension is missing — place the Google Translate Chrome extension there");
  }
  if (!gtxCodeForLocale(locale)) {
    throw new Error(`Locale not supported by Chrome GTX mapping: ${locale}`);
  }
  return translatePayloadWithGtx(sourcePayload, { locale, env });
}

export async function smokeTestChromeGtx(_env) {
  return smokeTestGtx();
}
