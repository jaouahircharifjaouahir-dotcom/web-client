#!/usr/bin/env node
/**
 * Phase 49.2 — live homepage global SEO verification after deploy.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { extractMeta } from "./lib/html-extract.mjs";
import { getTargetLocales } from "../i18n/target-languages.mjs";
import { HOME_META_EN } from "../i18n/translate-homepage-meta.mjs";
import homeFaqEn from "../../src/i18n/home-faq.en.json" with { type: "json" };
import localeMeta from "../../workers/locale-meta.json" with { type: "json" };

const ROOT = process.cwd();
const OUT = join(ROOT, "reports/phase49-2");
const PRE_COMMIT = "75a21a0927a8cf35596e4cf377f82d7a8500d311";
const TARGET = getTargetLocales();
const PROBE_LOCALES = ["fr", "ar", "de", "es", "pt", "ja", "fa", "he", "ur"];

function esc(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function git(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function localeHomeUrl(code) {
  return code === "en" ? "https://www.11tik.com/" : `https://${code}.11tik.com/l/${code}/`;
}

async function probeLocale(code) {
  const url = localeHomeUrl(code);
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(25000) });
  const html = await res.text();
  const meta = extractMeta(html);
  const faqSection = html.match(/<section class="yte-home-faq"[\s\S]*?<\/section>/i)?.[0] ?? "";
  const h3Count = (faqSection.match(/<h3/gi) || []).length;
  const faqLinks = [...faqSection.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const junkLinks = faqLinks.filter((h) => /\/music\/|backlink/i.test(h));
  const expectedHost = code === "en" ? "www.11tik.com" : `${code}.11tik.com`;
  const sameLocaleLinks =
    code === "en"
      ? faqLinks.every((h) => h.includes("www.11tik.com") || h.startsWith("/"))
      : faqLinks.length === 0 || faqLinks.every((h) => h.includes(expectedHost));
  const englishFaqLeak =
    code !== "en" && faqSection.includes("What is a YouTube thumbnail extractor?");
  const storedTitle = localeMeta[code]?.title || "";
  const storedDesc = localeMeta[code]?.description || "";
  const titleIntent =
    /youtube/i.test(meta.title || "") &&
    /thumbnail|miniatur|缩略|サムネ|썸네일|थम्ब|تصویر|صورة/i.test(meta.title || "");
  const descIntent =
    /youtube/i.test(meta.description || "") &&
    /thumbnail|miniatur|缩略|サムネ|썸네일|थम्ब|تصویر|صورة|free|gratuit|مجان|無料|免费|mft/i.test(
      meta.description || "",
    );
  const pass =
    res.status === 200 &&
    /index/i.test(meta.robots || "") &&
    h3Count === 5 &&
    faqLinks.length <= 3 &&
    junkLinks.length === 0 &&
    sameLocaleLinks &&
    !englishFaqLeak &&
    titleIntent &&
    descIntent &&
    (code === "en" ? meta.canonical === url : meta.canonical?.includes(`${code}.11tik.com/l/${code}/`));

  return {
    locale: code,
    url,
    status: res.status,
    title_emitted: meta.title || "",
    title_stored: storedTitle,
    description_emitted: (meta.description || "").slice(0, 160),
    description_stored: storedDesc.slice(0, 160),
    title_fit_note:
      code === "en" && storedTitle.length > 60 ? "PRE_EXISTING_TITLE_FIT_BEHAVIOR" : "",
    h3_count: h3Count,
    faq_links: faqLinks.join(" | "),
    same_locale_links: sameLocaleLinks ? "yes" : "no",
    lang: meta.lang || "",
    dir: localeMeta[code]?.dir || "",
    canonical: meta.canonical || "",
    robots: meta.robots || "",
    hreflang_count: meta.hreflangCount ?? 0,
    schema: html.includes("WebApplication") ? "WebApplication" : "",
    faq_schema: /FAQPage/i.test(html) ? "FAQPage" : "none",
    english_faq_leak: englishFaqLeak ? "yes" : "no",
    pass: pass ? "yes" : "no",
  };
}

async function probeInternalLinks(code) {
  const url = localeHomeUrl(code);
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(25000) });
  const html = await res.text();
  const faqSection = html.match(/<section class="yte-home-faq"[\s\S]*?<\/section>/i)?.[0] ?? "";
  const links = [...faqSection.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const host = code === "en" ? "www.11tik.com" : `${code}.11tik.com`;
  const rows = [];
  for (const href of links) {
    let targetStatus = "n/a";
    try {
      const r = await fetch(href, { redirect: "follow", signal: AbortSignal.timeout(20000) });
      targetStatus = String(r.status);
    } catch {
      targetStatus = "error";
    }
    rows.push({
      locale: code,
      source: url,
      href,
      expected_host: host,
      host_match: href.includes(host) || (code === "en" && href.includes("www.11tik.com")) ? "yes" : "no",
      target_status: targetStatus,
      junk: /\/music\/|backlink/i.test(href) ? "yes" : "no",
    });
  }
  return rows;
}

export async function runPhase492LiveVerify() {
  mkdirSync(OUT, { recursive: true });
  const commit = git("git rev-parse HEAD");
  const origin = git("git rev-parse origin/main");

  const home = await probeLocale("en");
  const probeRows = [];
  for (const code of PROBE_LOCALES) probeRows.push(await probeLocale(code));
  const allLocaleRows = [];
  for (const code of TARGET) allLocaleRows.push(await probeLocale(code));

  const linkRows = [];
  for (const code of ["en", ...PROBE_LOCALES]) {
    linkRows.push(...(await probeInternalLinks(code)));
  }
  for (const code of TARGET.filter((c) => !PROBE_LOCALES.includes(c))) {
    linkRows.push(...(await probeInternalLinks(code)));
  }

  const csvHeader = Object.keys(home);
  const localeCsv = [
    csvHeader.map(esc).join(","),
    [home, ...probeRows, ...allLocaleRows.filter((r) => !probeRows.find((p) => p.locale === r.locale) && r.locale !== "en")]
      .filter((r, i, arr) => arr.findIndex((x) => x.locale === r.locale) === i)
      .map((r) => csvHeader.map((k) => esc(r[k])).join(","))
      .join("\n"),
  ].join("\n");

  writeFileSync(join(OUT, "HOMEPAGE_LIVE_VERIFY.json"), `${JSON.stringify(home, null, 2)}\n`);
  writeFileSync(
    join(OUT, "LIVE_LOCALE_VERIFY.json"),
    `${JSON.stringify({ home, probeLocales: probeRows, allLocales: allLocaleRows }, null, 2)}\n`,
  );
  writeFileSync(join(OUT, "LIVE_LOCALE_HOMEPAGE_VERIFY.csv"), `${localeCsv}\n`);

  const linkHeader = ["locale", "source", "href", "expected_host", "host_match", "target_status", "junk"];
  writeFileSync(
    join(OUT, "LIVE_INTERNAL_LINK_VERIFY.csv"),
    `${[linkHeader.map(esc).join(","), ...linkRows.map((r) => linkHeader.map((k) => esc(r[k])).join(","))].join("\n")}\n`,
  );

  let deployIdentity = existsSync(join(OUT, "DEPLOY_IDENTITY.json"))
    ? JSON.parse(readFileSync(join(OUT, "DEPLOY_IDENTITY.json"), "utf8"))
    : {
        commit,
        origin_main: origin,
        pushed: commit === origin && commit !== "",
        previous_commit: PRE_COMMIT,
        worker_version: "",
        traffic_percent: 100,
        deploy_method: "npx wrangler deploy",
        assets_note: "dist-assets staged via build",
        blogger_app_bytes: null,
      };

  deployIdentity = {
    ...deployIdentity,
    commit,
    origin_main: origin,
    pushed: commit === origin && commit !== "",
  };

  try {
    const list = execSync("npx wrangler deployments list --name 11tik-edge 2>nul", {
      cwd: ROOT,
      encoding: "utf8",
    });
    const ver = list.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i)?.[0];
    deployIdentity.worker_version = ver || "unknown";
  } catch {
    deployIdentity.worker_version = "unknown";
  }

  if (existsSync(join(ROOT, "reports/asset-manifest.json"))) {
    const am = JSON.parse(readFileSync(join(ROOT, "reports/asset-manifest.json"), "utf8"));
    deployIdentity.blogger_app_bytes = am.bloggerAppBytes ?? null;
  }

  writeFileSync(join(OUT, "DEPLOY_IDENTITY.json"), `${JSON.stringify(deployIdentity, null, 2)}\n`);

  const allPass = home.pass === "yes" && allLocaleRows.every((r) => r.pass === "yes");
  const linksPass = linkRows.every((r) => r.host_match === "yes" && r.junk === "no");

  return {
    home,
    probeLocales: probeRows,
    allLocalePass: allLocaleRows.filter((r) => r.pass === "yes").length,
    allLocaleTotal: allLocaleRows.length,
    linksPass,
    deployIdentity,
    classification: allPass && linksPass ? "A" : allPass ? "B" : "C",
    contentLock: {
      titleEn: HOME_META_EN.title,
      faqCount: homeFaqEn.items.length,
    },
  };
}

const isMain = process.argv[1]?.endsWith("phase49-2-live-verify.mjs");
if (isMain) {
  runPhase492LiveVerify().then((r) => console.log(JSON.stringify(r, null, 2)));
}
