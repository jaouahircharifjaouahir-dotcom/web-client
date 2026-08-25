#!/usr/bin/env node
/**
 * Analyze the Google Translate Chrome extension under translator/extension/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXTENSION_ENDPOINTS, EXTENSION_SELECTORS } from "../selectors/extension-selectors.mjs";
import { extensionPresent, extractExtensionApiKey } from "../capture/gtx-client.mjs";
import { buildGtxLocaleCoverage } from "../locale/gtx-locale-map.mjs";
import { browserAutomationStatus } from "../browser/chrome-profile.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXT = join(ROOT, "translator", "extension");
const OUT = join(ROOT, "translator", "reports", "extension-analysis.json");

function analyze() {
  const manifest = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8"));
  const popup = readFileSync(join(EXT, "popup_compiled.js"), "utf8");
  const main = readFileSync(join(EXT, "main_compiled.js"), "utf8");

  const findings = {
    name: "Google Translate Chrome Extension",
    version: manifest.version,
    manifestVersion: manifest.manifest_version,
    permissions: manifest.permissions,
    contentScripts: manifest.content_scripts,
    background: manifest.background,
    howItWorks: {
      selectionBubble:
        "bubble_compiled.js injects on all URLs; selected text is sent to TranslationAPI and shown in a popup bubble.",
      popupUi: "popup.html + popup_compiled.js translate typed/selected text and offer options.",
      pageTranslationNote:
        "Extension UI states page translation is built into Chrome. Full-page translation is NOT this extension's primary job; it uses translate.google.com/translate?u=… for image/page links.",
      translationEngine:
        "trans.common.TranslationAPI client=gtx → https://translate-pa.googleapis.com/v1/translate with embedded key from getApiKey().",
      languageSelection:
        "chrome.storage.local stores targetLang; Options page sets primary language; normLang() normalizes zh/he variants.",
      domMutation:
        "Bubble overlays UI; does not rewrite whole page DOM. Page rewrite would come from Chrome built-in translate or translate.google.com proxy.",
    },
    endpoints: EXTENSION_ENDPOINTS,
    selectors: EXTENSION_SELECTORS,
    embeddedApiKeyPresent: /getApiKey\(\)\{return"[^"]+"\}/.test(popup) || /getApiKey\(\)\{return"[^"]+"\}/.test(main),
    apiKeyExtractable: false,
    fileSizes: {
      popup_compiled: statSync(join(EXT, "popup_compiled.js")).size,
      main_compiled: statSync(join(EXT, "main_compiled.js")).size,
      bubble_compiled: statSync(join(EXT, "bubble_compiled.js")).size,
    },
    localAutomationStrategy: {
      chosen: "Reuse extension TranslationAPI (translate-pa GTX) via Node runner",
      why: "Same engine the extension uses for text translation; deterministic; resumable; DOM-aware via scripts/i18n/dom-translate.mjs; no production leakage.",
      notChosen: "Drive Chrome UI for every page (fragile, slow, page-translate is Chrome-native not extension).",
    },
    localeCoverage: buildGtxLocaleCoverage(),
    browser: browserAutomationStatus(),
  };

  try {
    extractExtensionApiKey();
    findings.apiKeyExtractable = true;
  } catch {
    findings.apiKeyExtractable = false;
  }

  return findings;
}

if (!extensionPresent()) {
  console.error("translator/extension missing");
  process.exit(1);
}

const report = analyze();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`\nWrote ${OUT}`);
