/**
 * Build migration-ready atomic legacy → clean redirect artifact.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRouteManifest } from "./build-route-manifest.mjs";
import {
  buildAtomicRedirectMap,
  buildLegacyPRedirectsClean,
  summarizeAtomicRedirectMap,
  validateAtomicRedirectMap,
} from "../../workers/clean-url-legacy-redirects.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ATOMIC_REDIRECTS_REL = join("web-client", "i18n", "atomic-legacy-redirects.json");
export const WORKER_ATOMIC_REDIRECTS_REL = join("workers", "atomic-legacy-redirects.json");

/**
 * @param {object} [manifest]
 */
export function buildAtomicRedirectsDocument(manifest = buildRouteManifest()) {
  const rules = buildAtomicRedirectMap(manifest);
  const validation = validateAtomicRedirectMap(rules);
  if (!validation.ok) {
    throw new Error(`Invalid atomic redirect map: ${validation.errors.join("; ")}`);
  }
  const summary = summarizeAtomicRedirectMap(rules);
  return {
    v: 1,
    generatedAt: new Date().toISOString(),
    migrationReady: true,
    activeInProduction: true,
    counts: summary,
    legacyPRedirectsClean: buildLegacyPRedirectsClean(manifest),
    rules,
  };
}

export function writeAtomicRedirectsArtifact(writeFileFn, staged, manifest = buildRouteManifest()) {
  const doc = buildAtomicRedirectsDocument(manifest);
  const body = `${JSON.stringify(doc)}\n`;
  writeFileFn(join(staged, ATOMIC_REDIRECTS_REL), body);
  writeWorkerAtomicRedirectsArtifact(doc);
  return doc;
}

export function writeWorkerAtomicRedirectsArtifact(doc = buildAtomicRedirectsDocument()) {
  const abs = join(ROOT, WORKER_ATOMIC_REDIRECTS_REL);
  writeFileSync(abs, `${JSON.stringify(doc)}\n`);
  return abs;
}

export function readWorkerAtomicRedirectsArtifact() {
  const abs = join(ROOT, WORKER_ATOMIC_REDIRECTS_REL);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, "utf8"));
}
