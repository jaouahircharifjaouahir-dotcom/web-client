# IndexNow (hourly cap)

This repo sends a crawl signal to IndexNow (Bing and other IndexNow engines). **Google does not use IndexNow.** Google still discovers pages from the sitemap, links, and Search Console.

Pings never run in the visitor’s browser. A public page-view ping would be spam.

## Rate limit

At most **one ping per hour**, even if you deploy twice. GitHub Actions also runs about once an hour.

## Key file on 11tik.com

IndexNow only accepts URLs for `www.11tik.com` if this file exists and returns the key as plain text:

`https://www.11tik.com/9f3a7c1e4b8d2f06a5c9e3b7d1f48a26.txt`

Blogger does not host arbitrary `.txt` files at the domain root. Until that file is reachable on 11tik.com, IndexNow will reject the ping. The same file is in `public/` for GitHub Pages only; that host cannot verify `11tik.com` URLs.

## Manual run

```bash
node scripts/search-engines-ping.mjs
node scripts/search-engines-ping.mjs --force
```
