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

Connect this repo to Worker `11tik-edge` in the Cloudflare dashboard: **Workers & Pages → 11tik-edge → Settings → Builds → Connect**.

Recommended dashboard settings:

- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Build watch paths include: `src`, `public`, `workers`, `wrangler.jsonc`, `package.json`, `package-lock.json`, `vite.config.ts`, `vite.embed.config.ts`, `scripts`
- Exclude: `docs`, `README.md`, `.cursor`

GitHub Actions `ci.yml` only verifies; it does not deploy.

## Local QA

```bash
npm run lint
npm run typecheck
npm test
npm run seo:audit
npm run build
```

`npm run seo:audit -- --live` adds live HTTP checks.
