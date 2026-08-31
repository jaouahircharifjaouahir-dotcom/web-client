/**
 * Build-time WebP generation for public blog + social PNG heroes.
 * Keeps originals; browsers load WebP via <picture> in static HTML.
 *
 * Usage: node scripts/generate-blog-webp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_DIRS = [path.join(ROOT, "public", "images", "blog")];
const WEBP_QUALITY = 85;

async function convertOne(pngPath) {
  const before = fs.statSync(pngPath).size;
  const meta = await sharp(pngPath).metadata();
  const webpPath = pngPath.replace(/\.png$/i, ".webp");
  const buf = await sharp(pngPath)
    .webp({ quality: WEBP_QUALITY, effort: 6, smartSubsample: true })
    .toBuffer();
  if (buf.length >= before) {
    if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);
    return { file: path.basename(pngPath), skipped: true, before, after: before, saved: 0, pct: 0 };
  }
  fs.writeFileSync(webpPath, buf);
  const after = buf.length;
  return {
    file: path.basename(pngPath),
    width: meta.width,
    height: meta.height,
    before,
    after,
    saved: before - after,
    pct: before ? Math.round((1 - after / before) * 100) : 0,
    hasAlpha: Boolean(meta.hasAlpha),
  };
}

export async function generateWebpVariants({ log = true } = {}) {
  const results = [];
  for (const dir of TARGET_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".png"))) {
      const row = await convertOne(path.join(dir, name));
      results.push(row);
      if (log) {
        console.log(
          `[webp] ${row.file}: ${row.before} → ${row.after} B (−${row.pct}%) ${row.width}x${row.height}`,
        );
      }
    }
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateWebpVariants()
    .then((rows) => {
      const totalBefore = rows.reduce((a, r) => a + r.before, 0);
      const totalAfter = rows.reduce((a, r) => a + r.after, 0);
      console.log(`[webp] done: ${rows.length} file(s), ${totalBefore} → ${totalAfter} B`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
