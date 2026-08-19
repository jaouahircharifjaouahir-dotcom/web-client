# Bing Webmaster setup

Use [Bing Webmaster Tools](https://www.bing.com/webmasters) with the official site, not unofficial scrapers.

1. Add `https://www.11tik.com/` (or the domain `11tik.com`).
2. Verify with DNS or the Bing meta tag if you choose the meta method.
3. Import from Google Search Console if that property is already verified.
4. Submit `https://www.11tik.com/sitemap.xml` and later `https://www.11tik.com/sitemap-pages.xml`.
5. Confirm `https://www.11tik.com/robots.txt` allows the homepage and blocks only `/search` and `/share-widget`.
6. Use URL Inspection on the homepage after the theme restore.
7. IndexNow is optional; see `docs/indexnow.md`. Bing may offer IndexNow from the Webmaster UI. Do not spam URL submissions.

Bing does not need a second copy of the GitHub Pages app.
