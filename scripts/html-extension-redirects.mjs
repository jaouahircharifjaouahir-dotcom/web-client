import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Build Cloudflare Workers Assets `_redirects` rules that consolidate
 * extensionless content URLs → canonical `*.html` (sitemap/hreflang/inlinks).
 *
 * Required alongside `html_handling: "none"`. Without these rules, SPA
 * not_found_handling would soft-200 extensionless paths (Ahrefs: redirect
 * targets with 0 href inlinks).
 *
 * @param {string} staged Absolute path to dist-assets root
 * @returns {string} `_redirects` file body
 */
export function buildHtmlExtensionRedirects(staged) {
  const rules = [];
  const skipDir = new Set(["web-client", ".wrangler"]);

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      const abs = join(dir, name);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (skipDir.has(name)) continue;
        walk(abs);
        continue;
      }
      if (!name.endsWith(".html")) continue;
      if (name === "index.html" || name === "404.html") continue;

      const rel = relative(staged, abs).split(sep).join("/");
      if (!rel || rel.includes("..")) continue;
      const htmlPath = `/${rel}`;
      const extensionless = htmlPath.replace(/\.html$/i, "");
      if (!extensionless || extensionless === htmlPath) continue;
      // Exact sources only — never use :placeholders (they would match *.html too).
      rules.push(`${extensionless} ${htmlPath} 301`);
    }
  }

  walk(staged);
  rules.sort();
  const header = [
    "# Generated: extensionless → *.html canonicals",
    "# Pairs with wrangler assets.html_handling=none (File 1 / File 15).",
    "# Do not use :placeholders here — they match dots and would loop *.html.",
  ];
  return `${header.join("\n")}\n${rules.join("\n")}${rules.length ? "\n" : ""}`;
}
