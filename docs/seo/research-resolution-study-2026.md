# YouTube Thumbnail Resolution & Availability Study 2026

**Status:** METHODOLOGY ONLY — no published statistics until measurements complete.

## Objective

Produce an original, citable reference on which public thumbnail variants exist for a sample of YouTube video IDs.

## Sample

- Source: curated list of public video IDs ( diverse ages, HD/non-HD, Shorts optional )
- Size: start with 50–200 IDs (pilot), expand after QA
- Exclusion: private/restricted IDs that fail public watch checks

## Variants probed

| File | Notes |
| --- | --- |
| maxresdefault.jpg | Often 1280×720 when present |
| hq720.jpg | HD alternate |
| sddefault.jpg | 640×480 |
| hqdefault.jpg | 480×360 |
| mqdefault.jpg | 320×180 |
| default.jpg | 120×90 |
| maxresdefault.webp | WebP when published |
| hqdefault.webp | WebP fallback |

## Per-observation fields

- videoId, variant, url, status, contentType, bytes, width, height, placeholder flag, elapsedMs

## Placeholder detection

- JPEG 120×90 or response &lt;3KB → likely placeholder (manual review required)

## Outputs (local only until approved)

- `observations.csv`
- `observations.json`
- `methodology.md`
- Future: summary table + chart spec + visual matrix on `size-resolution` guide

## Reproducibility

- Script: `scripts/seo/research-resolution-study.mjs`
- Re-run same ID file; diff JSON hashes
- Document date + sample file checksum

## Do not publish until

- Manual QA on placeholder false positives
- Legal/product review on sample selection
- Explicit content publish phase
