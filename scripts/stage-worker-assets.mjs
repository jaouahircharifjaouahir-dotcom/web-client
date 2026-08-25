import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateStaticSite } from "./generate-static-site.mjs";
import {
  syncBloggerThemePoc,
  SHARE_LINKS_ARTICLE_ID,
  resolveLocalePublishState,
  readEnglishSourceHash,
} from "./article-i18n.mjs";

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
`,
);

writeFileSync(
  join(staged, ".assetsignore"),
  `**/*.map
**/.DS_Store
`,
);

generateStaticSite(staged);

const sourceHash = readEnglishSourceHash();
const frenchReady = resolveLocalePublishState(SHARE_LINKS_ARTICLE_ID, "fr", sourceHash).publishable;
syncBloggerThemePoc(join(root, "docs", "blogger-theme.xml"), frenchReady);
