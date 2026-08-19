# SEO audit — 11tik YouTube Thumbnail Extractor

Audited: 19 August 2026. Public site fetched live. Findings below are verified, not guessed.

Preferred public URL: **https://www.11tik.com/**

Architecture preserved: custom domain → Blogger → static app on GitHub Pages → client-side processing. No backend added.

## Verified live state (before this upgrade)

| Check | Evidence |
| --- | --- |
| `https://www.11tik.com/` | HTTP 200 |
| `https://11tik.com/` | 301 → `https://www.11tik.com/` |
| `http://11tik.com/` | 301 → `http://www.11tik.com/` |
| `http://www.11tik.com/` | HTTP 200 (no HTTPS redirect) |
| Raw canonical | `http://www.11tik.com/` |
| Rendered canonical | still `http://www.11tik.com/` (Blogger `all-head-content`) |
| Title | `وثائقيات اميرة` (blog name, not the product) |
| Meta description | missing / empty `og:description` |
| `og:url` | `http://www.11tik.com/` |
| robots meta | none |
| H1 in raw HTML | none |
| H1 in light DOM | none (H1 lived only in Shadow DOM) |
| Favicons | default `/favicon.ico` only |
| `robots.txt` | Allows `/`, disallows `/search` and `/share-widget`, declares `Sitemap: https://www.11tik.com/sitemap.xml` |
| `sitemap.xml` | empty `<urlset>`; response has `X-Robots-Tag: noindex` |
| `sitemap-pages.xml` | empty; same `X-Robots-Tag: noindex` |
| `/p/youtube-thumbnail-extractor.html` | 404 |
| GitHub Pages shell | 200, `index,follow`, canonical pointed at a non-www / missing Blogger page |

Blogger putting `X-Robots-Tag: noindex` on the sitemap document is normal. It stops the XML file from ranking as a page. Google still reads the sitemap declared in `robots.txt`. That is **not** treated as a sitemap block.

hreflang is not required. The site has one English version.

## Findings

### 1. HTTP canonical on the preferred host

- **Current problem:** Raw HTML had `<link href='http://www.11tik.com/' rel='canonical'/>` while users browse HTTPS.
- **Why it matters:** A canonical should be the single preferred final URL. HTTP is a different URL. Ahrefs-style crawlers flag this as an indexability defect. Google may still consolidate HTTPS, but the signal is dirty.
- **Recommended fix:** Emit an HTTPS www canonical. Enable Blogger “Redirect to HTTPS” so `http://www.11tik.com/` is no longer 200.
- **Implemented fix:** Theme outputs `<link href='https://www.11tik.com/' rel='canonical'/>` after `all-head-content`, plus a small script that rewrites the injected HTTP canonical in the rendered DOM. Application config and GitHub `index.html` now use `https://www.11tik.com/`.
- **Verification:** View source for the HTTPS canonical. Enable HTTPS redirect in Blogger, then `curl -I http://www.11tik.com/` should be 301 to HTTPS. Re-fetch after theme restore.

Blogger still injects an HTTP canonical via `all-head-content`. That platform tag cannot be removed without dropping `all-head-content`. The override plus HTTPS redirect is the supported remediation.

### 2. GitHub Pages competing as an indexable duplicate

- **Current problem:** The static host used `index,follow` and canonical `https://11tik.com/p/youtube-thumbnail-extractor.html` (apex, and that path 404s).
- **Why it matters:** Search engines can treat the GitHub URL as a second public tool page.
- **Recommended fix:** `noindex,follow` on the application shell; canonical to the Blogger homepage.
- **Implemented fix:** `index.html` robots `noindex,follow`, canonical `https://www.11tik.com/`.
- **Verification:** `npm run seo:audit`. After Pages deploy, GitHub HTML must contain those tags.

### 3. Title and description were the old blog identity

- **Current problem:** `<title>وثائقيات اميرة</title>`, empty description.
- **Why it matters:** The snippet cannot describe the YouTube Thumbnail Extractor.
- **Recommended fix:** Unique product title and a factual description.
- **Implemented fix:** Homepage title `YouTube Thumbnail Extractor – Download HD YouTube Thumbnails` and a unique meta description in the theme.
- **Verification:** Raw homepage `<title>` after theme upload. Also rename the blog title in Blogger settings so feeds stop using the old name.

### 4. Indexable copy was trapped in Shadow DOM

- **Current problem:** `#yte-root` mounts React in Shadow DOM. `document.querySelectorAll('h1')` returned none. Raw HTML had no H1, FAQ, or internal links.
- **Why it matters:** Do not rely on iframe/shadow content as the only SEO copy. Google may see some shadow content, but the Blogger page itself must explain the tool.
- **Recommended fix:** Light-DOM H1, intro, FAQ, and links around the mount node. Keep a single dominant H1.
- **Implemented fix:** Theme homepage now has crawlable H1 + supporting sections. React hides its H1 when `#yte-root` exists so there are not two competing H1s.
- **Verification:** View source on the homepage; H1 must appear outside `#yte-root`.

### 5. Empty sitemaps

- **Current problem:** Both `/sitemap.xml` and `/sitemap-pages.xml` contain zero URLs because Blogger has no published posts/pages in those feeds.
- **Why it matters:** Sitemaps cannot invent URLs. An empty sitemap is honest but useless for discovery.
- **Recommended fix:** Publish the real Pages in `docs/blogger-pages/`. Do not add junk URLs.
- **Implemented fix:** Documented in `docs/sitemap-strategy.md`. Internal links added for those page URLs. They will 404 until published.
- **Verification:** After publishing, fetch `sitemap-pages.xml` and confirm each URL returns 200 and self-canonicalizes.

### 6. Favicon identity

- **Current problem:** Only Blogger’s default `/favicon.ico`.
- **Why it matters:** Browser tabs, mobile shortcuts, and Google’s favicon crawler need a stable, recognizable icon.
- **Recommended fix:** One hosted identity; do not ship a second conflicting set.
- **Implemented fix:** The three provided Blogger CDN icons (16, 32, 180) are in the theme and in `index.html`. Manifest icons reuse that artwork at 192 and 512.
- **Verification:** `npm run seo:audit` checks the exact URLs.

### 7. Open Graph / Twitter

- **Current problem:** HTTP `og:url`, Arabic `og:title`, empty description, no image.
- **Implemented fix:** HTTPS URL, product title/description, branded 1200×630 image at `public/images/social/og-image-1200x630.png`.
- **Verification:** Sharing debugger after Pages hosts the PNG.

### 8. Trailing slash / host convention

Chosen convention:

- Host: `www.11tik.com` (apex already 301s here on HTTPS)
- Protocol: HTTPS
- Homepage slash: `https://www.11tik.com/`
- Blogger pages: `/p/name.html` (Blogger’s real page URLs)

Query parameters do not create new content. Canonical stays on the clean URL.

## Ahrefs “Missing” labels

Missing hreflang is not an error on a single-language site. Missing X-Robots-Tag on HTML is fine; we do not add it for decoration. Empty sitemap is a content-publishing issue, not a robots trick.

## What this does not claim

These changes do not guarantee #1 rankings. They remove technical defects and make the product understandable to crawlers and users.
