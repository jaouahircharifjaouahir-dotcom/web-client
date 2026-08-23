# Keyword map

Single-language English site. Terms are topic guidance, not stuffing targets.

| Keyword / topic | Intent | Primary URL | Supporting URL | Notes |
| --- | --- | --- | --- | --- |
| youtube thumbnail extractor | Tool | `https://www.11tik.com/` | — | Homepage is the tool. Do not create a second extractor URL. |
| youtube thumbnail downloader | Tool (same) | `https://www.11tik.com/` | how-to page | Same intent as extractor. Do not split into a near-duplicate page. |
| youtube thumbnail download | Tool / how-to | `https://www.11tik.com/` | `/p/how-to-download-youtube-thumbnail.html` | Tutorial supports the verb “download”. |
| youtube thumbnail | Mixed | `https://www.11tik.com/` | size + URL guides | Keep the homepage as the default. |
| youtube thumbnail url | Informational | `/p/youtube-thumbnail-url.html` | homepage | How the public image URL is built / copied. |
| youtube thumbnail size / resolution / dimensions / quality | Informational | `/p/youtube-thumbnail-size.html` | homepage | Explain maxres vs hq vs missing files. |
| youtube shorts thumbnail | Informational + tool | `/p/youtube-shorts-thumbnail.html` | homepage | Shorts-specific URL patterns. |
| how to download / get / find a youtube thumbnail | Tutorial | `/p/how-to-download-youtube-thumbnail.html` | homepage | Steps, then CTA to the tool. |
| thumbnail extractor vs maker | Comparison | `/2026/08/thumbnail-extractor-vs-maker.html` | homepage | Extractor is not Canva/Studio upload. |
| YouTube Studio custom thumbnail 2026 | Freshness | `/2026/08/youtube-studio-thumbnail-2026.html` | homepage | Confirm public files after Studio upload. |
| save youtube thumbnail iphone / android | Tutorial | `/2026/08/how-to-save-youtube-thumbnail-on-iphone.html` | homepage | Phone browser, not a second tool. |
| youtube thumbnail featured image / open graph | Webmaster | `/2026/08/how-to-use-youtube-thumbnail-as-blog.html` | URL guide | Confirm file, then host a copy. |
| youtube channel thumbnail extract | Tool support | `/2026/08/how-to-extract-thumbnails-from-youtube.html` | batch guide | Channel URL in Bulk, recent public uploads. |
| youtube thumbnail image / original image | Tool | `https://www.11tik.com/` | size guide | Do not claim 4K if maxres is 1280×720. |

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
