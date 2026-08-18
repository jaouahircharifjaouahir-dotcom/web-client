# Blogger integration

The public site is **https://11tik.com** on Blogger. The interactive tool is a static app on GitHub Pages.

Do not paste application logic into the Blogger theme. Keep the theme as the website shell.

## 1. Create the page

1. In Blogger, create a page named **YouTube Thumbnail Extractor**.
2. Permalink should resolve to:

```text
https://11tik.com/p/youtube-thumbnail-extractor.html
```

3. Switch the editor to **HTML** view.

## 2. Embed the app

Paste this HTML. It loads the GitHub Pages build inside the page and resizes the iframe.

```html
<div id="yte-embed" style="width:100%;max-width:960px;margin:0 auto;">
  <iframe
    id="yte-app"
    title="YouTube Thumbnail Extractor"
    src="https://jaouahircharifjaouahir-dotcom.github.io/youtube-thumbnail-extractor/?embed=1"
    style="width:100%;min-height:760px;border:0;border-radius:24px;overflow:hidden;background:#f4efe6;"
    loading="lazy"
    referrerpolicy="no-referrer-when-downgrade"
  ></iframe>
</div>
<script src="https://jaouahircharifjaouahir-dotcom.github.io/youtube-thumbnail-extractor/embed.js"></script>
```

## 3. Save and test

1. Publish the page.
2. Open it on desktop.
3. Open it on a phone.
4. Paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ` and confirm a thumbnail appears.

## CSS isolation

The app namespaces all classes with `yte-` and does not depend on Blogger theme CSS. The iframe prevents theme styles from breaking the tool.

## iframe notes

- The app uses container width, not `100vw`.
- `?embed=1` hides site chrome that would duplicate Blogger’s header.
- `embed.js` listens for `{ source: "yte", type: "resize", height }` messages and grows the iframe. Only the height number is used.

## DNS

Keep `11tik.com` pointed at Blogger. GitHub Pages is only the application host. Changing root DNS to GitHub would take the blog offline.
