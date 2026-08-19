# Search Console setup

Use official Google Search Console. Do not automate undocumented APIs.

## 1. Property

Create a **Domain** property for `11tik.com` (covers www, apex, http, https). DNS TXT verification is the durable method.

If a URL-prefix property already exists, prefer `https://www.11tik.com/` as the prefix, but the domain property is the source of truth.

## 2. Preferred host

Search Console will show both apex and www. The live preferred host is **www**:

- `https://11tik.com/` → 301 → `https://www.11tik.com/`

Keep that redirect. Do not try to canonicalize both ways.

## 3. Sitemap

Submit:

1. `https://www.11tik.com/sitemap.xml`
2. `https://www.11tik.com/sitemap-pages.xml` after pages exist

Expect “couldn’t fetch / 0 discovered” until Blogger actually lists URLs. That is a publishing problem, not a Search Console bug.

## 4. URL inspection

Inspect `https://www.11tik.com/`.

Confirm:

- HTTP 200
- Canonical user-declared: `https://www.11tik.com/`
- Canonical Google-selected: same URL after recrawl
- `index,follow` (no accidental noindex)
- Mobile rendering includes the H1, intro, form, and FAQ in the page

Request indexing after the upgraded theme is live.

## 5. Enhancements

Check Experience → HTTPS, Core Web Vitals, and any FAQ/product enhancements. FAQ rich results are optional. Invalid or unseen FAQ schema should be fixed, not celebrated.

## 6. Core Web Vitals

Targets: LCP &lt; 2.5s, INP &lt; 200ms, low CLS. The tool UI must stay above the fold. Do not load the app in an iframe.

## 7. Manual actions and security

If either report is non-empty, stop and fix the cause. Do not buy links or inject hidden text.

## KPI list (observe, do not fake)

- Indexed pages
- Impressions / clicks / CTR / average position
- Queries for “youtube thumbnail extractor” and close variants
- Page indexing reasons
- Sitemap discovered vs indexed
- Canonical mismatches
- Core Web Vitals
- Manual actions
- Security issues

## Ranking experiments

Log title, description, internal-link, content, UX, or performance changes in `docs/seo-changelog.md` with date, URL, baseline, and result. No cloaking.
