# IndexNow (Blogger publish signal)

This works like a WordPress IndexNow plugin: when the Blogger post feed changes, GitHub Actions submits those URLs to IndexNow (Bing and other IndexNow engines).

**Google does not use IndexNow.** No plugin can force Google to index “at lightning speed.” Google still uses the sitemap, internal links, and Search Console. Bing can pick up IndexNow quickly once the key file is live.

Checks run about every **10 minutes**, only if the Atom feed `<updated>` value changed. Nothing runs in the visitor’s browser.

## Key file (required)

`https://www.11tik.com/9f3a7c1e4b8d2f06a5c9e3b7d1f48a26.txt`

The file must be plain text containing only:

`9f3a7c1e4b8d2f06a5c9e3b7d1f48a26`

Blogger usually cannot host that path. Until it returns 200, IndexNow will fail.

## Manual run

```bash
npm run search:ping
node scripts/search-engines-ping.mjs --force
```
