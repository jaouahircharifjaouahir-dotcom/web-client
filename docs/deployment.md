# Deployment

## Public site (Blogger)

1. Publish the HTML in `docs/blogger-pages/` as Blogger **Pages** using the exact slugs in `docs/keyword-map.md`.
2. Restore `docs/blogger-theme.xml` (a copy is also written to Downloads as `theme-4072124001762126765.xml`).
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

Do **not** point `11tik.com` DNS at GitHub Pages.

## Application assets (GitHub Pages)

`main` deploys `dist/` with `VITE_BASE=/youtube-thumbnail-extractor/`.

The shell is `noindex` and canonicalizes to `https://www.11tik.com/`. It exists so Blogger can load `blogger-app.js` and `blogger-app.css`.

After a Pages deploy, the theme uses `blogger-app.js?v=4`. Raise that query if the browser caches an old bundle.

## Local QA

```bash
npm run lint
npm run typecheck
npm test
npm run seo:audit
npm run build
```

`npm run seo:audit -- --live` adds live HTTP checks.
