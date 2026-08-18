# Blogger integration

The public site is **https://11tik.com** on Blogger. The tool is the GitHub Pages build, injected **directly into the theme** (no iframe).

## Recommended: upload the theme

Use the edited file:

```text
c:\Users\ADMIN\Downloads\theme-4072124001762126765.xml
```

In Blogger: **Theme → Backup → Restore** and upload that XML.

The homepage then contains `#yte-root` and loads:

- `blogger-app.css`
- `blogger-app.js`

from GitHub Pages. Blogger chrome (hamburger, search, empty posts, Powered by Blogger) stays hidden.

## Alternative: HTML gadget / page

If you are not replacing the full theme, paste this in HTML view. Still no iframe:

```html
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://jaouahircharifjaouahir-dotcom.github.io/youtube-thumbnail-extractor/blogger-app.css">
<div id="yte-root"></div>
<script src="https://jaouahircharifjaouahir-dotcom.github.io/youtube-thumbnail-extractor/blogger-app.js?v=3"></script>
```

## DNS

Keep `11tik.com` pointed at Blogger. Do not point the root domain at GitHub Pages.
