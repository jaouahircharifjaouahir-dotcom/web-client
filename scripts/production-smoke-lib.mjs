/**
 * Production smoke definitions and pure assertion helpers.
 * Network I/O lives in production-smoke.mjs only.
 */
import { execSync } from "node:child_process";
import { INDEXNOW_KEY } from "./i18n/indexnow-key.mjs";
import { validateSecurityHeaders } from "./security-headers.mjs";

export const SMOKE_USER_AGENT = "11tik-production-smoke/1.0";
export const REQUEST_TIMEOUT_MS = 15_000;
export const REDIRECT_MAX_HOPS = 5;
export const DEFAULT_EXPECTED_SITEMAP_LOCS = 1095;
export const DEFAULT_EXPECTED_INDEXNOW_URLS = 1096;
export const DEFAULT_EXPECTED_FEED_ENTRIES = 18;

/** Runtime Blogger/CMS markers — not filenames like blogger-app.js */
export const BANNED_BODY_MARKERS = Object.freeze([
  { pattern: /blogspot\.com/i, label: "blogspot.com" },
  { pattern: /ghs\.googlehosted\.com/i, label: "ghs.googlehosted.com" },
  { pattern: /<generator>\s*Blogger\s*<\/generator>/i, label: "Blogger generator" },
]);

export function smokeOrigins(env = process.env) {
  return {
    www: String(env.SMOKE_ORIGIN || "https://www.11tik.com").replace(/\/+$/, ""),
    fr: String(env.SMOKE_LOCALE_ORIGIN_FR || "https://fr.11tik.com").replace(/\/+$/, ""),
    ar: String(env.SMOKE_LOCALE_ORIGIN_AR || "https://ar.11tik.com").replace(/\/+$/, ""),
  };
}

export function expectedSitemapLocCount(env = process.env) {
  const raw = env.SMOKE_EXPECTED_SITEMAP_LOCS ?? String(DEFAULT_EXPECTED_SITEMAP_LOCS);
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_EXPECTED_SITEMAP_LOCS;
}

export function sitemapCountIsStrictBlock(env = process.env) {
  return env.SMOKE_SITEMAP_COUNT_STRICT === "1";
}

/** @param {{ www: string, fr: string, ar: string }} origins */
export function buildSmokeCases(origins) {
  const { www, fr, ar } = origins;
  return [
    { id: "A-home", category: "A", severity: "BLOCK", url: `${www}/`, status: 200, expectHtml: true, contains: ['id="yte-root"'], securityHeaders: true },
    { id: "B-en-utility", category: "B", severity: "BLOCK", url: `${www}/p/about.html`, status: 200, expectHtml: true, noSpaShell: true, noBanned: true, securityHeaders: true },
    { id: "C-en-article", category: "C", severity: "BLOCK", url: `${www}/2026/08/how-to-download-youtube-thumbnail.html`, status: 200, expectHtml: true, noSpaShell: true, noBanned: true, canonicalIncludes: "/2026/08/how-to-download-youtube-thumbnail.html" },
    { id: "D-en-unknown-p", category: "D", severity: "BLOCK", url: `${www}/p/random.html`, status: 404, expectHtml: true, noSpaShell: true, workerHsts: true },
    { id: "D-en-unknown-2026", category: "D", severity: "BLOCK", url: `${www}/2026/08/this-page-does-not-exist-unique-test.html`, status: 404, expectHtml: true, noSpaShell: true, workerHsts: true },
    { id: "E-en-about-redirect", category: "E", severity: "BLOCK", url: `${www}/about`, status: 301, redirectManual: true, locationIncludes: "/p/about.html", verifyFinal: { status: 200 } },
    { id: "F-feed-atom", category: "F", severity: "BLOCK", url: `${www}/feeds/posts/default`, status: 200, contentTypeIncludes: "atom", feedAtom: true, securityHeaders: true },
    { id: "G-feed-rss", category: "G", severity: "BLOCK", url: `${www}/feeds/posts/default?alt=rss`, status: 200, contentTypeIncludes: "rss", feedRss: true },
    { id: "H-search-410", category: "H", severity: "BLOCK", url: `${www}/search`, status: 410, securityHeaders: true, workerHsts: true },
    { id: "H-pages-feed-410", category: "H", severity: "BLOCK", url: `${www}/feeds/pages/default`, status: 410, workerHsts: true },
    { id: "H-sitemap-images-410", category: "H", severity: "BLOCK", url: `${www}/sitemap-images.xml`, status: 410, expectHtml: true, noSpaShell: true, noCanonical: true, workerHsts: true },
    { id: "H-feeds-comments-410", category: "H", severity: "BLOCK", url: `${www}/feeds/comments/default`, status: 410, expectHtml: true, noSpaShell: true, noCanonical: true, workerHsts: true },
    { id: "H-feeds-other-410", category: "H", severity: "BLOCK", url: `${www}/feeds/other/default`, status: 410, expectHtml: true, noSpaShell: true, noCanonical: true, workerHsts: true },
    { id: "H-copyright", category: "H", severity: "BLOCK", url: `${www}/copyright`, status: 200, expectHtml: true, noSpaShell: true, noBanned: true, canonicalIncludes: "/copyright" },
    { id: "H-copyright-slash", category: "H", severity: "BLOCK", url: `${www}/copyright/`, status: 301, redirectManual: true, location: `${www}/copyright`, verifyFinal: { status: 200, canonicalIncludes: "/copyright" }, workerHsts: true },
    { id: "H-copyright-slash-query", category: "H", severity: "BLOCK", url: `${www}/copyright/?m=1`, status: 301, redirectManual: true, location: `${www}/copyright` },
    { id: "I-sitemap-pages", category: "I", severity: "BLOCK", url: `${www}/sitemap-pages.xml`, status: 301, redirectManual: true, locationIncludes: "sitemap.xml", verifyFinal: { status: 200, contentTypeIncludes: "xml" }, workerHsts: true },
    { id: "J-robots", category: "J", severity: "BLOCK", url: `${www}/robots.txt`, status: 200, contentTypeIncludes: "text/plain", robotsCheck: true, securityHeaders: true },
    { id: "K-sitemap", category: "K", severity: "BLOCK", url: `${www}/sitemap.xml`, status: 200, contentTypeIncludes: "xml", sitemapCheck: true },
    { id: "L-indexnow-key", category: "L", severity: "BLOCK", url: `${www}/${INDEXNOW_KEY}.txt`, status: 200, contentTypeIncludes: "text/plain", bodyIncludes: INDEXNOW_KEY },
    { id: "M-fr-home", category: "M", severity: "BLOCK", url: `${fr}/l/fr/`, status: 200, expectHtml: true, lang: "fr", locale: "fr", h1Fr: true, canonicalIncludes: "/l/fr/", securityHeaders: true },
    { id: "N-fr-utility", category: "N", severity: "BLOCK", url: `${fr}/l/fr/p/about.html`, status: 200, expectHtml: true, lang: "fr", locale: "fr", noBanned: true, canonicalIncludes: "/l/fr/p/about.html" },
    { id: "O-fr-article", category: "O", severity: "BLOCK", url: `${fr}/l/fr/2026/08/how-to-download-youtube-thumbnail.html`, status: 200, expectHtml: true, lang: "fr", locale: "fr", h1Fr: true, noSpaShell: true, noBanned: true, canonicalIncludes: "/l/fr/2026/08/how-to-download-youtube-thumbnail.html" },
    { id: "P-fr-utility-slash", category: "P", severity: "BLOCK", url: `${fr}/l/fr/p/about.html/`, status: 301, redirectManual: true, location: `${fr}/l/fr/p/about.html`, verifyFinal: { status: 200 }, workerHsts: true },
    { id: "P-fr-article-slash", category: "P", severity: "BLOCK", url: `${fr}/l/fr/2026/08/how-to-download-youtube-thumbnail.html/`, status: 301, redirectManual: true, locationSuffix: "how-to-download-youtube-thumbnail.html", verifyFinal: { status: 200 } },
    { id: "Q-fr-mobile", category: "Q", severity: "BLOCK", url: `${fr}/l/fr/?m=1`, status: 301, redirectManual: true, location: `${fr}/l/fr/` },
    { id: "R-ar-home", category: "R", severity: "BLOCK", url: `${ar}/l/ar/`, status: 200, expectHtml: true, lang: "ar", locale: "ar", dir: "rtl" },
    { id: "S-ar-utility", category: "S", severity: "BLOCK", url: `${ar}/l/ar/p/about.html`, status: 200, expectHtml: true, lang: "ar", locale: "ar", noBanned: true },
    { id: "T-ar-article", category: "T", severity: "BLOCK", url: `${ar}/l/ar/2026/08/how-to-download-youtube-thumbnail.html`, status: 200, expectHtml: true, lang: "ar", locale: "ar", noSpaShell: true, noBanned: true },
    { id: "U-ar-utility-slash", category: "U", severity: "BLOCK", url: `${ar}/l/ar/p/about.html/`, status: 301, redirectManual: true, location: `${ar}/l/ar/p/about.html` },
    { id: "V-fr-unknown-soft404", category: "V", severity: "WARN", url: `${fr}/l/fr/random.html`, status: 200, expectHtml: true, soft404: true },
    { id: "W-thumb-spa", category: "W", severity: "BLOCK", url: `${www}/thumb/dQw4w9WgXcQ`, status: 200, expectHtml: true, contains: ['id="yte-root"'], securityHeaders: true },
    { id: "SEC-embed-page", category: "SEC", severity: "BLOCK", url: `${www}/p/embed.html`, status: 200, expectHtml: true, noSpaShell: true, securityHeaders: true, embedSurface: true },
    { id: "SEC-embed-widget", category: "SEC", severity: "BLOCK", url: `${www}/?embed=1`, status: 200, expectHtml: true, contains: ['id="yte-root"'], securityHeaders: true, embedSurface: true },
    { id: "X-http-redirect", category: "X", severity: "BLOCK", url: "http://www.11tik.com/", status: 301, redirectManual: true, locationStartsWith: "https://", verifyFinal: { status: 200, urlPrefix: "https://www.11tik.com" } },
    { id: "Y-apex-redirect", category: "Y", severity: "BLOCK", url: "https://11tik.com/", status: 301, redirectManual: true, locationIncludes: "www.11tik.com", verifyFinal: { status: 200, urlPrefix: "https://www.11tik.com" }, workerHsts: true },
    // Supplementary high-value checks (Phase 7B parity)
    { id: "INFO-fr-posts-shell", category: "M", severity: "INFO", url: `${fr}/l/fr/?posts=1`, status: 200, expectHtml: true, lang: "fr" },
    { id: "WARN-hsts-en-utility", category: "B", severity: "WARN", url: `${www}/p/about.html`, status: 200, hsts: true },
    { id: "WARN-hsts-fr-utility", category: "N", severity: "WARN", url: `${fr}/l/fr/p/about.html`, status: 200, hsts: true },
  ];
}

/** @returns {string[]} subset IDs for low-traffic scheduled checks */
export function scheduledSmokeCaseIds() {
  return ["A-home", "J-robots", "K-sitemap", "H-sitemap-images-410", "B-en-utility", "N-fr-utility", "G-feed-rss", "D-en-unknown-2026"];
}

export function filterSmokeCases(allCases, { onlyIds = null, minSeverity = null } = {}) {
  let cases = allCases;
  if (onlyIds?.length) {
    const set = new Set(onlyIds);
    cases = cases.filter((c) => set.has(c.id));
  }
  if (minSeverity) {
    const order = { BLOCK: 0, WARN: 1, INFO: 2 };
    const min = order[minSeverity] ?? 0;
    cases = cases.filter((c) => (order[c.severity] ?? 0) <= min);
  }
  return cases;
}

export function pickHtmlAttr(body, re) {
  const m = String(body || "").match(re);
  return m ? m[1] : null;
}

export function extractCanonical(body) {
  return (
    pickHtmlAttr(body, /rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ??
    pickHtmlAttr(body, /href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)
  );
}

export function assertStatus(actual, expected) {
  if (actual !== expected) return { ok: false, message: `status=${actual} expected=${expected}` };
  return { ok: true };
}

export function assertContentType(headerValue, includes) {
  const ct = String(headerValue || "").toLowerCase();
  if (!includes) return { ok: true };
  if (!ct.includes(String(includes).toLowerCase())) {
    return { ok: false, message: `content-type=${headerValue} expected includes ${includes}` };
  }
  return { ok: true };
}

export function assertLocation(actual, { exact, includes, suffix, startsWith }) {
  const loc = actual ?? "";
  if (exact != null && loc !== exact) return { ok: false, message: `location=${loc} expected=${exact}` };
  if (includes && !loc.includes(includes)) return { ok: false, message: `location=${loc} expected includes ${includes}` };
  if (suffix && !loc.endsWith(suffix)) return { ok: false, message: `location=${loc} expected suffix ${suffix}` };
  if (startsWith && !loc.startsWith(startsWith)) return { ok: false, message: `location=${loc} expected startsWith ${startsWith}` };
  return { ok: true };
}

export function assertContains(body, needle) {
  if (!String(body || "").includes(needle)) return { ok: false, message: `body missing ${needle}` };
  return { ok: true };
}

export function assertNotContains(body, needle) {
  if (String(body || "").includes(needle)) return { ok: false, message: `body contains forbidden ${needle}` };
  return { ok: true };
}

export function assertCanonical(body, { exact, includes, excludes }) {
  const canonical = extractCanonical(body);
  if (exact != null && canonical !== exact) return { ok: false, message: `canonical=${canonical} expected=${exact}` };
  if (includes && (!canonical || !canonical.includes(includes))) {
    return { ok: false, message: `canonical=${canonical} expected includes ${includes}` };
  }
  if (excludes && canonical?.includes(excludes)) {
    return { ok: false, message: `canonical=${canonical} must not include ${excludes}` };
  }
  return { ok: true };
}

export function assertLang(body, expectedPrefix) {
  const lang = pickHtmlAttr(body, /<html[^>]*\slang=["']([^"']+)["']/i);
  if (lang && !lang.startsWith(expectedPrefix)) return { ok: false, message: `lang=${lang} expected prefix ${expectedPrefix}` };
  return { ok: true };
}

export function assertDataLocale(body, expected) {
  const locale = pickHtmlAttr(body, /data-yte-locale=["']([^"']+)["']/i);
  if (expected && locale !== expected) return { ok: false, message: `data-yte-locale=${locale} expected=${expected}` };
  return { ok: true };
}

export function assertHeader(headers, name, { includes, excludes } = {}) {
  const value = headers[name] ?? headers[name.toLowerCase()] ?? "";
  if (includes && !String(value).includes(includes)) {
    return { ok: false, message: `${name}=${value} expected includes ${includes}` };
  }
  if (excludes && String(value).includes(excludes)) {
    return { ok: false, message: `${name}=${value} must not include ${excludes}` };
  }
  return { ok: true };
}

export function assertBannedMarkers(body) {
  for (const { pattern, label } of BANNED_BODY_MARKERS) {
    if (pattern.test(String(body || ""))) return { ok: false, message: `banned marker: ${label}` };
  }
  return { ok: true };
}

export function assertFrenchH1(body) {
  const h1 = pickHtmlAttr(body, /<h1[^>]*>([^<]+)/i);
  if (h1 && !/[àâéèêëïîôùûç]|propos|miniature|télécharger|Extracteur/i.test(h1)) {
    return { ok: false, message: `h1 does not look French: ${h1}` };
  }
  return { ok: true };
}

export function parseSitemapLocs(xml) {
  return [...String(xml || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

export function validateSitemapXml(body, { expectedLocCount, strictCount }) {
  const issues = [];
  if (!String(body || "").includes("<urlset")) issues.push("invalid sitemap XML");
  const locs = parseSitemapLocs(body);
  if (expectedLocCount != null && locs.length !== expectedLocCount) {
    issues.push(`loc count=${locs.length} expected=${expectedLocCount}`);
  }
  if (body.includes("/search")) issues.push("sitemap contains /search");
  if (body.includes("sitemap-pages.xml")) issues.push("sitemap contains sitemap-pages.xml");
  if (body.includes("/index.html")) issues.push("sitemap contains /index.html");
  const dup = locs.filter((loc, i) => locs.indexOf(loc) !== i);
  if (dup.length) issues.push(`duplicate locs: ${dup.slice(0, 3).join(", ")}`);
  return { issues, locs, countMismatch: expectedLocCount != null && locs.length !== expectedLocCount, strictCount };
}

export function validateRobotsTxt(body) {
  const issues = [];
  if (!body.includes("Sitemap: https://www.11tik.com/sitemap.xml")) issues.push("missing sitemap declaration");
  if (!body.includes("Disallow: /search")) issues.push("missing Disallow: /search");
  if (!body.includes("Disallow: /feeds/")) issues.push("missing Disallow: /feeds/");
  const starBlock = /User-agent: \*([\s\S]*?)(?=User-agent:|$)/i.exec(body);
  if (starBlock && /Disallow: \/\s*$/m.test(starBlock[1])) {
    issues.push("User-agent: * Disallow: / blocks homepage");
  }
  if (/Disallow: \/web-client\/\s*$/m.test(body)) issues.push("Disallow: /web-client/");
  if (!body.includes("User-agent: Amazonbot") || !body.includes("Allow: /")) {
    issues.push("Amazonbot allow policy missing or changed");
  }
  if (!body.includes("User-agent: GPTBot")) issues.push("GPTBot rule missing");
  return issues;
}

export function validateFeedXml(body, { kind, expectedEntries }) {
  const issues = [];
  const text = String(body || "");
  if (kind === "atom") {
    if (!text.includes("<feed")) issues.push("not atom feed XML");
    const entries = (text.match(/<entry>/g) ?? []).length;
    if (expectedEntries != null && entries !== expectedEntries) issues.push(`atom entries=${entries} expected=${expectedEntries}`);
  } else if (kind === "rss") {
    if (!text.includes("<rss")) issues.push("not rss feed XML");
    const items = (text.match(/<item>/g) ?? []).length;
    if (expectedEntries != null && items !== expectedEntries) issues.push(`rss items=${items} expected=${expectedEntries}`);
  }
  for (const { pattern, label } of BANNED_BODY_MARKERS) {
    if (pattern.test(text)) issues.push(`feed contains ${label}`);
  }
  return issues;
}

/**
 * Pure evaluation of one case given fetch results.
 * @returns {{ block: string[], warn: string[], info: string[] }}
 */
export function evaluateSmokeCase(testCase, { status, headers, body, location }) {
  const block = [];
  const warn = [];
  const info = [];
  const push = (list, msg) => list.push(msg);

  const st = assertStatus(status, testCase.status);
  if (!st.ok) {
    const msg = st.message;
    if (testCase.severity === "INFO") push(info, msg);
    else if (testCase.severity === "WARN") push(warn, msg);
    else push(block, msg);
  }

  if (testCase.contentTypeIncludes) {
    const ct = assertContentType(headers["content-type"], testCase.contentTypeIncludes);
    if (!ct.ok) push(block, ct.message);
  }

  if (testCase.redirectManual) {
    const loc = assertLocation(location, {
      exact: testCase.location,
      includes: testCase.locationIncludes,
      suffix: testCase.locationSuffix,
      startsWith: testCase.locationStartsWith,
    });
    if (!loc.ok) push(block, loc.message);
  }

  if (testCase.bodyIncludes && body) {
    const c = assertContains(body, testCase.bodyIncludes);
    if (!c.ok) push(block, c.message);
  }

  if (testCase.expectHtml && body) {
    if (testCase.lang) {
      const l = assertLang(body, testCase.lang);
      if (!l.ok) push(block, l.message);
    }
    if (testCase.locale) {
      const lo = assertDataLocale(body, testCase.locale);
      if (!lo.ok) push(block, lo.message);
    }
    if (testCase.dir) {
      const d = pickHtmlAttr(body, /<html[^>]*\sdir=["']([^"']+)["']/i);
      if (d !== testCase.dir) push(block, `dir=${d} expected=${testCase.dir}`);
    }
    if (testCase.canonicalIncludes) {
      const c = assertCanonical(body, { includes: testCase.canonicalIncludes });
      if (!c.ok) push(block, c.message);
    }
    if (testCase.h1Fr) {
      const h = assertFrenchH1(body);
      if (!h.ok) push(block, h.message);
    }
    if (testCase.noSpaShell) {
      const n = assertNotContains(body, 'id="yte-root"');
      if (!n.ok) push(block, "unexpected SPA shell (#yte-root)");
    }
    if (testCase.noBanned) {
      const b = assertBannedMarkers(body);
      if (!b.ok) push(block, b.message);
    }
    if (testCase.noCanonical) {
      const canonical = extractCanonical(body);
      if (canonical) push(block, `unexpected canonical: ${canonical}`);
    }
    if (testCase.contains) {
      for (const needle of testCase.contains) {
        const c = assertContains(body, needle);
        if (!c.ok) push(block, c.message);
      }
    }
    if (testCase.soft404) {
      const canonical = extractCanonical(body);
      if (canonical?.includes("/l/fr/p/about")) push(warn, "unknown localized URL served utility canonical");
      if (!body.includes('id="yte-root"')) push(warn, "soft-404 baseline changed: missing #yte-root");
    }
  }

  if (testCase.robotsCheck && body) {
    for (const issue of validateRobotsTxt(body)) push(block, issue);
  }

  if (testCase.sitemapCheck && body) {
    const { issues, countMismatch } = validateSitemapXml(body, {
      expectedLocCount: expectedSitemapLocCount(),
      strictCount: sitemapCountIsStrictBlock(),
    });
    for (const issue of issues) {
      if (issue.startsWith("loc count=") && !sitemapCountIsStrictBlock()) push(warn, issue);
      else push(block, issue);
    }
    if (countMismatch && !sitemapCountIsStrictBlock()) {
      push(info, "sitemap count differs from baseline (WARN unless SMOKE_SITEMAP_COUNT_STRICT=1)");
    }
  }

  if (testCase.feedAtom && body) {
    for (const issue of validateFeedXml(body, { kind: "atom", expectedEntries: DEFAULT_EXPECTED_FEED_ENTRIES })) {
      push(block, issue);
    }
  }
  if (testCase.feedRss && body) {
    for (const issue of validateFeedXml(body, { kind: "rss", expectedEntries: DEFAULT_EXPECTED_FEED_ENTRIES })) {
      push(block, issue);
    }
  }

  if (testCase.hsts) {
    const sts = headers["strict-transport-security"] ?? "";
    const h = assertHeader({ "strict-transport-security": sts }, "strict-transport-security", {
      includes: "max-age=31536000",
    });
    if (!h.ok) push(warn, h.message);
    if (!sts.includes("includeSubDomains")) push(warn, "HSTS missing includeSubDomains");
    if (sts.includes("preload")) push(warn, "HSTS includes preload (zone policy is preload=false)");
  }

  if (testCase.workerHsts) {
    const sts = headers["strict-transport-security"] ?? "";
    if (!sts.includes("max-age=31536000")) {
      push(block, `security: HSTS missing max-age=31536000 (${sts || "absent"})`);
    }
    if (!sts.includes("includeSubDomains")) {
      push(block, "security: HSTS missing includeSubDomains");
    }
    if (sts.includes("preload")) {
      push(block, "security: HSTS must not include preload (zone policy is preload=false)");
    }
  }

  if (testCase.securityHeaders) {
    for (const issue of validateSecurityHeaders(headers, {
      requireCspReportOnly: true,
      allowFrameDeny: Boolean(testCase.embedSurface),
    })) {
      push(block, `security: ${issue}`);
    }
    const sts = headers["strict-transport-security"] ?? "";
    if (!sts.includes("max-age=31536000")) {
      push(block, `security: HSTS missing max-age=31536000 (${sts || "absent"})`);
    }
    if (!sts.includes("includeSubDomains")) {
      push(block, "security: HSTS missing includeSubDomains");
    }
    if (sts.includes("preload")) {
      push(block, "security: HSTS must not include preload (zone policy is preload=false)");
    }
  }

  return { block: block.filter(Boolean), warn: warn.filter(Boolean), info: info.filter(Boolean) };
}

export function resolveGitSha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
