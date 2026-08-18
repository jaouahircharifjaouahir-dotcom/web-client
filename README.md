# YouTube Thumbnail Extractor

Browser-only tool: paste a YouTube URL, identify the video, validate public thumbnails, then download or copy them.

Public website: [https://11tik.com](https://11tik.com)  
Tool page (Blogger): `https://11tik.com/p/youtube-thumbnail-extractor.html`  
Application host (GitHub Pages): `https://jaouahircharifjaouahir-dotcom.github.io/youtube-thumbnail-extractor/`

## Architecture

```text
11tik.com (Blogger custom domain)
  SEO, articles, navigation, legal pages
        │
        └── embeds the static app
                │
GitHub repository (source of truth)
                │
GitHub Pages (static files)
                │
User browser (parse, validate, rank, download)
```

There is no application server, database, or paid API.

## Local development

```bash
npm install
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
npm run preview
```

## Configuration

Build-time variables, all optional:

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_BASE` | Vite public base path | `/` |
| `NODE_ENV` | Standard Node environment | set by npm scripts |

Site URLs live in `src/config.ts`:

- `PUBLIC_SITE_URL` → `https://11tik.com`
- static app URL → GitHub Pages
- Blogger page path → `/p/youtube-thumbnail-extractor.html`

## GitHub Pages

CI sets `VITE_BASE=/youtube-thumbnail-extractor/` and deploys `dist/` to GitHub Pages.

## Blogger

See [docs/blogger-integration.md](docs/blogger-integration.md).

## Limits

The tool only fetches publicly available thumbnail images from YouTube image hosts. It does not download video or audio, and it does not bypass private or restricted content.
