import { readFileSync } from "node:fs";
import { join } from "node:path";

function pathMatchesPattern(pathname: string, pattern: string): boolean {
  if (pattern.startsWith("!/")) {
    return pathMatchesPattern(pathname, pattern.slice(1));
  }
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1);
    return pathname === prefix.slice(0, -1) || pathname.startsWith(prefix);
  }
  if (pattern.endsWith("*")) {
    return pathname.startsWith(pattern.slice(0, -1));
  }
  return pathname === pattern;
}

/** Simulates Cloudflare negative run_worker_first: positive match minus exclusions. */
export function matchesRunWorkerFirst(pathname: string): boolean {
  const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));
  const patterns = wrangler.assets.run_worker_first as string[];
  let positive = false;
  let negative = false;
  for (const pattern of patterns) {
    if (pattern.startsWith("!/")) {
      if (pathMatchesPattern(pathname, pattern.slice(1))) negative = true;
    } else if (pathMatchesPattern(pathname, pattern)) {
      positive = true;
    }
  }
  return positive && !negative;
}

export function readWranglerConfig() {
  return JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"));
}
