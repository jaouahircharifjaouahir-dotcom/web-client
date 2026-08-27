/**
 * Compress public/images/blog PNGs that exceed Ahrefs "image file size too large"
 * (~1MB). Resizes to the declared hero box (1200x630) and writes palette PNGs.
 *
 * Usage: node scripts/optimize-blog-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "public", "images", "blog");
const MAX_BYTES = 1024 * 1024;
const TARGET_W = 1200;
const TARGET_H = 630;

async function compressOne(srcPath, quality) {
  const tmp = `${srcPath}.opt.tmp`;
  await sharp(srcPath)
    .resize(TARGET_W, TARGET_H, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, palette: true, quality, effort: 10 })
    .toFile(tmp);
  return tmp;
}

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".png"));
  let changed = 0;
  for (const f of files) {
    const p = path.join(DIR, f);
    const before = fs.statSync(p).size;
    if (before <= MAX_BYTES) continue;

    const meta = await sharp(p).metadata();
    let tmp = await compressOne(p, 80);
    let after = fs.statSync(tmp).size;
    if (after > MAX_BYTES) {
      fs.unlinkSync(tmp);
      tmp = await compressOne(p, 55);
      after = fs.statSync(tmp).size;
    }
    fs.renameSync(tmp, p);
    changed += 1;
    console.log(
      `${f}: ${(before / 1024).toFixed(0)}KB ${meta.width}x${meta.height} -> ${(after / 1024).toFixed(0)}KB ${TARGET_W}x${TARGET_H}`,
    );
  }
  console.log(`done: ${changed} file(s) optimized (threshold ${MAX_BYTES} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
