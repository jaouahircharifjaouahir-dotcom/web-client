# Sitemap strategy

Production sitemap URLs (verified):

- `https://www.11tik.com/sitemap.xml` (Blogger posts)
- `https://www.11tik.com/sitemap-pages.xml` (Blogger pages)

`robots.txt` already declares:

```txt
Sitemap: https://www.11tik.com/sitemap.xml
```

Add this second declaration in Blogger → Settings → Search preferences → Custom robots.txt when pages exist:

```txt
Sitemap: https://www.11tik.com/sitemap-pages.xml
```

Do not invent a GitHub Pages sitemap for the public domain. GitHub is not the ranking host.

## What belongs in the sitemap

Only canonical, indexable, live 200 URLs we want indexed:

| URL | Role | Add when |
| --- | --- | --- |
| `https://www.11tik.com/` | Tool / pillar | Already the homepage. Appears after Blogger has indexable homepage content. If Blogger still omits `/` from the XML, Search Console URL Inspection still works. |
| `/p/how-to-download-youtube-thumbnail.html` | Tutorial | After the page is published |
| `/p/youtube-thumbnail-url.html` | URL guide | After publish |
| `/p/youtube-thumbnail-size.html` | Size guide | After publish |
| `/p/youtube-shorts-thumbnail.html` | Shorts guide | After publish |
| `/p/about.html` | Trust | After publish |
| `/p/privacy.html` | Trust | After publish |
| `/p/contact.html` | Trust | After publish |
| `/p/terms.html` | Trust | After publish |

## What must never appear

- `http://` variants
- apex `https://11tik.com/` (redirect)
- GitHub Pages app URL
- `/search`
- `/share-widget`
- feeds
- 404s
- `/p/youtube-thumbnail-extractor.html` (currently 404; do not recreate as a second tool URL)
- UTM copies of the same page

## lastmod

Let Blogger set `lastmod` when a page actually changes. Do not fake freshness.

## Empty sitemap today

Both XML files were empty `<urlset>` on 19 August 2026. That is because no posts/pages were in the Blogger feeds. Publishing the pages in `docs/blogger-pages/` is the fix. Do not generate a giant fake sitemap in this repository.

`X-Robots-Tag: noindex` on the sitemap response is Blogger’s way of keeping the XML file itself out of search. Leave it.

## Index

A sitemap index is unnecessary until there are thousands of URLs. This product should stay small on purpose.
