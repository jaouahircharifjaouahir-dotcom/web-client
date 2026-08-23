#!/usr/bin/env node
/**
 * Build Chrome/Firefox extension packages into dist-extension/.
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "extensions", "11tik-youtube-thumbnail");
const OUT = join(ROOT, "dist-extension");

const COPY_IGNORE = new Set(["shared/extension.test.js", "shared/extension.vitest.ts", "README.md"]);

function copyExtension(targetDir) {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  function walk(relDir = "") {
    const abs = join(SRC, relDir);
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const relPath = join(relDir, entry.name).replace(/\\/g, "/");
      if (COPY_IGNORE.has(relPath)) continue;
      const dest = join(targetDir, relPath);
      if (entry.isDirectory()) {
        mkdirSync(dest, { recursive: true });
        walk(relPath);
      } else {
        cpSync(join(abs, entry.name), dest);
      }
    }
  }

  walk();
}

function validateManifest(dir, label) {
  const manifestPath = join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  for (const key of ["manifest_version", "name", "version", "action", "icons"]) {
    if (!manifest[key]) throw new Error(`${label}: manifest missing ${key}`);
  }

  if (manifest.manifest_version !== 3) throw new Error(`${label}: manifest_version must be 3`);
  if (!manifest.action?.default_popup) throw new Error(`${label}: missing default_popup`);
  if (manifest.background) throw new Error(`${label}: unnecessary background entry`);

  for (const banned of ["tabs", "scripting", "downloads", "clipboardWrite", "history", "cookies", "webRequest"]) {
    if ((manifest.permissions || []).includes(banned) && banned !== "scripting") {
      /* scripting removed intentionally */
    }
    if ((manifest.permissions || []).includes("tabs")) throw new Error(`${label}: tabs permission present`);
  }

  if ((manifest.host_permissions || []).some((h) => h.includes("*://*/*"))) {
    throw new Error(`${label}: overly broad host permission`);
  }

  for (const size of ["16", "32", "48", "128"]) {
    if (!statSync(join(dir, manifest.icons[size])).isFile()) {
      throw new Error(`${label}: missing icon ${size}`);
    }
  }

  const popupJs = readFileSync(join(dir, "popup.js"), "utf8");
  if (/eval\s*\(/i.test(popupJs)) throw new Error(`${label}: unsafe eval in popup.js`);
  if (/11tik\.com/i.test(popupJs) && /fetch\s*\(\s*['"]https:\/\/www\.11tik\.com/i.test(popupJs)) {
    throw new Error(`${label}: fetch to 11tik.com detected`);
  }

  return manifest;
}

function zipDirectory(sourceDir, zipPath) {
  rmSync(zipPath, { force: true });
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" },
  );
}

export async function buildExtension(targetBrowsers = ["chrome", "firefox"]) {
  mkdirSync(OUT, { recursive: true });
  execSync("node scripts/build-extension-icons.mjs", { cwd: ROOT, stdio: "inherit" });

  const results = {};

  if (targetBrowsers.includes("chrome")) {
    const chromeDir = join(OUT, "chrome");
    copyExtension(chromeDir);
    // Chrome ignores gecko settings; strip Firefox-only AMO metadata so the
    // Chrome package stays free of Firefox-specific declaration fields.
    const chromeManifestPath = join(chromeDir, "manifest.json");
    const chromeManifest = JSON.parse(readFileSync(chromeManifestPath, "utf8"));
    if (chromeManifest.browser_specific_settings?.gecko) {
      delete chromeManifest.browser_specific_settings.gecko.data_collection_permissions;
    }
    if (chromeManifest.browser_specific_settings?.gecko_android) {
      delete chromeManifest.browser_specific_settings.gecko_android;
    }
    if (
      chromeManifest.browser_specific_settings &&
      Object.keys(chromeManifest.browser_specific_settings).length === 0
    ) {
      delete chromeManifest.browser_specific_settings;
    }
    writeFileSync(chromeManifestPath, `${JSON.stringify(chromeManifest, null, 2)}\n`);
    results.chrome = validateManifest(chromeDir, "chrome");
    zipDirectory(chromeDir, join(OUT, "11tik-chrome.zip"));
  }

  if (targetBrowsers.includes("firefox")) {
    const firefoxDir = join(OUT, "firefox");
    copyExtension(firefoxDir);
    const manifest = validateManifest(firefoxDir, "firefox");
    const gecko = manifest.browser_specific_settings?.gecko;
    if (!gecko?.id) {
      throw new Error("firefox: missing gecko extension id");
    }
    if (gecko.strict_min_version !== "140.0") {
      throw new Error('firefox: gecko.strict_min_version must be "140.0"');
    }
    const required = gecko.data_collection_permissions?.required;
    if (!Array.isArray(required) || required.length !== 1 || required[0] !== "none") {
      throw new Error('firefox: data_collection_permissions.required must be ["none"]');
    }
    if (gecko.data_collection_permissions?.optional) {
      throw new Error("firefox: optional data_collection_permissions must not be declared");
    }
    const android = manifest.browser_specific_settings?.gecko_android;
    if (!android) {
      throw new Error("firefox: gecko_android is required for AMO data_collection_permissions lint");
    }
    if (android.strict_min_version !== "142.0") {
      throw new Error('firefox: gecko_android.strict_min_version must be "142.0"');
    }
    const androidRequired = android.data_collection_permissions?.required;
    if (!Array.isArray(androidRequired) || androidRequired.length !== 1 || androidRequired[0] !== "none") {
      throw new Error('firefox: gecko_android.data_collection_permissions.required must be ["none"]');
    }
    if (android.data_collection_permissions?.optional) {
      throw new Error("firefox: gecko_android optional data_collection_permissions must not be declared");
    }
    results.firefox = manifest;
    zipDirectory(firefoxDir, join(OUT, "11tik-firefox.zip"));
  }

  writeFileSync(join(OUT, "build-report.json"), JSON.stringify(results, null, 2));
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = process.argv[2] || "all";
  const targets =
    arg === "chrome" ? ["chrome"] : arg === "firefox" ? ["firefox"] : ["chrome", "firefox"];
  buildExtension(targets)
    .then(() => console.log("Extension build complete:", OUT))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
