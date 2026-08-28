import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateStaticSite } from "../../../scripts/generate-static-site.mjs";

const CACHE_DIR = join(process.cwd(), "node_modules/.cache/11tik-vitest-staged");
const PATH_FILE = join(CACHE_DIR, "staged-path.txt");
const BUILD_MS_FILE = join(CACHE_DIR, "build-ms.txt");

/** Build once in the main process so workers only read files (avoids Vitest RPC stalls). */
export default async function globalSetup() {
  mkdirSync(CACHE_DIR, { recursive: true });

  let staged = existsSync(PATH_FILE) ? readFileSync(PATH_FILE, "utf8").trim() : "";
  if (!staged || !existsSync(staged)) {
    staged = mkdtempSync(join(tmpdir(), "11tik-vitest-staged-"));
    const started = Date.now();
    generateStaticSite(staged);
    writeFileSync(BUILD_MS_FILE, String(Date.now() - started), "utf8");
    writeFileSync(PATH_FILE, staged, "utf8");
  }

  return async () => {
    if (existsSync(staged)) rmSync(staged, { recursive: true, force: true });
    if (existsSync(PATH_FILE)) rmSync(PATH_FILE, { force: true });
    if (existsSync(BUILD_MS_FILE)) rmSync(BUILD_MS_FILE, { force: true });
  };
}
