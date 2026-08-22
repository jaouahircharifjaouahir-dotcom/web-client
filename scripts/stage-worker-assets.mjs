import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
