# Embed / developer SEO moat outline (Phase 17.1)

Target: `/p/embed.html` + cross-links from URL/OG/WebP guides.

## Sections (public/observable only)

1. What the embed does — iframe loads `/?embed=1` extractor UI
2. How iframe integration works — `id="yte-app"`, `embed.js`, height sync
3. URL structure — public page URLs vs CDN image URLs
4. Video ID extraction — watch, Shorts, youtu.be, embed patterns (no private API)
5. CDN thumbnail URL anatomy — `i.ytimg.com/vi/{ID}/{variant}.jpg`
6. Thumbnail variants — maxres, hq, sd, mq, default (+ WebP when published)
7. maxres fallback — validate; do not guess missing files
8. Browser-side extraction — client checks; no server-side URL logging claim beyond product privacy page
9. CORS constraints — hotlink vs download vs host-copy
10. Open Graph reuse — host confirmed still on own domain
11. CMS integration — WordPress/Blogger/static site patterns
12. Clipboard/download behavior — same as homepage tool
13. Responsive embed — `width:100%`, min-height guidance
14. Security considerations — no API keys; public URLs only
15. Example integration — iframe snippet (existing)

Build-time patches add sections 1–10 to English static render without mutating Blogger source.

## Link targets

- youtube-thumbnail-url
- maxresdefault guide
- blog/OG guide
- webp-vs-jpeg
- share-links
