import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildAtomicRedirectMap } from "../workers/clean-url-legacy-redirects.js";

/**
 * Build Cloudflare Workers Assets `_redirects` with atomic legacy → clean 301 rules.
 * Phase 53: no extensionless → `.html` hops for migrated public content.
 *
 * @param {string} staged Absolute path to dist-assets root (unused; kept for API compat)
 * @param {{ manifest?: object }} [options]
 * @returns {string} `_redirects` file body
 */
export function buildHtmlExtensionRedirects(staged, options = {}) {
  void staged;
  const rules = buildAtomicRedirectMap(options.manifest).map((rule) => `${rule.from} ${rule.to} 301`);
  const merged = [...new Set(rules)].sort();
  const header = [
    "# Generated: atomic legacy → clean URL migration (Phase 53).",
    "# Pairs with wrangler assets.html_handling=none.",
    "# Do not use :placeholders here — they match dots and would loop *.html.",
  ];
  return `${header.join("\n")}\n${merged.join("\n")}${merged.length ? "\n" : ""}`;
}
