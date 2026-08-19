# SEO changelog

Do not record ranking claims unless measured in Search Console.

| Date | Change | Reason | Expected effect | Verification |
| --- | --- | --- | --- | --- |
| 2026-08-19 | Set preferred URL to `https://www.11tik.com/`. HTTPS canonical override in Blogger theme. GitHub shell `noindex` + same canonical. | Live HTML used `http://www.11tik.com/` as canonical; GitHub Pages was indexable and pointed at a 404. | Cleaner indexation of one public URL. Not a ranking guarantee. | `npm run seo:audit`; URL Inspection after theme restore and Pages deploy. |
| 2026-08-19 | Homepage title, description, OG/Twitter, hosted 16/32/180 favicons, 1200×630 OG image, WebApplication/WebSite/FAQ JSON-LD. | Title was the old Arabic blog name; social tags empty; default favicon only. | Accurate snippets and a stable brand icon. | View source; sharing preview. |
| 2026-08-19 | Crawlable H1, FAQ, and internal links in Blogger light DOM. React H1 hidden in the Blogger host to avoid two H1s. | Product copy lived only in Shadow DOM. | Crawlers can see what the page is without executing the app. | View source: H1 outside `#yte-root`. |
| 2026-08-19 | SEO regression script + CI job `npm run seo:audit`. | Prevent silent metadata/canonical breakage. | Failed builds if critical tags disappear. | GitHub Actions. |
