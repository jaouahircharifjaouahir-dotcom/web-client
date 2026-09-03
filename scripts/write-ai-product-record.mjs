/**
 * Publish the Phase 1B canonical AI product JSON as a static web-client asset.
 * Source: src/content/ai-product-record.json
 * Public URL: https://www.11tik.com/web-client/ai/11tik-youtube-thumbnail-extractor.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const AI_PRODUCT_RECORD_SOURCE_REL = "src/content/ai-product-record.json";
export const AI_PRODUCT_RECORD_PUBLIC_REL = "ai/11tik-youtube-thumbnail-extractor.json";
export const AI_PRODUCT_RECORD_PUBLIC_URL =
  "https://www.11tik.com/web-client/ai/11tik-youtube-thumbnail-extractor.json";

export function loadAiProductRecord() {
  return JSON.parse(readFileSync(join(ROOT, AI_PRODUCT_RECORD_SOURCE_REL), "utf8"));
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

/** Sync into Vite public/ so production builds copy it under /web-client/. */
export function writeAiProductRecordToPublic(record = loadAiProductRecord()) {
  const path = join(ROOT, "public", AI_PRODUCT_RECORD_PUBLIC_REL);
  writeJson(path, record);
  return path;
}

/** Write into staged assets for vitest / Workers static directory. */
export function writeAiProductRecordToStaged(staged, record = loadAiProductRecord()) {
  const path = join(staged, "web-client", AI_PRODUCT_RECORD_PUBLIC_REL);
  writeJson(path, record);
  return path;
}

export function writeAiProductRecordArtifacts(staged = null) {
  const record = loadAiProductRecord();
  const publicPath = writeAiProductRecordToPublic(record);
  const stagedPath = staged ? writeAiProductRecordToStaged(staged, record) : null;
  return { record, publicPath, stagedPath, publicUrl: AI_PRODUCT_RECORD_PUBLIC_URL };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const out = writeAiProductRecordArtifacts();
  console.log(JSON.stringify({ publicPath: out.publicPath, publicUrl: out.publicUrl }, null, 2));
}
