# Keyword map

Single-language English site. Terms are topic guidance, not stuffing targets.

| Keyword / topic | Intent | Primary URL | Supporting URL | Notes |
| --- | --- | --- | --- | --- |
| youtube thumbnail extractor | Tool | `https://www.11tik.com/` | — | Homepage is the tool. Do not create a second extractor URL. |
| youtube thumbnail downloader | Tool (same) | `https://www.11tik.com/` | how-to page | Same intent as extractor. Do not split into a near-duplicate page. |
| youtube thumbnail download | Tool / how-to | `https://www.11tik.com/` | `/2026/08/how-to-download-youtube-thumbnail.html` | Tutorial supports the verb “download”. |
| youtube thumbnail | Mixed | `https://www.11tik.com/` | size + URL guides | Keep the homepage as the default. |
| youtube thumbnail url | Informational | `/2026/08/youtube-thumbnail-url.html` | homepage | How the public image URL is built / copied. |
| youtube thumbnail size / resolution / dimensions / quality | Informational | `/2026/08/youtube-thumbnail-size-resolution.html` | homepage | Explain maxres vs hq vs missing files. |
| youtube thumbnail sizes resolutions study / measured availability | Informational (research) | `/2026/08/youtube-thumbnail-sizes-resolutions-study.html` | size-resolution guide | 300-video sample measurements; do not merge with evergreen guide. |
| youtube shorts thumbnail | Informational + tool | `/2026/08/youtube-shorts-thumbnail-download.html` | homepage | Shorts-specific URL patterns. |
| how to download / get / find a youtube thumbnail | Tutorial | `/2026/08/how-to-download-youtube-thumbnail.html` | homepage | Steps, then CTA to the tool. |
| thumbnail extractor vs maker | Comparison | `/2026/08/thumbnail-extractor-vs-maker.html` | homepage | Extractor is not Canva/Studio upload. |
| YouTube Studio custom thumbnail 2026 | Freshness | `/2026/08/youtube-studio-thumbnail-2026.html` | homepage | Confirm public files after Studio upload. |
| save youtube thumbnail iphone / android | Tutorial | `/2026/08/how-to-save-youtube-thumbnail-on-iphone.html` | homepage | Phone browser, not a second tool. |
| youtube thumbnail featured image / open graph | Webmaster | `/2026/08/how-to-use-youtube-thumbnail-as-blog.html` | URL guide | Confirm file, then host a copy. |
| youtube channel thumbnail extract | Tool support | `/2026/08/how-to-extract-thumbnails-from-youtube.html` | batch guide | Channel URL in Bulk, recent public uploads. |
| youtube thumbnail image / original image | Tool | `https://www.11tik.com/` | size guide | Do not claim 4K if maxres is 1280×720. |
| maxresdefault / maxres 404 / missing HD still | Informational | `/2026/08/what-is-maxresdefaultjpg-when-youtube.html` | size + URL guides | Troubleshooting missing maxres; do not duplicate. |
| YouTube thumbnail WebP vs JPEG | Informational | `/2026/08/webp-vs-jpeg-youtube-thumbnails-which.html` | size guide | Format choice for validated public stills. |
| YouTube thumbnail as blog / OG / WordPress | Tutorial | `/2026/08/how-to-use-youtube-thumbnail-as-blog.html` | URL + download guides | Host a confirmed copy; cautious reuse. |
| youtube thumbnail not appearing / private / age-restricted / processing | Troubleshooting | `/2026/08/youtube-thumbnail-not-appearing-private.html` | maxres + download guides | Video-level unavailability; do not duplicate maxres 404 intent. |
| 11tik share link /thumb vs watch URL | Product education | `/2026/08/11tik-share-links-thumb-vs-youtube.html` | URL guide | `/thumb/{id}` is a result page, not a CDN image. |

## Cannibalization rules

- Do **not** publish `/youtube-thumbnail-downloader` as a second tool clone.
- Do **not** recreate `/p/youtube-thumbnail-extractor.html` while the homepage is the canonical tool.
- `?k=` chips are **UX only**. Do not treat them as ranking URLs (doorway risk).
- Legal pages (about, privacy, contact, terms) must not target thumbnail queries.
- Deep links `?v=` 301 to `/thumb/{id}`. Those pages may index only when the quality gate is INDEX (title, tags, live thumb).

## Internal links

Homepage → four guides + legal pages.  
Each guide → homepage tool CTA + two sibling guides.  
No orphan ranking pages.
