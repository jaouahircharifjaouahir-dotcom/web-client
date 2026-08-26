/**
 * Live vs shadow English static parity audit (read-only network fetch).
 * Usage: node scripts/i18n/audit-english-static-parity.mjs [dist-assets]
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentInventory, localizableContent } from "./content-inventory.mjs";
import { countHreflangOnHtml, assessShadowSitemap } from "./write-english-static.mjs";
import { collectReadyLocaleLocs, scanPublishability } from "./publish.mjs";
import { getTargetLocales } from "./target-languages.mjs";
import { clipDescription } from "../../workers/html-meta.js";
import { descriptionForPath } from "../../workers/post-descriptions.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const stagedArg = process.argv[2] || join(ROOT, "dist-assets");

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html, { name, property } = {}) {
  const attr = name ? `name=["']${name}["']` : `property=["']${property}["']`;
  const patterns = [
    new RegExp(`<meta[^>]+${attr}[^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}`, "i"),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1] != null) return decode(m[1].trim());
  }
  return "";
}

function decode(text) {
  return String(text || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function normalizeText(value) {
  return decode(stripTags(value))
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/·/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function linkCanonical(html) {
  const m = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html)
    || /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i.exec(html);
  return m ? m[1].trim() : "";
}

function titleText(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? stripTags(m[1]) : "";
}

function h1Text(html) {
  const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return m ? stripTags(m[1]) : "";
}

function faviconPresent(html) {
  return /rel=["'][^"']*icon[^"']*["']/i.test(html);
}

function collectImages(html) {
  const out = [];
  const re = /<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    out.push({
      src: /src=["']([^"']+)["']/i.exec(tag)?.[1] || "",
      alt: /alt=["']([^"']*)["']/i.exec(tag)?.[1] || "",
    });
  }
  return out;
}

function collectHrefs(html, hostFilter) {
  const hrefs = [];
  const re = /<a\b[^>]*href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (hostFilter === "internal" && /11tik\.com/i.test(href)) hrefs.push(href);
    else if (hostFilter === "external" && /^https?:/i.test(href) && !/11tik\.com/i.test(href)) hrefs.push(href);
  }
  return hrefs;
}

function hasJsonLd(html) {
  return /application\/ld\+json/i.test(html);
}

function faqVisible(html) {
  return />\s*FAQ\s*</i.test(html) || /itemtype=["'][^"']*FAQPage/i.test(html);
}

function articleBodyText(html) {
  const m = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html);
  return normalizeText(m ? m[1] : html);
}

/**
 * Classify one field comparison.
 */
function classifyField(name, liveVal, staticVal, { criticalIfMissingStatic = true, softEqual } = {}) {
  const live = String(liveVal || "").trim();
  const st = String(staticVal || "").trim();
  if (!live && !st) return { name, class: "MATCH", live, static: st, note: "both empty" };
  if (!st && criticalIfMissingStatic) {
    return { name, class: "CRITICAL", live, static: st, note: "missing on static" };
  }
  if (!live && st) {
    return { name, class: "MINOR", live, static: st, note: "live missing; static present" };
  }
  const equal = softEqual ? softEqual(live, st) : normalizeText(live) === normalizeText(st);
  if (equal) return { name, class: "MATCH", live, static: st };
  if (name === "HTTP title" || name === "title") {
    if (normalizeText(st) === normalizeText(live)) return { name, class: "MATCH", live, static: st };
    if (/^[a-z0-9-]+\s*\|\s*11tik$/i.test(live) && st) {
      return { name, class: "MINOR", live, static: st, note: "live uses Blogger slug title; static uses human title" };
    }
  }
  if (name === "body content") {
    const liveN = normalizeText(live);
    const stN = normalizeText(st);
    if (liveN === stN) return { name, class: "MATCH", live: live.slice(0, 120), static: st.slice(0, 120) };
    const slice = Math.min(120, stN.length, liveN.length);
    if (slice >= 80 && (liveN.includes(stN.slice(0, slice)) || stN.includes(liveN.slice(0, slice)))) {
      return {
        name,
        class: "MINOR",
        live: live.slice(0, 120),
        static: st.slice(0, 120),
        note: "body overlap; Blogger chrome/source drift",
      };
    }
    // Token overlap (repo fragment vs live Blogger theme body)
    const liveTokens = new Set(liveN.split(" ").filter((w) => w.length > 3));
    const stTokens = stN.split(" ").filter((w) => w.length > 3);
    const hit = stTokens.filter((w) => liveTokens.has(w)).length;
    const ratio = stTokens.length ? hit / stTokens.length : 0;
    if (ratio >= 0.55) {
      return {
        name,
        class: "MINOR",
        live: live.slice(0, 120),
        static: st.slice(0, 120),
        note: `body token overlap ${(ratio * 100).toFixed(0)}%; source vs live Blogger drift`,
      };
    }
    return { name, class: "CRITICAL", live: live.slice(0, 160), static: st.slice(0, 160), note: "body divergence" };
  }
  if (name === "structured data") {
    if (st && live) return { name, class: "MINOR", live: String(live), static: String(st), note: "both have JSON-LD; graph shape may differ" };
  }
  if (["OG title", "OG description", "meta description"].includes(name)) {
    if (normalizeText(live).slice(0, 40) === normalizeText(st).slice(0, 40)) {
      return { name, class: "MINOR", live, static: st, note: "prefix match; length/polish differs" };
    }
  }
  const criticalNames = new Set([
    "canonical",
    "H1",
    "robots",
    "favicon",
    "HTTP title",
    "OG image",
    "image URLs",
    "body content",
  ]);
  return {
    name,
    class: criticalNames.has(name) ? "CRITICAL" : "MINOR",
    live: live.slice(0, 200),
    static: st.slice(0, 200),
  };
}

async function fetchLive(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "11tik-english-static-parity/1.0", accept: "text/html" },
    redirect: "follow",
  });
  const html = await res.text();
  return { status: res.status, html, finalUrl: res.url };
}

function extractPageSignals(html) {
  const images = collectImages(html);
  return {
    title: titleText(html),
    h1: h1Text(html),
    description: metaContent(html, { name: "description" }),
    canonical: linkCanonical(html),
    robots: metaContent(html, { name: "robots" }) || ( /noindex/i.test(html) ? "noindex" : "" ),
    favicon: faviconPresent(html),
    ogTitle: metaContent(html, { property: "og:title" }),
    ogDescription: metaContent(html, { property: "og:description" }),
    ogImage: metaContent(html, { property: "og:image" }),
    jsonLd: hasJsonLd(html),
    faq: faqVisible(html),
    body: articleBodyText(html),
    internalLinks: collectHrefs(html, "internal"),
    externalLinks: collectHrefs(html, "external"),
    imageCount: images.length,
    imageAlts: images.map((i) => i.alt),
    imageUrls: images.map((i) => i.src),
    hreflang: countHreflangOnHtml(html),
  };
}

function comparePages(url, liveHtml, staticHtml) {
  const live = extractPageSignals(liveHtml);
  const st = extractPageSignals(staticHtml);
  const fields = [
    classifyField("HTTP title", live.title, st.title),
    classifyField("H1", live.h1, st.h1),
    classifyField("meta description", live.description, st.description, {
      softEqual: (a, b) => normalizeText(clipDescription(a)) === normalizeText(clipDescription(b)),
    }),
    classifyField("canonical", live.canonical, st.canonical, {
      softEqual: (a, b) => a.replace(/\/$/, "") === b.replace(/\/$/, ""),
    }),
    classifyField("robots", live.robots || "index,follow", st.robots || "", {
      softEqual: (a, b) => {
        const na = /noindex/i.test(a) ? "noindex" : "index";
        const nb = /noindex/i.test(b) ? "noindex" : "index";
        return na === nb;
      },
    }),
    classifyField("favicon", live.favicon ? "yes" : "no", st.favicon ? "yes" : "no"),
    classifyField("OG title", live.ogTitle, st.ogTitle),
    classifyField("OG description", live.ogDescription, st.ogDescription),
    classifyField("OG image", live.ogImage, st.ogImage, {
      softEqual: (a, b) => a.replace(/github\.io\/web-client\//i, "www.11tik.com/web-client/") === b,
    }),
    classifyField("structured data", live.jsonLd ? "yes" : "no", st.jsonLd ? "yes" : "no"),
    classifyField("FAQ", live.faq ? "yes" : "no", st.faq ? "yes" : "no", { criticalIfMissingStatic: false }),
    classifyField("body content", live.body, st.body),
    classifyField(
      "internal links",
      live.internalLinks.slice(0, 8).join(" | "),
      st.internalLinks.slice(0, 8).join(" | "),
      { criticalIfMissingStatic: false },
    ),
    classifyField(
      "external links",
      live.externalLinks.slice(0, 8).join(" | "),
      st.externalLinks.slice(0, 8).join(" | "),
      { criticalIfMissingStatic: false },
    ),
    classifyField("image count", String(live.imageCount), String(st.imageCount), {
      criticalIfMissingStatic: false,
      softEqual: (a, b) => a === b || (Number(a) >= 0 && Number(b) >= 0 && Math.abs(Number(a) - Number(b)) <= 1),
    }),
    classifyField("image alt", live.imageAlts.join(" || "), st.imageAlts.join(" || "), {
      criticalIfMissingStatic: false,
    }),
    classifyField("image URLs", live.imageUrls.join(" || "), st.imageUrls.join(" || "), {
      criticalIfMissingStatic: false,
      softEqual: (a, b) => {
        const norm = (s) =>
          s
            .replaceAll("jaouahircharifjaouahir-dotcom.github.io/web-client/", "www.11tik.com/web-client/")
            .replace(/\s+/g, "");
        if (norm(a) === norm(b)) return true;
        // Live Blogger may inject default OG hero not present in repo fragment.
        if (a.includes("og-image-1200x630") && !b) return true;
        return false;
      },
    }),
  ];

  // Expected meta from POST_DESCRIPTIONS — if live Blogger lacks polished desc, static using map is still correct for future cutover
  const expectedDesc = descriptionForPath(new URL(url).pathname);
  if (expectedDesc && normalizeText(st.description) === normalizeText(expectedDesc)) {
    const meta = fields.find((f) => f.name === "meta description");
    if (meta && meta.class === "CRITICAL") {
      meta.class = "MINOR";
      meta.note = "static matches POST_DESCRIPTIONS; live Blogger may be unpolished";
    }
  }

  const worst = fields.some((f) => f.class === "CRITICAL")
    ? "CRITICAL"
    : fields.some((f) => f.class === "MINOR")
      ? "MINOR"
      : "MATCH";
  return { url, worst, fields, staticHreflang: st.hreflang, liveHreflang: live.hreflang };
}

async function main() {
  if (!existsSync(stagedArg)) {
    console.error(`Missing staged dir: ${stagedArg}. Run npm run build first.`);
    process.exit(2);
  }
  const inventory = buildContentInventory();
  const items = localizableContent(inventory);
  const targetLocales = getTargetLocales();
  const manifest = scanPublishability(inventory);
  const readyLocs = collectReadyLocaleLocs(manifest);
  const shadowSitemap = assessShadowSitemap(inventory, readyLocs);

  const pageResults = [];
  for (const item of items) {
    const rel = item.canonicalPath.replace(/^\//, "");
    const abs = join(stagedArg, rel);
    if (!existsSync(abs)) {
      pageResults.push({
        url: item.canonicalUrl,
        worst: "CRITICAL",
        fields: [{ name: "file", class: "CRITICAL", note: `missing ${rel}` }],
      });
      continue;
    }
    const staticHtml = readFileSync(abs, "utf8");
    let live;
    try {
      live = await fetchLive(item.canonicalUrl);
    } catch (err) {
      pageResults.push({
        url: item.canonicalUrl,
        worst: "CRITICAL",
        fields: [{ name: "live fetch", class: "CRITICAL", note: String(err) }],
      });
      continue;
    }
    if (live.status >= 400) {
      pageResults.push({
        url: item.canonicalUrl,
        worst: "CRITICAL",
        fields: [{ name: "live status", class: "CRITICAL", live: String(live.status), static: "file ok" }],
      });
      continue;
    }
    pageResults.push(comparePages(item.canonicalUrl, live.html, staticHtml));
  }

  // Hreflang validation on static EN pages
  const hreflangIssues = [];
  for (const item of items) {
    const abs = join(stagedArg, item.canonicalPath.replace(/^\//, ""));
    if (!existsSync(abs)) continue;
    const html = readFileSync(abs, "utf8");
    const counts = countHreflangOnHtml(html);
    const entry = manifest.contents[item.contentId];
    const readyCount = entry
      ? Object.values(entry.locales).filter((r) => r.status === "ready" && r.url).length
      : 0;
    if (counts.en < 1 || counts.xDefault < 1) {
      hreflangIssues.push({ url: item.canonicalUrl, issue: "missing en or x-default", counts, readyCount });
    }
    if (counts.otherLocales < readyCount) {
      hreflangIssues.push({
        url: item.canonicalUrl,
        issue: "fewer locale alternates than ready",
        counts,
        readyCount,
      });
    }
    // Spot-check reciprocal: one ready locale page should link back to EN
    const sampleLocale = entry
      ? Object.entries(entry.locales).find(([, r]) => r.status === "ready" && r.url)?.[0]
      : null;
    if (sampleLocale && entry.locales[sampleLocale]?.url) {
      const locUrl = entry.locales[sampleLocale].url;
      const locPath = new URL(locUrl).pathname.replace(/^\//, "");
      const locAbs = join(stagedArg, locPath);
      if (existsSync(locAbs)) {
        const locHtml = readFileSync(locAbs, "utf8");
        if (!locHtml.includes(item.canonicalUrl) || !/hreflang=["']en["']/i.test(locHtml)) {
          hreflangIssues.push({
            url: item.canonicalUrl,
            issue: `locale ${sampleLocale} missing en alternate to canonical`,
            locUrl,
          });
        }
      }
    }
  }

  let matchPages = 0;
  let minorPages = 0;
  let criticalPages = 0;
  let matchFields = 0;
  let minorFields = 0;
  let criticalFields = 0;
  const criticalDetails = [];
  for (const row of pageResults) {
    if (row.worst === "CRITICAL") criticalPages += 1;
    else if (row.worst === "MINOR") minorPages += 1;
    else matchPages += 1;
    for (const f of row.fields || []) {
      if (f.class === "CRITICAL") {
        criticalFields += 1;
        criticalDetails.push({ url: row.url, field: f.name, note: f.note, live: f.live, static: f.static });
      } else if (f.class === "MINOR") minorFields += 1;
      else matchFields += 1;
    }
  }

  const articles = pageResults.filter((r) => r.url.includes("/2026/"));
  const utilities = pageResults.filter((r) => r.url.includes("/p/"));

  const report = {
    generatedAt: new Date().toISOString(),
    staged: stagedArg,
    targetLocaleCount: targetLocales.length,
    coverage: {
      articlesExpected: 18,
      articlesGenerated: articles.length,
      utilitiesExpected: 6,
      utilitiesGenerated: utilities.length,
      totalEnglishHtml: items.length,
    },
    parity: {
      pagesMatch: matchPages,
      pagesMinor: minorPages,
      pagesCritical: criticalPages,
      fieldsMatch: matchFields,
      fieldsMinor: minorFields,
      fieldsCritical: criticalFields,
      criticalDetails,
    },
    shadowSitemap,
    hreflangIssues,
    pageResults,
    finalStatus: criticalFields > 0 || hreflangIssues.length > 0 ? "STATIC PARITY FAILED" : "STATIC SHADOW BUILD READY",
  };

  const outDir = join(ROOT, "tmp");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "english-static-shadow-parity.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    finalStatus: report.finalStatus,
    coverage: report.coverage,
    parity: {
      pagesMatch: matchPages,
      pagesMinor: minorPages,
      pagesCritical: criticalPages,
      fieldsMatch: matchFields,
      fieldsMinor: minorFields,
      fieldsCritical: criticalFields,
      criticalCount: criticalDetails.length,
    },
    shadowSitemap: {
      englishCanonicalCount: shadowSitemap.englishCanonicalCount,
      articleCount: shadowSitemap.articleCount,
      utilityCount: shadowSitemap.utilityCount,
      localizedCount: shadowSitemap.localizedCount,
      theoreticalTotal: shadowSitemap.theoreticalTotal,
    },
    hreflangIssueCount: hreflangIssues.length,
    reportPath: outPath,
  }, null, 2));
  if (report.finalStatus !== "STATIC SHADOW BUILD READY") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
