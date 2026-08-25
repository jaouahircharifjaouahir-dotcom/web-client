/**
 * Optional Chrome/Puppeteer helpers for loading translator/extension.
 * Primary translation path uses the extension's GTX HTTP API (no browser required).
 * Browser path is reserved for visual verification / future UI automation.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const EXTENSION_PATH = join(ROOT, "translator", "extension");

export function getExtensionLoadArgs() {
  if (!existsSync(join(EXTENSION_PATH, "manifest.json"))) {
    throw new Error(`Google Translate extension not found at ${EXTENSION_PATH}`);
  }
  return [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
  ];
}

export function browserAutomationStatus() {
  return {
    extensionPath: EXTENSION_PATH,
    extensionPresent: existsSync(join(EXTENSION_PATH, "manifest.json")),
    primaryEngine: "translate-pa.googleapis.com/v1/translate (client=gtx)",
    browserRequired: false,
    note: "Full-page Chrome translate UI is built into Chrome; this extension mainly does selection bubbles. Local runner uses the same TranslationAPI the extension calls.",
  };
}
