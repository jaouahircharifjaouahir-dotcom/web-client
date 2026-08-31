import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateStaticSite } from "./generate-static-site.mjs";
import {
  syncBloggerThemePoc,
  SHARE_LINKS_ARTICLE_ID,
  resolveLocalePublishState,
  readEnglishSourceHash,
} from "./article-i18n.mjs";
import { runIndexNowAfterStaticGeneration } from "./i18n/indexnow-submit.mjs";
import { buildGlobalAssetsSecurityHeadersBlock } from "./security-headers.mjs";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const staged = join(root, "dist-assets");
const webClient = join(staged, "web-client");

rmSync(staged, { recursive: true, force: true });
mkdirSync(webClient, { recursive: true });
cpSync(dist, webClient, { recursive: true });

writeFileSync(
  join(staged, "_headers"),
  `# https://developers.cloudflare.com/workers/static-assets/headers/
/web-client/assets/*
  Cache-Control: public, max-age=31536000, immutable
/web-client/*.js
  Cache-Control: public, max-age=31536000, immutable
/web-client/*.css
  Cache-Control: public, max-age=31536000, immutable
/web-client/images/*
  Cache-Control: public, max-age=604800
# Public ready-locale map (no secrets). ACAO allows legacy absolute www fetches
# from locale hosts until caches clear; primary clients use same-origin relative URL.
/web-client/i18n/publishability.json
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD
  Cache-Control: public, max-age=300, must-revalidate
/web-client/i18n/catalog/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD
  Cache-Control: public, max-age=300, must-revalidate
/web-client/i18n/indexnow-snapshot.json
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD
  Cache-Control: public, max-age=300, must-revalidate
/r1nu3dmfdwyzm6u39zktu5gtww7zvv1z.txt
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=3600
/feeds/posts/default
  Content-Type: application/atom+xml; charset=UTF-8
  Cache-Control: public, max-age=3600, must-revalidate
/feeds/posts/default.rss
  Content-Type: application/rss+xml; charset=UTF-8
  Cache-Control: public, max-age=3600, must-revalidate
${buildGlobalAssetsSecurityHeadersBlock()}`,
);

writeFileSync(
  join(staged, ".assetsignore"),
  `**/*.map
**/.DS_Store
`,
);

generateStaticSite(staged);

// IndexNow: after HTML is fully written. Submits only when WORKERS_CI/INDEXNOW_SUBMIT=1.
// Local npm run build / dry-run does not notify search engines.
await runIndexNowAfterStaticGeneration(staged, {
  postsTsPath: join(root, "src", "content", "posts.ts"),
});

const sourceHash = readEnglishSourceHash();
const frenchReady = resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "fr", sourceHash).publishable;
syncBloggerThemePoc(join(root, "docs", "blogger-theme.xml"), frenchReady);
