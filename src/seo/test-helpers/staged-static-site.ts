import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PATH_FILE = join(process.cwd(), "node_modules/.cache/11tik-vitest-staged/staged-path.txt");

/** Read-only staged site built in vitest globalSetup (see staged-static-site-global-setup.mjs). */
export function getStagedStaticSite(): string {
  if (!existsSync(PATH_FILE)) {
    throw new Error(
      "Staged static site missing. Vitest globalSetup should build it before tests run.",
    );
  }
  const staged = readFileSync(PATH_FILE, "utf8").trim();
  if (!staged || !existsSync(staged)) {
    throw new Error("Staged static site path is stale or missing on disk.");
  }
  return staged;
}
