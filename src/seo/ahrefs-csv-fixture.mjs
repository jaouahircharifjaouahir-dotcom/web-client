import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

export function readCsvFile(path) {
  const buf = readFileSync(path);
  const text =
    buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le") : buf.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0]
    .split("\t")
    .map((s) => s.replace(/^\uFEFF/, "").replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cols = line.split("\t").map((s) => s.replace(/^"|"$/g, ""));
    return Object.fromEntries(header.map((h, i) => [h, cols[i] || ""]));
  });
}

/** Ahrefs exports may live in errors/ (active crawl) or tests/fixtures/ahrefs/ (archived). */
export function loadAhrefsCsv(filename) {
  for (const dir of ["errors", "tests/fixtures/ahrefs"]) {
    const path = join(ROOT, dir, filename);
    if (existsSync(path)) return readCsvFile(path);
  }
  return null;
}
