import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { keywordLandingUrls } from "./site-urls.mjs";

const urls = keywordLandingUrls();
const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (loc) => `  <url>
    <loc>${loc.replace(/&/g, "&amp;")}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const out = join(dirname(fileURLToPath(import.meta.url)), "../public/keyword-sitemap.xml");
writeFileSync(out, body);
console.log(`Wrote ${urls.length} keyword URLs to public/keyword-sitemap.xml`);
