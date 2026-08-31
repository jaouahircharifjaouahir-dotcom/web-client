#!/usr/bin/env node
/**
 * Phase 17.1 — YouTube Thumbnail Resolution & Availability Study 2026
 * Implementation-ready methodology. Does NOT publish statistics until run completes.
 *
 * Usage:
 *   node scripts/seo/research-resolution-study.mjs --sample ids.txt --out reports/research-resolution-2026
 *
 * Input file: one public YouTube video ID per line (11 chars).
 * Output: raw CSV + JSON + summary template (no fabricated stats).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VARIANTS = [
  "maxresdefault.jpg",
  "hq720.jpg",
  "sddefault.jpg",
  "hqdefault.jpg",
  "mqdefault.jpg",
  "default.jpg",
];

const WEBP_VARIANTS = ["maxresdefault.webp", "hqdefault.webp"];

function parseArgs(argv) {
  const args = { sample: null, out: "reports/research-resolution-2026" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--sample") args.sample = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function buildUrl(videoId, file) {
  return `https://i.ytimg.com/vi/${videoId}/${file}`;
}

async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const contentType = res.headers.get("content-type") || "";
    const buf = Buffer.from(await res.arrayBuffer());
    const bytes = buf.length;
    let width = null;
    let height = null;
    let placeholder = false;
    // Lightweight placeholder heuristic: tiny JPEG/WebP under 3KB often = gray placeholder
    if (bytes > 0 && bytes < 3072) placeholder = true;
    // PNG/JPEG dimension sniff (minimal — full decode deferred to analysis phase)
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      // JPEG SOF0 marker scan (simplified)
      for (let i = 2; i < buf.length - 8; i++) {
        if (buf[i] === 0xff && buf[i + 1] === 0xc0) {
          height = buf.readUInt16BE(i + 5);
          width = buf.readUInt16BE(i + 7);
          if (width === 120 && height === 90) placeholder = true;
          break;
        }
      }
    }
    return {
      url,
      status: res.status,
      contentType,
      bytes,
      width,
      height,
      placeholder,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      url,
      status: 0,
      contentType: "",
      bytes: 0,
      width: null,
      height: null,
      placeholder: false,
      error: String(err?.message || err),
      elapsedMs: Date.now() - started,
    };
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.sample || !existsSync(args.sample)) {
    console.error("Provide --sample path/to/video-ids.txt (one ID per line)");
    process.exit(1);
  }
  const ids = readFileSync(args.sample, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[a-zA-Z0-9_-]{11}$/.test(l));
  if (!ids.length) {
    console.error("No valid 11-char video IDs in sample file");
    process.exit(1);
  }

  mkdirSync(args.out, { recursive: true });
  const observations = [];
  for (const videoId of ids) {
    for (const file of [...VARIANTS, ...WEBP_VARIANTS]) {
      const url = buildUrl(videoId, file);
      const row = { videoId, variant: file, ...(await probe(url)) };
      observations.push(row);
      process.stdout.write(".");
    }
  }
  console.log("");

  const csvHeader = "videoId,variant,url,status,contentType,bytes,width,height,placeholder,elapsedMs,error";
  const csv = [
    csvHeader,
    ...observations.map((r) =>
      [
        r.videoId,
        r.variant,
        r.url,
        r.status,
        r.contentType,
        r.bytes,
        r.width ?? "",
        r.height ?? "",
        r.placeholder,
        r.elapsedMs,
        r.error ?? "",
      ].join(","),
    ),
  ].join("\n");

  writeFileSync(join(args.out, "observations.csv"), `${csv}\n`, "utf8");
  writeFileSync(
    join(args.out, "observations.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), sampleSize: ids.length, observations }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(args.out, "methodology.md"),
    `# YouTube Thumbnail Resolution & Availability Study 2026\n\n## Status\nRAW OBSERVATIONS ONLY — summary statistics not computed in this phase.\n\n## Sample\n- IDs: ${ids.length}\n- Variants probed: ${VARIANTS.length + WEBP_VARIANTS.length}\n\n## Methodology\n1. For each public video ID, fetch i.ytimg.com variant URLs.\n2. Record HTTP status, content-type, bytes, dimensions when detectable.\n3. Flag 120×90 or &lt;3KB responses as likely placeholders.\n4. Do not publish aggregate rates until manual review.\n\n## Outputs\n- observations.csv\n- observations.json\n\n## Reproducibility\nRe-run with the same ID list and compare hashes of observations.json.\n`,
    "utf8",
  );
  console.log(`Wrote ${observations.length} observations to ${args.out}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
