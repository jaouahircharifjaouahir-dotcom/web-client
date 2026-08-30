# Production monitoring

Operational guide for post-deploy verification of https://www.11tik.com after Workers + Static Assets releases.

## Commands

```bash
# Full production smoke matrix (run after every production deploy)
npm run production:smoke

# Low-traffic subset for scheduled checks (~6 URLs)
npm run production:smoke:scheduled

# Build-time asset integrity manifest (requires npm run build first)
npm run asset:manifest
```

Reports are written to `reports/production-smoke.json` and `reports/asset-manifest.json` (gitignored).

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SMOKE_ORIGIN` | `https://www.11tik.com` | Primary origin |
| `SMOKE_LOCALE_ORIGIN_FR` | `https://fr.11tik.com` | French locale host |
| `SMOKE_LOCALE_ORIGIN_AR` | `https://ar.11tik.com` | Arabic locale host |
| `SMOKE_EXPECTED_SITEMAP_LOCS` | `1095` | Expected `<loc>` count baseline |
| `SMOKE_SITEMAP_COUNT_STRICT` | unset | Set `1` to BLOCK on sitemap count mismatch |

## Critical routes (expected)

| Route | Status | Notes |
|-------|--------|-------|
| `/` | 200 | Homepage SPA shell |
| `/p/about.html` | 200 | Asset-first utility |
| `/2026/08/how-to-download-youtube-thumbnail.html` | 200 | Static article |
| `/p/random.html` | 404 | Hard 404 |
| `/2026/08/this-page-does-not-exist-unique-test.html` | 404 | Hard 404 |
| `/about` | 301 → `/p/about.html` | Edge + Worker fallback |
| `/feeds/posts/default` | 200 Atom | Worker routes variant |
| `/feeds/posts/default?alt=rss` | 200 RSS | Worker + static sidecar |
| `/search` | 410 | Retired |
| `/feeds/pages/default` | 410 | Retired |
| `/sitemap-pages.xml` | 301 → `/sitemap.xml` | Retired |
| `/robots.txt` | 200 | Static asset |
| `/sitemap.xml` | 200 | 1095 URLs (baseline) |
| IndexNow key `.txt` | 200 | Static asset |
| `fr.11tik.com/l/fr/` | 200 | Locale home (Worker) |
| `fr.11tik.com/l/fr/p/about.html` | 200 | Asset-first (Phase 7B) |
| `fr.11tik.com/l/fr/…html/` | 301 | Phase 7A trailing slash |
| `fr.11tik.com/l/fr/?m=1` | 301 → clean home | Query strip |
| Unknown `/l/fr/random.html` | 200 | **Known soft-404 baseline** (WARN if signature changes) |
| `/thumb/{id}` | 200 SPA | Product route |

## Redirect behavior

- `http://www.11tik.com/` → 301 → `https://www.11tik.com/`
- `https://11tik.com/` → 301 → `https://www.11tik.com/`
- Extensionless and trailing-slash canonicalization per Worker + edge rules
- Redirect chains must not exceed 5 hops

## Locale behavior

- French pages: `lang="fr"`, `data-yte-locale="fr"`, canonical on `fr.11tik.com`
- Arabic pages: `lang="ar"`, `dir="rtl"`, canonical on `ar.11tik.com`
- Localized static `.html` must not serve English SPA `#yte-root` shell

## HSTS baseline

Monitor only — do not change in monitoring phases.

- Expected on HTTPS responses: `max-age=31536000` and `includeSubDomains`
- Zone policy: `preload=false` — Worker may include `preload` on some responses (WARN)

## Sitemap / robots / feeds baseline

- **Sitemap:** 1095 locs, no `/search`, no `sitemap-pages.xml`, no `/index.html`
- **Robots:** Allow `/`, Disallow `/search` and `/feeds/`, declare sitemap, AI training bots blocked, Amazonbot allowed
- **Feeds:** 18 Atom entries / 18 RSS items, no Blogger generator markers

## Worker traffic budget

Full smoke (~32 cases): ~15–20 Worker-invoking GETs per run.  
Scheduled subset (~6 cases): ~2–3 Worker GETs.

Run full matrix **after deployments only**. Do not run full matrix every minute.

## Observability

`wrangler.jsonc` includes:

```json
"observability": { "enabled": true }
```

**Status:** CONFIGURED in repository — **PENDING POST-DEPLOY VERIFICATION** that Cloudflare Workers Observability shows `11tik-edge` invocations, errors, and duration after the next deploy.

## Post-deploy procedure

1. Confirm Cloudflare Workers Builds succeeded.
2. Record deployed Worker version UUID from the dashboard.
3. Run `npm run production:smoke` — exit code must be `0`.
4. Run `npm run asset:manifest` on the same commit after `npm run build` (CI does this automatically).
5. Optionally verify Observability in Cloudflare dashboard.
6. Weekly: review Google Search Console and Bing Webmaster (manual).

## Rollback

Version Overrides are unreliable on this account. Prefer gradual deployment or full version swap:

```bash
# Example — replace VERSION with last known-good UUID
npx wrangler versions deploy "VERSION@100"
```

After rollback, run `npm run production:smoke` immediately.

**Known good baseline (Phase 7C):** Worker `af69004a-952c-4561-8a57-84eed8ea7e20`, Git `a5145ff`.

## What monitoring does NOT change

Monitoring scripts are read-only HTTP clients. They do not modify RWF, redirects, DNS, HSTS, content, or Cloudflare rules.

## Asset manifest baselines

After `npm run build`, `npm run asset:manifest` records:

| Field | Baseline (clean build) |
|-------|----------------------|
| `fileCount` | **1188** physical files on disk |
| `sitemapUrlCount` | **1095** |
| `indexNowUrlCount` | **1095** |

`npx wrangler deploy --dry-run` reports **1498** files read from the same `dist-assets/` directory. That is Cloudflare’s asset bundler index (redirect-derived keys), not the raw filesystem count. The earlier **1188** observation was a stale/partial tree before a full rebuild — not a production regression.

Monitor both metrics for sudden deltas; do not expect them to be equal.

## External uptime

Configure a provider-neutral external monitor separately (not in this repository) for at minimum:

- `https://www.11tik.com/`
- `https://www.11tik.com/robots.txt`
- `https://www.11tik.com/sitemap.xml`
- `https://www.11tik.com/p/about.html`
- `https://fr.11tik.com/l/fr/p/about.html`
