# Architecture

```text
                 11tik.com
                      │
                      ▼
                   Blogger
                Main website
                      │
             ┌────────┴────────┐
             │                 │
        SEO / Content      Tool page
             │                 │
             └────────┬────────┘
                      ▼
               GitHub repository
                      │
                      ▼
                 GitHub Pages
                      │
                      ▼
              Static web application
                      │
                      ▼
             Browser-side processing
```

## Layers

| Layer | Role |
| --- | --- |
| Blogger + `11tik.com` | Public site, SEO, articles, navigation, legal pages, branded shell |
| GitHub | Source of truth for application code, tests, CI, documentation |
| GitHub Pages | Static hosting for the built app |
| Browser | URL parsing, thumbnail discovery, validation, ranking, download, history |

## Why static-first

YouTube thumbnail files are public image URLs. The browser can:

1. Parse the video ID
2. Probe `i.ytimg.com` candidates
3. Measure decoded width/height
4. Rank survivors
5. Download via `fetch` + blob, or open the original

No backend is required for the core product.

## Source layout

- `src/parsers` URL detection and normalization
- `src/engines` candidate generation and extraction orchestration
- `src/validators` image decode and placeholder detection
- `src/ranking` scoring
- `src/services` download and clipboard
- `src/history` local history
- `src/analytics` pluggable events (no URL collection by default)
- `src/embed` iframe height messages
- `src/config.ts` site and app URLs

## Custom domain

`11tik.com` stays on Blogger DNS. Do not point the root domain at GitHub Pages while Blogger owns the site. The app is embedded from GitHub Pages into a Blogger page.
