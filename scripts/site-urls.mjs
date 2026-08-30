import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "www.11tik.com";

export const SITE_HOST = HOST;

/** UX-only keyword chips. Do not treat them as ranking URLs (doorway risk). */
export function keywordLandingUrls() {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/content/keywordLandings.ts"), "utf8");
  return [...source.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => `https://${HOST}/?k=${match[1]}`);
}
