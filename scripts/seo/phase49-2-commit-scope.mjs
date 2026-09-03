#!/usr/bin/env node
/**
 * Phase 49.2 — commit scope audit for homepage global SEO release.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { getTargetLocales } from "../i18n/target-languages.mjs";
import { HOME_META_EN } from "../i18n/translate-homepage-meta.mjs";
import homeFaqEn from "../../src/i18n/home-faq.en.json" with { type: "json" };

const ROOT = process.cwd();
const OUT = join(ROOT, "reports/phase49-2");
const TARGET = getTargetLocales();

export const PHASE492_APPROVED_PATHS = [
  "content/translations/home-faq",
  "content/translations/home-meta",
  "public/i18n/home-faq",
  ...TARGET.map((l) => `public/i18n/ui/${l}.json`),
  "scripts/i18n/home-faq-links.mjs",
  "scripts/i18n/translate-home-faq.mjs",
  "scripts/i18n/translate-homepage-meta.mjs",
  "scripts/i18n/write-home-faq-public.mjs",
  "scripts/i18n/home-faq-shell.mjs",
  "scripts/stage-worker-assets.mjs",
  "scripts/seo/phase49-1-homepage-global-seo.mjs",
  "src/components/HomeFaq.tsx",
  "src/i18n/homeFaq.ts",
  "src/i18n/catalog.json",
  "src/i18n/catalog-en.json",
  "src/seo/phase48-homepage-faq.test.ts",
  "src/seo/phase49-1-homepage-global-seo.test.ts",
  "workers/locale-meta.json",
];

export const PHASE492_EXCLUDED_PATTERNS = [
  /^\.tmp-/,
  /^\.wrangler\//,
  /^content\/translations-archive\//,
  /^content\/translations\/(?!home-faq|home-meta)/,
  /^docs\/blogger-pages\//,
  /^\.github\//,
  /^scripts\/cf-p-edge-rules\.mjs$/,
  /^package\.json$/,
];

function git(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
}

function listDirFiles(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return [];
  const st = readdirSync(abs, { withFileTypes: true });
  if (st.some((d) => d.isFile())) {
    return readdirSync(abs).map((f) => `${rel}/${f}`.replace(/\\/g, "/"));
  }
  const out = [];
  for (const d of st) {
    if (d.isDirectory()) out.push(...listDirFiles(`${rel}/${d.name}`));
    else out.push(`${rel}/${d.name}`.replace(/\\/g, "/"));
  }
  return out;
}

export function expandApprovedPaths() {
  const files = new Set();
  for (const p of PHASE492_APPROVED_PATHS) {
    const abs = join(ROOT, p);
    if (!existsSync(abs)) continue;
    if (p.endsWith(".mjs") || p.endsWith(".tsx") || p.endsWith(".ts") || p.endsWith(".json")) {
      files.add(p.replace(/\\/g, "/"));
    } else {
      for (const f of listDirFiles(p)) files.add(f);
    }
  }
  return [...files].sort();
}

export function auditCommitScope() {
  const status = git("git status --short");
  const changed = status
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const path = line.slice(3).trim().replace(/\\/g, "/");
      return { raw: line, path, staged: line.startsWith("A ") || line.startsWith("M ") || line.startsWith("R ") };
    });
  const approved = expandApprovedPaths();
  const approvedSet = new Set(approved);
  const inScope = changed.filter((r) => approvedSet.has(r.path) || approved.some((a) => r.path.startsWith(a + "/")));
  const outOfScope = changed.filter((r) => !approvedSet.has(r.path) && !approved.some((a) => r.path.startsWith(a + "/")));
  return {
    approvedFileCount: approved.length,
    approvedFiles: approved,
    changedInScope: inScope.map((r) => r.path),
    changedOutOfScope: outOfScope.map((r) => r.path),
    contentLock: {
      titleEn: HOME_META_EN.title,
      descriptionEn: HOME_META_EN.description,
      faqCount: homeFaqEn.items.length,
      titleMatches:
        HOME_META_EN.title ===
        "YouTube Thumbnail Extractor — Free Downloader | 11tik",
      descriptionMatches:
        HOME_META_EN.description ===
        "Free YouTube Thumbnail Extractor: download or grab public stills from a URL (watch or Shorts). Client-side; bulk up to 50. Not a video downloader.",
    },
    excludedPatterns: PHASE492_EXCLUDED_PATTERNS.map((r) => String(r)),
  };
}

const isMain = process.argv[1]?.endsWith("phase49-2-commit-scope.mjs");
if (isMain) {
  mkdirSync(OUT, { recursive: true });
  const audit = auditCommitScope();
  writeFileSync(join(OUT, "COMMIT_SCOPE_AUDIT.json"), `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify({ approved: audit.approvedFileCount, inScope: audit.changedInScope.length, outOfScope: audit.changedOutOfScope.length }, null, 2));
}
