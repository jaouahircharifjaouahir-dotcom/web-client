# Build-time translation provider

Translation runs **only at build time** via `scripts/i18n/` + `translator/` (Chrome GTX).
Never from the browser, Worker visitor path, or Blogger theme.

## Active provider: `chrome_gtx`

Uses the **Google Translate Chrome extension** engine in `translator/extension/`.

```bash
TRANSLATE_ENABLED=1
TRANSLATION_PROVIDER=chrome_gtx
TRANSLATE_CONCURRENCY=4
TRANSLATE_GTX_CONCURRENCY=8
TRANSLATE_RATE_LIMIT_MS=80
```

## Target languages

Single source of truth:

`config/target-languages.json`

Only **global major languages** listed there are translated / published / sitemapped.
The full ISO 639-1 table in `workers/iso6391.js` remains for host DNS compatibility but is **not** the translation workload.

## Commands

```bash
npm run i18n:inspect
npm run i18n:pilot          # 1 article × all TARGET_LANGUAGES
npm run i18n:archive-extra  # archive out-of-target artifacts
npm run i18n:rollout        # mass TARGET_LANGUAGES only (after approval)
```

## Removed from active path

- Google Cloud Translation API
- local NLLB
- Marian / OPUS-MT fallbacks
- LibreTranslate / Argos
- 182-locale mass strategy

Legacy assessment scripts may remain under `scripts/i18n/` as archived reference but are not npm-wired.
