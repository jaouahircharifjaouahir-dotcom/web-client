# Localized path soft-404 (known limitation)

## Behavior

Cloudflare Assets uses `not_found_handling: single-page-application`.

Unknown paths under `/l/{lang}/…` that are **not** generated as static files may receive the SPA shell with HTTP 200 (soft-404) instead of a hard 404.

## What we do **not** do

- Do **not** add `/l/*/2026/*` (or similar) to `run_worker_first` to “fix” soft-404.
- Do **not** change global `not_found_handling` without an explicit architecture proposal.
- Do **not** use Worker routing for translated article/page HTML.

## Mitigations (this system)

1. Sitemap includes **only** ready + hash-valid + file-present locale URLs.
2. Hreflang includes **only** the same set.
3. Internal localized links prefer a ready locale equivalent; otherwise fall back to English canonical.
4. Compact publishability manifest never lists missing/stale locales.

Soft-404 for speculative `/l/{lang}/2026/….html` paths remains a **separate** Assets architecture issue.
