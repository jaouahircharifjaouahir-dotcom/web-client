# Deployment

## Public site (Blogger)

1. Publish the HTML in `docs/blogger-pages/` as Blogger **Pages** using the exact slugs in `docs/keyword-map.md`.
2. Restore `docs/blogger-theme.xml` from this repo (keep any Blog ID copies only in local Downloads, not in git).
3. Blogger → Theme → Restore.
4. Settings → HTTPS → **Redirect to HTTPS** (required: `http://www.11tik.com/` currently returns 200).
5. Settings → Basic → rename the blog title to `YouTube Thumbnail Extractor` so feeds stop using `وثائقيات اميرة`.
6. Settings → Search preferences → custom robots.txt should keep `Allow: /` and:

```txt
User-agent: Mediapartners-Google
Disallow:

User-agent: *
Disallow: /search
Disallow: /share-widget
Allow: /

Sitemap: https://www.11tik.com/sitemap.xml
Sitemap: https://www.11tik.com/sitemap-pages.xml
```

7. Hard refresh `https://www.11tik.com/` (Ctrl+F5). Confirm title, HTTPS canonical, favicons, H1 in view-source, and the extractor still works.

Do **not** point `11tik.com` DNS at GitHub Pages. GitHub Pages is not a production origin.

## Application assets (Workers Static Assets)

`npm run build` writes Vite output into `dist/`, then `scripts/stage-worker-assets.mjs` copies it to `dist-assets/web-client/` so public URLs stay `/web-client/…`.

`11tik-edge` serves those files as Cloudflare Workers Static Assets. Matching files do not invoke Worker code. Dynamic paths under `run_worker_first` in `wrangler.jsonc` still run the Worker.

## Production deploy (Workers Builds)

This cannot be finished from the repository. Connect GitHub in the Cloudflare dashboard (Cloudflare creates the deploy token; do not paste one into the repo).

1. Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → **11tik-edge** → **Settings** → **Builds** → **Connect**.
2. Authorize GitHub if asked, then pick `jaouahircharifjaouahir-dotcom/web-client`.
3. Save these build settings ([official docs](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)):

| Setting | Value |
| --- | --- |
| Root directory | `/` (repository root) |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch builds | Off (do not deploy PRs to production) |

4. Under **Build watch paths** ([official docs](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/)), set include/exclude (API names: `path_includes` / `path_excludes`):

Include:

```text
src/**
public/**
workers/**
scripts/**
wrangler.jsonc
package.json
package-lock.json
vite.config.ts
vite.embed.config.ts
index.html
tsconfig.json
tsconfig.app.json
tsconfig.node.json
```

Exclude:

```text
docs/**
.cursor/**
README.md
**/*.md
```

5. Save. Cloudflare should start a first build from `main`. After that succeeds, GitHub Pages can be disabled (Settings → Pages) because production no longer uses github.io.

GitHub Actions `ci.yml` only verifies; it does not deploy. There is no `pages.yml` or `cloudflare-edge.yml`.

## Local QA

```bash
npm run lint
npm run typecheck
npm test
npm run seo:audit
npm run build
```

`npm run seo:audit -- --live` adds live HTTP checks.
