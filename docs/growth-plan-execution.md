# Growth plan execution (11tik)

Source plan: `thumbnail-tool-growth-plan.md` (Downloads). Host constraint: **Blogger + GitHub Pages script**, not a greenfield Next.js cutover (that would break the live custom domain path).

## Shipped in this pass

| Plan item | Status | Notes |
| --- | --- | --- |
| Instant preview | Done | Client discovery + `<img loading>` |
| Batch + zip | Done (existing) | Bulk mode |
| Platform | Done | **YouTube only**. TikTok/IG blocked by platform policy |
| Copy URL / share | Done | Copy image URL + share permalink `?v=` |
| Dark mode | Done (existing) | |
| Schema SoftwareApplication + FAQ | Done (existing) | **No fake AggregateRating** |
| Google Indexing API | Done | Sitemap URLs submitted with `npm run google:index` |
| Embed widget | Done | `/p/embed.html` + `embed.js` |
| PWA | Partial | Manifest `standalone` + link from theme. Full SW cannot run on Blogger origin |
| Programmatic video pages | Product deep links | `?v=` auto-extract + share. Not thin SEO farms |
| Blog content pack | Drafts ready | `docs/blogger-pages/blog/*.html` — publish in Blogger |

## Explicitly deferred (plan §5 / architecture)

- Next.js/Astro full rebuild while DNS stays on Blogger
- Fake star ratings in JSON-LD
- Indexing thousands of empty keyword URLs
- Chrome extension / public rate-limited API (needs separate repo + backend)
- Product Hunt launch (operator action)
- Reddit/Discord outreach (operator action)

## Operator checklist

1. Restore theme `11tik-RESTORE-THEME-v26.xml`
2. Wait for Pages deploy (`blogger-app.js?v=19`)
3. Publish Blogger page from `docs/blogger-pages/embed.html` → `/p/embed.html`
4. Publish blog drafts under `docs/blogger-pages/blog/` as real posts
5. Update Privacy if needed (already mentions GA4)
6. Weekly Search Console: coverage, CWV, no manual actions
