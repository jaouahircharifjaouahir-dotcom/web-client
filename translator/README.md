# Local Google Translate Chrome extension tooling

Isolated **build-time** translation engine for 11tik. Never ships to production.

## Layout

```
translator/
  extension/     # Official Google Translate Chrome extension (unpacked)
  runner/        # CLI: analyze, pilot
  capture/       # GTX HTTP client + payload capture (same API as extension)
  browser/       # Optional Chrome --load-extension helpers
  selectors/     # Extension DOM/API constants
  locale/        # ISO 639-1 → GTX language code map
  fixtures/      # Test HTML snippets
  reports/       # Analysis + pilot JSON reports
```

## How the extension translates

1. **Selection bubble** (`bubble_compiled.js`): selected text → `TranslationAPI` → overlay.
2. **Popup** (`popup.html`): typed text → same API.
3. **Engine**: `client=gtx` → `https://translate-pa.googleapis.com/v1/translate` with the key embedded in the extension (`getApiKey()`).
4. **Page translation**: Chrome built-in / `translate.google.com/translate?u=…` — **not** what we automate for static publishing.

Our runner uses **(3)** — the same text TranslationAPI — plus DOM text-node extraction so URLs/code/href stay intact.

## Commands

```bash
# Analyze extension
node translator/runner/analyze-extension.mjs

# Pilot: 3 articles × fr,es,de,ar
npm run i18n:pilot

# Full pipeline (after pilot succeeds) — uses chrome_gtx by default
TRANSLATE_ENABLED=1 TRANSLATION_PROVIDER=chrome_gtx npm run i18n:rollout
```

## Provider

```bash
TRANSLATION_PROVIDER=chrome_gtx   # default
TRANSLATE_ENABLED=1
TRANSLATE_RATE_LIMIT_MS=300
```

No GCP project or OpenAI key required. The extension must exist under `translator/extension/`.

## Production isolation

- `translator/` is local tooling only.
- Must never appear in `dist-assets`, Blogger theme, or Worker.
- Tests assert no GTX / extension leakage into staged builds.
