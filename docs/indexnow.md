# IndexNow on Blogger

Pings go to Bing and IndexNow partners. Google does not use IndexNow.

`keyLocation` must be on `www.11tik.com` (same host as the URLs). The job uses:

`https://www.11tik.com/9f3a7c1e4b8d2f06a5c9e3b7d1f48a26.txt`

Blogger still serves that path as HTML. After you restore the theme, that URL must show only the key. If Bing later rejects the file as not `text/plain`, IndexNow cannot fully verify on Blogger.

```bash
npm run search:ping
```
