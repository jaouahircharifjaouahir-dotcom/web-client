# IndexNow on Blogger

GitHub cannot put a `.txt` file on `www.11tik.com`. Blogger always answers that path as **HTML**, so the official IndexNow “plain text key file” check often fails. The key still lives on GitHub Pages:

`https://jaouahircharifjaouahir-dotcom.github.io/web-client/9f3a7c1e4b8d2f06a5c9e3b7d1f48a26.txt`

The ping job uses that as `keyLocation`. Bing may still require the same host as `www.11tik.com`.

After you restore the theme, opening

`https://www.11tik.com/9f3a7c1e4b8d2f06a5c9e3b7d1f48a26.txt`

should show the key in black text on white (not a blank page). That is for you to confirm; it does not turn Blogger into a `.txt` server.

## Manual run

```bash
npm run search:ping
node scripts/search-engines-ping.mjs --force
```
