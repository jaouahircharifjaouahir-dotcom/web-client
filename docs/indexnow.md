# IndexNow on Blogger

Pings go to Bing and IndexNow partners. Google does not use IndexNow.

`keyLocation` must stay on the same host as the URLs:

`https://www.11tik.com/9f3a7c1e4b8d2f06a5c9e3b7d1f48a26.txt`

Blogger answers that path as **HTML**, so IndexNow returns `403 UserForbiddedToAccessSite`. Host the real key as `text/plain` on GitHub, then redirect the Blogger path to it.

## One-time Blogger redirect

1. Raw key file (already on `main`):

`https://raw.githubusercontent.com/jaouahircharifjaouahir-dotcom/web-client/main/9f3a7c1e4b8d2f06a5c9e3b7d1f48a26.txt`

2. Blogger → **Settings → Search preferences → Custom redirects**
   - **From:** `/9f3a7c1e4b8d2f06a5c9e3b7d1f48a26.txt`
   - **To:** the raw URL above
   - **302**, enabled → Save

3. Open `https://www.11tik.com/9f3a7c1e4b8d2f06a5c9e3b7d1f48a26.txt`  
   It must redirect and show **only** `9f3a7c1e4b8d2f06a5c9e3b7d1f48a26` (not a Blogger HTML page).

4. GitHub → Actions → **search-ping** → Run workflow.

Do not set `keyLocation` to GitHub. IndexNow already rejected that (`keyLocation` host must match `www.11tik.com`).

```bash
npm run search:ping
```
