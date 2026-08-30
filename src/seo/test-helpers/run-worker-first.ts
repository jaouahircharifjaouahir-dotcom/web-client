import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  matchesRunWorkerFirstPatterns,
} from "./cloudflare-run-worker-first.ts";

export {
  cloudflarePathMatchesPattern,
  matchesRunWorkerFirstPatterns,
  PHASE7B_LOCALE_RWF_NEGATIVES,
  PHASE7B_RUN_WORKER_FIRST,
  PRODUCTION_RUN_WORKER_FIRST,
  splitPathnameSegments,
} from "./cloudflare-run-worker-first.ts";

/** Simulates Cloudflare negative run_worker_first for production wrangler.jsonc. */
export function matchesRunWorkerFirst(pathname: string): boolean {
  const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));
  const patterns = wrangler.assets.run_worker_first as string[];
  return matchesRunWorkerFirstPatterns(pathname, patterns);
}

export function readWranglerConfig() {
  return JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));
}
