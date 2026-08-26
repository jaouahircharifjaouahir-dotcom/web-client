/**
 * Scan staged /l/** HTML for favicon + localized image alt coverage.
 * Usage: node scripts/i18n/audit-localized-seo.mjs [stagedRoot]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LOCALIZED_PAGE_ICONS } from "./render-localized.mjs";

const staged = process.argv[2] || join(process.cwd(), "dist-assets");

function walkHtml(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkHtml(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

function imgTags(html) {
  return [...String(html).matchAll(/<img\b([^>]*)>/gi)].map((m) => {
    const attrs = m[1];
    const src = (/src=["']([^"']+)/i.exec(attrs) || [])[1] || "";
    const hasAlt = /\balt=/i.test(attrs);
    const alt = hasAlt ? (/alt=["']([^"']*)/i.exec(attrs) || [])[1] ?? "" : null;
    return { src, alt, hasAlt };
  });
}

const files = walkHtml(join(staged, "l"));
let pages = 0;
let withFavicon = 0;
let missingFavicon = 0;
let totalImages = 0;
let withAlt = 0;
let emptyAlt = 0;
let missingAltAttr = 0;
let englishLookingAlt = 0;
const missingFaviconSamples = [];
const englishAltSamples = [];

for (const file of files) {
  pages += 1;
  const htmlRaw = readFileSync(file, "utf8");
  // Ignore JSON-LD / scripts (FAQ copy may mention literal <img> tags).
  const html = htmlRaw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const hasIcon =
    htmlRaw.includes(LOCALIZED_PAGE_ICONS.png32) ||
    htmlRaw.includes('rel="icon"') ||
    htmlRaw.includes("rel='icon'");
  if (hasIcon) withFavicon += 1;
  else {
    missingFavicon += 1;
    if (missingFaviconSamples.length < 10) missingFaviconSamples.push(file.replace(/\\/g, "/"));
  }

  // Article/utility static pages (not SPA shells under l/{lang}/index.html alone with yte-root)
  const isShell = htmlRaw.includes('id="yte-root"');
  if (isShell) continue;

  for (const img of imgTags(html)) {
    totalImages += 1;
    if (!img.hasAlt) {
      missingAltAttr += 1;
      continue;
    }
    if (img.alt === "") emptyAlt += 1;
    else {
      withAlt += 1;
      // Exact English leftovers only (loanwords like "Diagram" in CS/DE are OK).
      if (
        /\b(Diagram showing|Labeled anatomy|Workflow showing extract)\b/i.test(img.alt) ||
        img.alt === "Diagram showing a YouTube watch URL converted into a video ID and then a thumbnail image URL"
      ) {
        englishLookingAlt += 1;
        if (englishAltSamples.length < 10) {
          englishAltSamples.push({ file: file.replace(/\\/g, "/"), alt: img.alt.slice(0, 80) });
        }
      }
    }
  }
}

const report = {
  staged,
  pages,
  favicon: { withFavicon, missingFavicon, missingFaviconSamples },
  images: {
    totalImages,
    withAlt,
    emptyAlt,
    missingAltAttr,
    englishLookingAlt,
    englishAltSamples,
  },
  icons: LOCALIZED_PAGE_ICONS,
};

console.log(JSON.stringify(report, null, 2));
if (missingFavicon > 0 || englishLookingAlt > 0 || missingAltAttr > 0) {
  process.exitCode = 1;
}
