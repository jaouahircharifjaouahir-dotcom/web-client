/**
 * Compress public/images/posts PNGs that exceed ~1MB (Ahrefs image size).
 * Keeps the same filename/extension and aspect ratio. Does not rewrite HTML.
 *
 * Usage: node scripts/optimize-post-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "public", "images", "posts");
const MAX_BYTES = 1024 * 1024;
/** Prefer keeping native size; only scale down if palette PNG still exceeds MAX. */
const MAX_EDGE = 1536;

const TARGETS = [
  "batch-hero.png",
  "maxresdefault-hero.png",
  "screenshot-vs-real-hero.png",
];

async function compressOne(srcPath, { width, height, quality }) {
  const tmp = `${srcPath}.opt.tmp`;
  let pipeline = sharp(srcPath);
  if (width && height) {
    pipeline = pipeline.resize(width, height, { fit: "inside", withoutEnlargement: true });
  }
  await pipeline.png({ compressionLevel: 9, palette: true, quality, effort: 10 }).toFile(tmp);
  return tmp;
}

async function optimizeFile(name) {
  const p = path.join(DIR, name);
  if (!fs.existsSync(p)) {
    console.warn(`skip missing: ${name}`);
    return null;
  }
  const before = fs.statSync(p).size;
  const meta = await sharp(p).metadata();
  const origW = meta.width || MAX_EDGE;
  const origH = meta.height || Math.round((MAX_EDGE * 2) / 3);

  const attempts = [
    { quality: 80, width: origW, height: origH },
    { quality: 55, width: origW, height: origH },
    { quality: 70, width: Math.min(origW, 1200), height: Math.min(origH, 800) },
    { quality: 50, width: Math.min(origW, 1200), height: Math.min(origH, 800) },
  ];

  let best = null;
  for (const attempt of attempts) {
    const tmp = await compressOne(p, attempt);
    const after = fs.statSync(tmp).size;
    const outMeta = await sharp(tmp).metadata();
    if (!best || after < best.after) {
      if (best?.tmp && fs.existsSync(best.tmp)) fs.unlinkSync(best.tmp);
      best = { tmp, after, width: outMeta.width, height: outMeta.height, quality: attempt.quality };
    } else {
      fs.unlinkSync(tmp);
    }
    if (after <= MAX_BYTES) break;
  }

  if (!best) return null;
  fs.renameSync(best.tmp, p);
  return {
    name,
    before,
    after: best.after,
    beforeDim: `${origW}x${origH}`,
    afterDim: `${best.width}x${best.height}`,
  };
}

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`missing dir: ${DIR}`);
    process.exit(1);
  }
  const results = [];
  for (const name of TARGETS) {
    const row = await optimizeFile(name);
    if (row) {
      results.push(row);
      console.log(
        `${row.name}: ${(row.before / 1024).toFixed(0)}KB ${row.beforeDim} -> ${(row.after / 1024).toFixed(0)}KB ${row.afterDim}`,
      );
    }
  }
  const offenders = results.filter((r) => r.after > MAX_BYTES);
  console.log(`done: ${results.length} file(s); threshold ${MAX_BYTES} bytes`);
  if (offenders.length) {
    console.error(
      "still over 1MB:",
      offenders.map((r) => `${r.name}=${r.after}`).join(", "),
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
