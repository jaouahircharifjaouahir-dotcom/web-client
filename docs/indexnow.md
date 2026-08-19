# IndexNow on Blogger

The job collects homepage, legal pages, Blogger posts, Blogger pages, and sitemap URLs, then submits them to IndexNow (Bing and partners).

**Google does not use IndexNow.** For Google, keep the sitemap in Search Console.

- Every **10 minutes**: submit only if a feed changed.
- Every day at **08:00 UTC**: submit the full URL list.

```bash
node scripts/search-engines-ping.mjs
node scripts/search-engines-ping.mjs --all
```
