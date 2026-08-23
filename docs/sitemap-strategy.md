# Sitemap strategy

## Production sitemap URLs

- `https://www.11tik.com/sitemap.xml` — **static build output** from Worker Assets (`dist-assets/sitemap.xml`)
- `https://www.11tik.com/sitemap-pages.xml` — Blogger’s native pages sitemap (proxied; unchanged by the static generator)

`robots.txt` declares:

```txt
Sitemap: https://www.11tik.com/sitemap.xml
```

Do not invent a GitHub Pages sitemap for the public domain. GitHub is not the ranking host.

## How `sitemap.xml` is built

Generated at build time by `scripts/generate-static-site.mjs` via `workers/sitemap-canonicals.js`.

Sources (intentional, explicit):

1. **Homepage** — `https://www.11tik.com/`
2. **Published blog posts** — every `href` in `src/content/posts.ts` (`GUIDE_POSTS`)
3. **Indexable utility allowlist** — `INDEXABLE_UTILITY_PATHS` in `workers/sitemap-canonicals.js`

Not a source:

- `workers/post-descriptions.js` (`POST_DESCRIPTIONS`) — **metadata only** (description lookup / HTML polishing). A key there must **not** imply sitemap inclusion.
- Unpublished local HTML under `docs/blogger-pages/`
- Locale hosts (`ar.11tik.com`, `fr.11tik.com`, …)
- Query-string or `#fragment` URLs

### Utility allowlist (current)

- `/p/about.html`
- `/p/contact.html`
- `/p/embed.html`
- `/p/privacy.html`
- `/p/terms-of-use.html`
- `/p/keyword-tools.html`

### Legacy `/p/` guides (excluded)

These paths may still exist in `POST_DESCRIPTIONS` for compatibility. They **must never** appear in `sitemap.xml` (they 404; canonicals are `/2026/08/…`):

- `/p/how-to-download-youtube-thumbnail.html`
- `/p/youtube-thumbnail-url.html`
- `/p/youtube-thumbnail-size.html`
- `/p/youtube-shorts-thumbnail.html`

## Lifecycle

| Event | Sitemap effect |
| --- | --- |
| New article added to `GUIDE_POSTS` | Appears on next build |
| Article `href` changed in `GUIDE_POSTS` | New URL appears; old URL disappears (no automatic redirect from sitemap generation) |
| Article removed from `GUIDE_POSTS` | Disappears on next build |
| Legacy meta-only path in `POST_DESCRIPTIONS` | Stays out of sitemap |

## What must never appear

- `http://` variants
- apex `https://11tik.com/` (redirect host)
- GitHub Pages app URL
- `/search`, feeds, UTM copies
- Known 404s / abandoned legacy `/p/` article paths
- Duplicate `<loc>` values
- Locale subdomain URLs in the www sitemap

## Blogger `sitemap-pages.xml`

Left as Blogger’s own pages feed. Do not conflate it with the static `sitemap.xml` generator. Overlap on intentional utilities (about, privacy, …) is acceptable for now; do not expand scope with merge logic unless product asks for it.

## Out of scope (do not add)

- sitemap-add APIs
- KV / Cron
- crawler ping / Indexing API as part of sitemap generation
- Live HTTP fetches during Worker runtime to build the sitemap

## Index sharding

A sitemap index is unnecessary until there are tens of thousands of URLs. This product should stay small on purpose.
