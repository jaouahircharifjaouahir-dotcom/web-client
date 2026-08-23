# 11tik Browser Extension — YouTube Thumbnail Extractor

Official browser extension for **[11tik](https://www.11tik.com/)**. **YouTube only.**

Normal thumbnail extraction is **100% client-side**. The extension does not call the 11tik backend to discover or download thumbnails. It only links to `www.11tik.com` when you choose **Open in 11tik** or **Copy 11tik link**.

## Architecture

Popup-only MV3 extension. **No background service worker.** **No content scripts.**

```text
YouTube video tab URL (activeTab)
        ↓
popup.js reads tab URL locally
        ↓
shared/youtube.js extracts video ID
        ↓
shared/thumbnails.js probes i.ytimg.com sequentially
        ↓
preview + Download / Copy / Open actions
```

## Minimum permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Read the current tab URL when you click the extension icon |
| `https://i.ytimg.com/*` | Fetch public YouTube thumbnail images during client-side probing |

Removed (not required):

- `scripting` — video ID comes from tab URL only
- `downloads` — download uses blob + `<a download>` in popup
- `clipboardWrite` — clipboard works from popup on user click without extra permission
- YouTube host permissions — tab URL is readable via `activeTab` without them

## Build

```bash
npm run extension:test
npm run extension:build          # chrome + firefox + zips
npm run extension:build:chrome
npm run extension:build:firefox
```

Output:

- `dist-extension/chrome/`
- `dist-extension/firefox/`
- `dist-extension/11tik-chrome.zip`
- `dist-extension/11tik-firefox.zip`

## Manual install

**Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `dist-extension/chrome/`

**Firefox:** `about:debugging` → Load Temporary Add-on → `dist-extension/firefox/manifest.json`

## Parser parity

`shared/youtube.js` mirrors `src/parsers/youtubeUrl.ts`. Vitest parity tests compare both parsers on the same inputs.

## Icons

Run `node scripts/build-extension-icons.mjs` to regenerate `icons/icon-{16,32,48,128}.png` from `assets/icon-128.png`.
