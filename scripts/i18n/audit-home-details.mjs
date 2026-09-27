import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const langs = JSON.parse(readFileSync(join(ROOT, "config/target-languages.json"), "utf8"));
const codes = ["en", ...langs.languages.filter((l) => l.enabled).map((l) => l.code)];
const en = JSON.parse(readFileSync(join(ROOT, "content/translations/home-details/en.json"), "utf8"));

const matrix = [];
let missingDetails = 0;
let englishLeak = 0;
let blogStudy = 0;
let internalLinks = 0;
let externalLinks = 0;
let brokenStruct = 0;
const linkInventory = [];

for (const code of codes) {
  const path = code === "en" ? join(ROOT, "dist-assets/index.html") : join(ROOT, `dist-assets/l/${code}/index.html`);
  if (!existsSync(path)) {
    matrix.push({ locale: code, status: "MISSING_FILE", details_count: 0 });
    missingDetails += 1;
    continue;
  }
  const h = readFileSync(path, "utf8");
  const blocks = [...h.matchAll(/<details\s+class="yte-panel[^"]*"[^>]*>[\s\S]*?<\/details>/gi)];
  const detailsCount = blocks.length;
  if (detailsCount === 0) {
    missingDetails += 1;
    matrix.push({
      locale: code,
      details_count: 0,
      EN_count: 1,
      translated_count: 0,
      english_count: 0,
      missing_count: 1,
      link_drift_count: 0,
      status: "MISSING",
    });
    continue;
  }
  if (detailsCount !== 1) brokenStruct += 1;
  const block = blocks[0][0];
  const sum = (block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1]?.replace(/<[^>]+>/g, "").trim() || "";
  const headings = [...block.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  const paras = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  if (headings.length !== 3 || paras.length !== 3) brokenStruct += 1;

  let english = 0;
  let translated = 0;
  if (code !== "en" && sum === en.summary && headings[0] === en.items[0].heading) {
    english = 1;
    englishLeak += 1;
  } else {
    translated = 1;
  }

  const hrefs = [...block.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  for (const href of hrefs) {
    const isExternal = /addons\.mozilla\.org|youtube\.com|youtu\.be|google\./i.test(href) && !/11tik\.com/i.test(href);
    if (isExternal) externalLinks += 1;
    else internalLinks += 1;
    const isBlogStudy = /\/blog\/youtube-thumbnail-sizes-resolutions-study/.test(href);
    if (isBlogStudy) blogStudy += 1;
    linkInventory.push({
      SOURCE_LOCALE: code,
      CURRENT_HREF: href,
      external: isExternal,
      STATUS: isBlogStudy ? "BLOG_STUDY_FORBIDDEN" : isExternal ? "EXTERNAL_OK" : "INTERNAL",
    });
  }
  if (block.includes("/blog/youtube-thumbnail-sizes-resolutions-study")) blogStudy += 1;

  matrix.push({
    locale: code,
    details_count: detailsCount,
    EN_count: 1,
    translated_count: code === "en" ? 1 : translated,
    english_count: code === "en" ? 0 : english,
    missing_count: 0,
    link_drift_count: 0,
    status: code === "en" ? "PRESENT_COMPLETE" : english ? "PRESENT_ENGLISH" : "PRESENT_COMPLETE",
    summary: sum.slice(0, 80),
    href_count: hrefs.length,
  });
}

const complete = matrix.filter((r) => r.status === "PRESENT_COMPLETE").length;
const report = {
  supported: codes.length,
  complete,
  missingDetails,
  englishLeak,
  blogStudy,
  internalLinksInDetails: internalLinks,
  externalLinksInDetails: externalLinks,
  brokenStruct,
  linkInventory,
  matrix,
};

const outDir = join(ROOT, "reports");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "_home-details-audit-temp.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      supported: report.supported,
      complete: report.complete,
      missingDetails,
      englishLeak,
      blogStudy,
      internalLinksInDetails: internalLinks,
      externalLinksInDetails: externalLinks,
      brokenStruct,
      sample: matrix.filter((m) => ["en", "fr", "ms", "sw", "ja", "ar"].includes(m.locale)),
    },
    null,
    2,
  ),
);
