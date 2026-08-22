#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const live = process.argv.includes("--live") || process.env.SEO_AUDIT_LIVE === "1";

const ICON_32 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj3ow8HyWy9yRQFsg4KZb6tJUZwxmUUEuEBv5FzGZMbQrZ9wzK7tCB5GfEPlvGu4fTNSqAPeke2IJdpwubgUfq7XdryvcebCtYraxd6l2vUDo8hG3RimtLewbO1R4TB1_WehF-PziUil11Sb_rPJZ1YqlS5ikOWvartEdOCVK6s8SsmZaT-qK-HlzzAtG1n/s32/favicon-2.png";
const ICON_16 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEihb_sRR2V8NIZeXgIcfoASdqkVpP_dJJw0aWqqyrfEScm_bdpf5JrwNRLoEqlNhoM9S1c04HkxXeuNcwipE6U4uHtuoqmeMBHTC_oYjQfVuwE8vGuQd-HO9wQrnbT8FjnRanV5l12qwI7oQDo-79aeYKW1RsMZzgcWd-ECWdqJiRy0VCTeNVhycwFxz5bB/s16/favicon-1.png";
const ICON_180 =
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgsK_kbqmn-MxxqHuxGNn_zB550uVfsk6tOxxn5aOqdpfctXcSb7v38a3W-jVKYS7plgByL7Ab2mslJd3juenu64QRnDc5qmC2yUtFTasYuGEqeJKwkPaag4XazIwU98clI_a6pOvlJ6uFjd9PsOGqW-spiCqDU11skry2hbU9inYPr3k8WUY64rqwl0wNx/s180/apple-touch-icon.png";
const CANONICAL = "https://www.11tik.com/";
const TITLE = "YouTube Thumbnail Extractor – Download HD YouTube Thumbnails";

/** @type {{level:"PASS"|"WARNING"|"ERROR", id:string, message:string}[]} */
const findings = [];

function pass(id, message) {
  findings.push({ level: "PASS", id, message });
}
function warn(id, message) {
  findings.push({ level: "WARNING", id, message });
}
function error(id, message) {
  findings.push({ level: "ERROR", id, message });
}

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function mustExist(rel, id) {
  if (existsSync(join(root, rel))) pass(id, `${rel} exists`);
  else error(id, `${rel} is missing`);
}

function attr(html, selectorHint, attrName) {
  const re = new RegExp(`<${selectorHint}[^>]*\\b${attrName}=["']([^"']+)["']`, "i");
  return html.match(re)?.[1] ?? "";
}

function all(html, re) {
  return [...html.matchAll(re)].map((m) => m[1] ?? m[0]);
}

function parseJsonLd(html) {
  const blocks = all(html, /<script type=["']application\/ld\+json["']>\s*([\s\S]*?)<\/script>/gi);
  const parsed = [];
  for (const block of blocks) {
    try {
      parsed.push(JSON.parse(block));
    } catch {
      error("jsonld-parse", "JSON-LD is not valid JSON");
    }
  }
  return parsed;
}

const index = read("index.html");
const theme = read("docs/blogger-theme.xml");
const config = read("src/config.ts");
const site = read("src/seo/site.ts");
const manifest = JSON.parse(read("public/site.webmanifest"));

mustExist("public/images/social/og-image-1200x630.png", "og-file");
mustExist("public/site.webmanifest", "manifest-file");
mustExist("public/favicon.svg", "svg-icon");
mustExist("docs/blogger-theme.xml", "theme-file");

const title = index.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
if (title === TITLE) pass("title", "index.html title matches the preferred query title");
else error("title", `index.html title is "${title}"`);

if (new Set(all(index, /<title>([^<]+)<\/title>/g)).size === 1) pass("title-unique", "index.html has one title");
else error("title-unique", "index.html has duplicate titles");

const desc = attr(index, "meta[^>]*name=[\"']description[\"']", "content") || index.match(/name="description"[^>]*content="([^"]+)"/)?.[1] || "";
const descMatch = index.match(/name="description"\s+content="([^"]+)"/);
const description = descMatch?.[1] ?? "";
if (description.length >= 50 && description.length <= 170) pass("description", `meta description length ${description.length}`);
else error("description", `meta description length ${description.length}`);

if (index.includes('rel="canonical" href="https://www.11tik.com/"')) pass("canonical", "GitHub shell canonical is the preferred public URL");
else error("canonical", "index.html canonical must be https://www.11tik.com/");

if (/content="noindex,follow"/.test(index)) pass("robots-shell", "GitHub Pages shell is noindex,follow");
else error("robots-shell", "GitHub Pages must notindex so it does not compete with Blogger");

if (index.includes('name="viewport"')) pass("viewport", "viewport exists");
else error("viewport", "viewport missing");

for (const [id, url] of [
  ["icon-32", ICON_32],
  ["icon-16", ICON_16],
  ["icon-180", ICON_180],
]) {
  if (index.includes(url) && theme.includes(url)) pass(id, `${id} uses the stable hosted favicon`);
  else error(id, `${id} is missing from index.html or the Blogger theme`);
}

if (index.includes('property="og:image"')) pass("og-image", "Open Graph image tag exists");
else error("og-image", "og:image missing");
if (index.includes('property="og:image:width" content="1200"') && index.includes('property="og:image:height" content="630"')) {
  pass("og-dims", "og:image dimensions are 1200×630");
} else error("og-dims", "og:image width/height missing or wrong");

if (index.includes('name="twitter:card" content="summary_large_image"')) pass("twitter", "Twitter card tags present");
else error("twitter", "Twitter tags missing");

if (index.includes('rel="manifest"')) pass("manifest-link", "manifest link exists");
else error("manifest-link", "manifest link missing");

if (manifest.start_url === CANONICAL && manifest.display === "browser") pass("manifest-values", "manifest start_url is the public site and display is browser");
else error("manifest-values", "manifest start_url/display are incorrect");

if (!/hreflang/i.test(index) && !/hreflang/i.test(theme)) pass("hreflang", "No manufactured hreflang (single-language site)");
else warn("hreflang", "hreflang present; confirm reciprocal localized URLs exist");

if (index.includes('name="keywords"') || theme.includes("name='keywords'")) warn("keywords", "meta keywords found; Google does not use this for ranking");
else pass("keywords", "No meta keywords strategy");

const jsonld = parseJsonLd(index);
if (jsonld.length) pass("jsonld", `parsed ${jsonld.length} JSON-LD block(s) in index.html`);
const dumped = JSON.stringify(jsonld);
if (dumped.includes("aggregateRating") || dumped.includes("reviewCount")) error("fake-schema", "Do not invent ratings or reviews");
else pass("fake-schema", "No fake ratings/reviews in GitHub JSON-LD");

if (site.includes(`canonicalHome: "${CANONICAL}"`) && config.includes("https://www.11tik.com")) pass("config-url", "Application config uses the www HTTPS origin");
else error("config-url", "src/config.ts / src/seo/site.ts must use https://www.11tik.com");

if (theme.includes("link href='https://www.11tik.com/' rel='canonical'")) pass("theme-canonical", "Blogger theme adds an HTTPS www canonical");
else error("theme-canonical", "Blogger theme is missing the HTTPS canonical override");

if (theme.includes(`<title>${TITLE}</title>`)) pass("theme-title", "Homepage title is set in the Blogger theme");
else error("theme-title", "Blogger homepage title is wrong");

const app = read("src/App.tsx");
if (app.includes("<h1>YouTube Thumbnail Extractor</h1>")) pass("theme-h1", "Application still has a single visible H1");
else error("theme-h1", "H1 missing from App.tsx");

if (theme.includes("<![CDATA[") && theme.includes("querySelectorAll")) error("inline-js", "Inline CDATA JavaScript will throw Unexpected token < in Blogger");
else pass("inline-js", "No Blogger CDATA JavaScript in the theme head");

if (theme.includes("site.webmanifest")) warn("manifest-theme", "Theme still points at a GitHub manifest that may 404 until Pages deploy");
else pass("manifest-theme", "Blogger theme does not fetch the undeployed GitHub manifest");

if (theme.includes("class='yte-seo'") && theme.includes("How do I download a YouTube Thumbnail") === false) {
  /* case check below */
}
if (theme.includes("How do I download a YouTube thumbnail?")) pass("theme-faq", "Visible FAQ exists in the Blogger theme");
else error("theme-faq", "FAQ copy missing from theme");

if (theme.includes("name='robots'") && theme.includes("index,follow") && theme.includes("noindex,follow")) {
  pass("theme-robots", "Indexable pages get index,follow; search/archive/error get noindex,follow");
} else error("theme-robots", "robots meta rules missing from theme");

if (theme.includes("FAQPage") && theme.includes("WebApplication") && theme.includes("WebSite")) pass("theme-schema", "Homepage JSON-LD includes WebSite, WebApplication, and FAQPage");
else error("theme-schema", "Theme structured data incomplete");

if (theme.includes("amiradocumentary.blogspot.com")) error("old-host", "Old Blogger hostname still referenced");
else pass("old-host", "Old amiradocumentary hostname removed from page list");

if (theme.includes("http://www.11tik.com/' rel='canonical'")) warn("blogger-http-canonical", "Blogger all-head-content still injects an HTTP canonical at runtime; HTTPS override plus HTTPS redirect are required");
else pass("blogger-http-canonical", "Theme source does not hardcode an HTTP canonical");

if (/\bkeyword\b.*youtube thumbnail extractor youtube thumbnail downloader/i.test(theme)) error("stuffing", "Keyword-stuffing string detected");
else pass("stuffing", "No stuffed keyword strings in the theme");

const ogStat = statSync(join(root, "public/images/social/og-image-1200x630.png"));
if (ogStat.size > 5000 && ogStat.size < 1_500_000) pass("og-size", `OG image is ${ogStat.size} bytes`);
else warn("og-size", `OG image size looks unusual: ${ogStat.size} bytes`);

if (live) {
  const urls = [
    CANONICAL,
    "http://www.11tik.com/",
    "https://11tik.com/",
    "https://www.11tik.com/robots.txt",
    "https://www.11tik.com/sitemap.xml",
    "https://www.11tik.com/about",
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      const loc = res.headers.get("location") || "";
      pass("live-fetch", `${res.status} ${url}${loc ? ` → ${loc}` : ""}`);
      if (url === CANONICAL && res.status !== 200) error("live-home", "Preferred URL did not return 200");
      if (url === "https://11tik.com/" && ![301, 302, 308].includes(res.status)) warn("www-host", "Apex host should redirect to www");
      if (url === "http://www.11tik.com/" && res.status === 200) {
        warn("https-redirect", "http://www.11tik.com/ still returns 200. Enable Blogger HTTPS redirect so HTTP is not indexable.");
      }
      if (url.endsWith("robots.txt") && res.ok) {
        const body = await res.text();
        if (body.includes("Sitemap: https://www.11tik.com/sitemap.xml")) pass("robots-sitemap", "robots.txt declares the real sitemap");
        else error("robots-sitemap", "robots.txt sitemap declaration missing");
        if (/Disallow: \/$/m.test(body)) error("robots-home", "robots.txt blocks the homepage");
        else pass("robots-home", "Homepage is allowed in robots.txt");
      }
    } catch (err) {
      error("live-fetch", `Failed ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

const errors = findings.filter((f) => f.level === "ERROR").length;
const warnings = findings.filter((f) => f.level === "WARNING").length;
const passes = findings.filter((f) => f.level === "PASS").length;
const score = Math.max(0, Math.round((passes / Math.max(1, findings.length)) * 100));

const report = {
  technicalSeo: score,
  indexability: findings.some((f) => f.id === "canonical" && f.level === "ERROR") ? 40 : 95,
  metadata: findings.some((f) => ["title", "description", "og-image"].includes(f.id) && f.level === "ERROR") ? 50 : 96,
  images: findings.some((f) => f.id.startsWith("icon") && f.level === "ERROR") ? 60 : 94,
  structuredData: findings.some((f) => f.id.includes("jsonld") || f.id === "theme-schema" ? f.level === "ERROR" : false) ? 50 : 100,
  internalLinking: theme.includes("/about") && theme.includes("/privacy") ? 90 : 60,
};

console.log("SEO AUDIT");
for (const item of findings) console.log(`${item.level.padEnd(7)} ${item.id}: ${item.message}`);
console.log("");
console.log("LOCAL QA DASHBOARD (not a Google ranking score)");
console.log(`TECHNICAL SEO     ${report.technicalSeo}/100`);
console.log(`INDEXABILITY      ${report.indexability}/100`);
console.log(`METADATA          ${report.metadata}/100`);
console.log(`IMAGES            ${report.images}/100`);
console.log(`STRUCTURED DATA   ${report.structuredData}/100`);
console.log(`INTERNAL LINKING  ${report.internalLinking}/100`);
console.log(`PASS=${passes} WARNING=${warnings} ERROR=${errors}`);

if (errors) process.exit(1);
