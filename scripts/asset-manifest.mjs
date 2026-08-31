#!/usr/bin/env node
/**
 * Deterministic dist-assets manifest for build integrity monitoring.
 * Usage: npm run asset:manifest
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { buildIndexNowSnapshot } from "./i18n/indexnow-snapshot.mjs";
import { INDEXNOW_KEY } from "./i18n/indexnow-key.mjs";
import { parseSitemapLocs } from "../workers/sitemap-canonicals.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAGED = join(ROOT, "dist-assets");
const REPORT_DIR = join(ROOT, "reports");
const REPORT_PATH = join(REPORT_DIR, "asset-manifest.json");

export const CRITICAL_REL_PATHS = Object.freeze([
  "index.html",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "feeds/posts/default",
  "feeds/posts/default.rss",
  "p/about.html",
  "2026/08/how-to-download-youtube-thumbnail.html",
  "l/fr/index.html",
  "l/fr/p/about.html",
  "l/fr/2026/08/how-to-download-youtube-thumbnail.html",
  `${INDEXNOW_KEY}.txt`,
]);

export function sha256File(absPath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(absPath));
  return hash.digest("hex");
}

export function walkFiles(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkFiles(abs, base, out);
    else {
      out.push({
        rel: relative(base, abs).split("\\").join("/"),
        abs,
        size: st.size,
      });
    }
  }
  return out;
}

export function findDuplicateContentGroups(files) {
  const bySig = new Map();
  for (const f of files) {
    const buf = readFileSync(f.abs);
    const sig = `${buf.length}:${buf.subarray(0, 64).toString("hex")}`;
    if (!bySig.has(sig)) bySig.set(sig, []);
    bySig.get(sig).push(f.rel);
  }
  return [...bySig.values()].filter((group) => group.length > 1);
}

export function findWebClientAssets(files) {
  return files.filter((f) => f.rel.startsWith("web-client/"));
}

export function buildAssetManifest(stagedDir = STAGED, options = {}) {
  if (!existsSync(stagedDir)) {
    throw new Error(`dist-assets missing: ${stagedDir}. Run npm run build first.`);
  }

  const files = walkFiles(stagedDir);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const largestFiles = [...files].sort((a, b) => b.size - a.size).slice(0, 15).map((f) => ({
    path: f.rel,
    bytes: f.size,
  }));

  const criticalFiles = {};
  const criticalMissing = [];
  for (const rel of CRITICAL_REL_PATHS) {
    const abs = join(stagedDir, rel);
    if (existsSync(abs)) {
      criticalFiles[rel] = { bytes: statSync(abs).size, sha256: sha256File(abs) };
    } else {
      criticalMissing.push(rel);
    }
  }

  let sitemapUrlCount = null;
  const sitemapPath = join(stagedDir, "sitemap.xml");
  if (existsSync(sitemapPath)) {
    sitemapUrlCount = parseSitemapLocs(readFileSync(sitemapPath, "utf8")).length;
  }

  let indexNowUrlCount = null;
  try {
    indexNowUrlCount = buildIndexNowSnapshot(stagedDir).urlCount;
  } catch {
    indexNowUrlCount = null;
  }

  const webClient = findWebClientAssets(files);
  const webClientJs = webClient.filter((f) => f.rel.endsWith(".js"));
  const webClientCss = webClient.filter((f) => f.rel.endsWith(".css"));

  const bloggerPath = join(stagedDir, "web-client", "blogger-app.js");
  const bloggerApp = existsSync(bloggerPath)
    ? { path: "web-client/blogger-app.js", bytes: statSync(bloggerPath).size }
    : null;

  const indexHtmlPath = join(stagedDir, "index.html");
  let initialJs = null;
  if (existsSync(indexHtmlPath)) {
    const html = readFileSync(indexHtmlPath, "utf8");
    const srcRe = /<script[^>]+defer[^>]+src="(\/web-client\/[^"?]+\.js[^"]*)"/gi;
    const refs = [];
    let m;
    while ((m = srcRe.exec(html))) {
      const rel = m[1].replace(/^\//, "").replace(/\?.*$/, "");
      if (!refs.includes(rel)) refs.push(rel);
    }
    let raw = 0;
    for (const rel of refs) {
      const abs = join(stagedDir, rel);
      if (existsSync(abs)) raw += statSync(abs).size;
    }
    initialJs = { files: refs, rawBytes: raw };
  }

  const imageFiles = files.filter((f) => f.rel.startsWith("web-client/images/"));
  const webpFiles = imageFiles.filter((f) => f.rel.endsWith(".webp"));
  const pngFiles = imageFiles.filter((f) => f.rel.endsWith(".png"));
  const sumBytes = (list) => list.reduce((s, f) => s + f.size, 0);
  const largestOf = (list) =>
    [...list].sort((a, b) => b.size - a.size).slice(0, 5).map((f) => ({ path: f.rel, bytes: f.size }));

  const uiDir = join(stagedDir, "web-client", "i18n", "ui");
  const uiLocalePacks = existsSync(uiDir)
    ? readdirSync(uiDir).filter((n) => n.endsWith(".json")).length
    : 0;

  let gitSha = null;
  try {
    gitSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    gitSha = options.gitSha ?? null;
  }

  return {
    gitSha,
    stagedDir,
    /** Physical files on disk (Node readdir). */
    physicalFileCount: files.length,
    fileCount: files.length,
    /**
     * Wrangler dry-run often reports a higher asset count than physical files
     * (routing-derived keys). Track separately; do not fail on delta alone.
     */
    wranglerAssetCount: options.wranglerAssetCount ?? null,
    wranglerAssetCountNote:
      "Compare `npx wrangler deploy --dry-run` Read N files line; delta vs physicalFileCount is normal (redirect indexing).",
    totalBytes,
    htmlFileCount: files.filter((f) => f.rel.endsWith(".html")).length,
    sitemapUrlCount,
    indexNowUrlCount,
    largestFiles,
    duplicateGroups: findDuplicateContentGroups(files),
    criticalFiles,
    criticalMissing,
    bloggerApp,
    initialJs,
    images: {
      webpCount: webpFiles.length,
      pngCount: pngFiles.length,
      webpTotalBytes: sumBytes(webpFiles),
      pngTotalBytes: sumBytes(pngFiles),
      largestWebp: largestOf(webpFiles),
      largestPng: largestOf(pngFiles),
    },
    uiLocalePacks,
    webClient: {
      fileCount: webClient.length,
      jsCount: webClientJs.length,
      cssCount: webClientCss.length,
      largestJs: webClientJs.sort((a, b) => b.size - a.size).slice(0, 5).map((f) => ({ path: f.rel, bytes: f.size })),
    },
  };
}

function main() {
  const manifest = buildAssetManifest();
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log("Asset manifest");
  console.log(`physicalFileCount=${manifest.physicalFileCount} totalBytes=${manifest.totalBytes}`);
  console.log(`sitemapUrlCount=${manifest.sitemapUrlCount} indexNowUrlCount=${manifest.indexNowUrlCount}`);
  console.log(
    `bloggerAppBytes=${manifest.bloggerApp?.bytes ?? "missing"} initialJsRaw=${manifest.initialJs?.rawBytes ?? "n/a"}`,
  );
  console.log(
    `webpTotal=${manifest.images.webpTotalBytes} pngTotal=${manifest.images.pngTotalBytes} uiLocalePacks=${manifest.uiLocalePacks}`,
  );
  console.log(`criticalMissing=${manifest.criticalMissing.length}`);
  if (manifest.criticalMissing.length) {
    for (const m of manifest.criticalMissing) console.log(`  missing: ${m}`);
  }
  console.log(`JSON report: ${REPORT_PATH}`);

  if (manifest.criticalMissing.length) process.exit(1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();

export { REPORT_PATH };
