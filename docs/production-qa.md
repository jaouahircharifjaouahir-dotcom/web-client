# Production QA — 19 August 2026

This is a technical QA list, not a Google ranking score.

| Item | Status | Notes |
| --- | --- | --- |
| HTTPS preferred URL | Pass in repo | `https://www.11tik.com/`. Live HTTP www still 200 until Blogger HTTPS redirect is enabled. |
| Preferred host www | Pass live | Apex HTTPS 301s to www. |
| Canonical in repo | Pass | Theme + `index.html` + config. Live raw HTML still has Blogger’s HTTP tag until theme restore. |
| Canonical returns 200 | Pass live for HTTPS www | Do not point canonical at GitHub or the 404 tool path. |
| Sitemap | Warn live | Real URLs, currently empty until Blogger pages are published. |
| robots.txt | Pass live | Homepage allowed; sitemap declared. |
| No accidental noindex on homepage | Pass in theme | GitHub shell **is** noindex on purpose. |
| H1 | Pass in theme | Light DOM H1. React H1 hidden on Blogger. |
| Title / description | Pass in repo | Product title, unique description. |
| Favicons 16 / 32 / 180 | Pass | Exact hosted URLs requested. |
| Manifest | Pass | `display: browser`, start_url is the public site. |
| OG / Twitter | Pass in repo | 1200×630 branded image. |
| Structured data | Pass in repo | No ratings. FAQ matches visible copy. |
| hreflang | Pass | Not manufactured. |
| Internal links | Warn until publish | Guides/legal HTML is ready; URLs 404 until created in Blogger. |
| Keyword stuffing / fake schema | Pass | Not used. |
| CI SEO check | Pass when `npm run seo:audit` exits 0 | Added to GitHub Actions. |
| Blogger integration | Needs theme restore | File: `docs/blogger-theme.xml`. |
| Static host not competing | Pass in repo | `noindex,follow` after Pages deploy. |

## Operator steps still required

1. Restore the Blogger theme.
2. Enable HTTPS redirect.
3. Rename the blog title.
4. Publish `docs/blogger-pages/*`.
5. Hard-refresh the live homepage.
6. Inspect `https://www.11tik.com/` in Search Console.
