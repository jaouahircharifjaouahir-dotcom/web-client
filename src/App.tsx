import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { analytics } from "./analytics";
import { ThumbnailPreview } from "./components/ThumbnailPreview";
import { config, isEmbedMode } from "./config";
import { startEmbedResize } from "./embed/resize";
import { extractThumbnails } from "./engines/extract";
import { historyStore } from "./history/store";
import { readTheme, resolvedTheme, saveTheme, type ThemeMode } from "./hooks/theme";
import { isLikelyYouTubeUrl, normalizeYouTubeUrl, parseMany } from "./parsers/youtubeUrl";
import { copyText } from "./services/clipboard";
import { downloadManager, openFullImage } from "./services/download";
import { userMessage } from "./types/errors";
import type { HistoryEntry, ThumbnailExtractionResult } from "./types";

function formatSize(width: number | null, height: number | null): string {
  if (!width || !height) return "Unknown size";
  return `${width} × ${height}`;
}

export default function App() {
  const embed = isEmbedMode();
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme());
  const [input, setInput] = useState("");
  const [bulk, setBulk] = useState(false);
  const [power, setPower] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ThumbnailExtractionResult | null>(null);
  const [bulkResults, setBulkResults] = useState<ThumbnailExtractionResult[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => historyStore.list());
  const abortRef = useRef<AbortController | null>(null);
  const parsed = useMemo(() => (input.trim() ? normalizeYouTubeUrl(input) : null), [input]);

  useEffect(() => {
    const mode = resolvedTheme(theme);
    document.documentElement.dataset.yteTheme = mode;
    document.getElementById("yte-root")?.setAttribute("data-yte-theme", mode);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => startEmbedResize(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPower((value) => !value);
        analytics.track("power_mode_opened");
      }
      if (event.key === "Escape") setPower(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const remember = (entry: ThumbnailExtractionResult) => {
    setHistory(
      historyStore.save({
        videoId: entry.videoId,
        normalizedUrl: entry.normalizedUrl,
        timestamp: Date.now(),
        bestThumbnailUrl: entry.bestThumbnail?.url ?? null,
        bestWidth: entry.bestThumbnail?.width ?? null,
        bestHeight: entry.bestThumbnail?.height ?? null,
      }),
    );
  };

  const runOne = async (raw: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const parsedUrl = normalizeYouTubeUrl(raw);
    if (!parsedUrl.valid) {
      setError(userMessage(parsedUrl.errorCode ?? "INVALID_URL"));
      analytics.track("extraction_failure");
      return;
    }
    setBusy(true);
    setError("");
    analytics.track("extraction_started");
    try {
      const extracted = await extractThumbnails(parsedUrl, controller.signal, (next) => {
        startTransition(() => setResult(next));
      });
      if (!extracted.bestThumbnail) {
        setError(userMessage("THUMBNAIL_NOT_FOUND"));
        analytics.track("extraction_failure");
        return;
      }
      remember(extracted);
      analytics.track("extraction_success");
    } catch {
      if (!controller.signal.aborted) {
        setError(userMessage("NETWORK_ERROR"));
        analytics.track("extraction_failure");
      }
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async () => {
    const items = parseMany(input).filter((item) => item.valid);
    if (!items.length) {
      setError(userMessage("INVALID_URL"));
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setBulkResults([]);
    setError("");
    analytics.track("bulk_mode_used");
    const next: ThumbnailExtractionResult[] = [];
    for (const item of items.slice(0, config.maxBulkUrls)) {
      if (controller.signal.aborted) break;
      try {
        const extracted = await extractThumbnails(item, controller.signal);
        if (extracted.bestThumbnail) {
          next.push(extracted);
          setBulkResults([...next]);
          remember(extracted);
        }
      } catch {
        continue;
      }
    }
    setBusy(false);
    if (next[0]) setResult(next[0]);
  };

  const hint = !input.trim()
    ? "Paste a YouTube video, Shorts, live, or youtu.be URL."
    : parsed?.valid
      ? "Valid YouTube URL ✓"
      : "This doesn't look like a valid YouTube video URL.";

  const showCopied = async (label: string, value: string) => {
    const ok = await copyText(value);
    setCopied(ok ? label : "");
    if (ok) analytics.track("copy_clicked");
    window.setTimeout(() => setCopied(""), 1400);
  };

  return (
    <div className={`yte-app${embed ? " yte-embed" : ""}`}>
      <div className="yte-shell">
        <header className="yte-top">
          <div className="yte-brand">
            <span className="yte-mark" aria-hidden="true">11</span>
            <span>{config.siteName}</span>
          </div>
          <div className="yte-actions">
            <button className="yte-chip" type="button" aria-pressed={bulk} onClick={() => setBulk((v) => !v)}>
              Bulk
            </button>
            <button className="yte-chip" type="button" onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}>
              Theme: {theme}
            </button>
          </div>
        </header>

        <section className="yte-hero">
          <h1>YouTube Thumbnail Extractor</h1>
          <p>Paste a YouTube URL. The best public thumbnail is identified, validated, and ready to download in the browser.</p>
        </section>

        <section className="yte-panel">
          <form
            className="yte-form"
            onSubmit={(event) => {
              event.preventDefault();
              void (bulk ? runBulk() : runOne(input));
            }}
          >
            {bulk ? (
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Paste one YouTube URL per line"
                aria-label="YouTube URLs"
              />
            ) : (
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={(event) => {
                  const text = event.clipboardData.getData("text").trim();
                  if (!isLikelyYouTubeUrl(text)) return;
                  event.preventDefault();
                  setInput(text);
                  void runOne(text);
                }}
                placeholder="Paste your YouTube video URL"
                aria-label="YouTube URL"
                autoComplete="off"
                inputMode="url"
              />
            )}
            <div className="yte-row">
              <button className="yte-btn" type="submit" disabled={busy || !input.trim()}>
                {busy ? "Finding thumbnail…" : bulk ? "Extract all" : "Get Thumbnail"}
              </button>
              {copied ? <span className="yte-hint ok">{copied}</span> : null}
            </div>
            <p className={`yte-hint${parsed?.valid ? " ok" : input.trim() ? " bad" : ""}`}>{error || hint}</p>
            <div className="yte-status" role="status" aria-live="polite">
              {busy ? "Extracting thumbnails" : result?.bestThumbnail ? "Thumbnail ready" : error}
            </div>
          </form>
        </section>

        {result?.bestThumbnail ? (
          <section className="yte-panel yte-best">
            <p className="yte-kicker">BEST AVAILABLE</p>
            <div className="yte-preview">
              <ThumbnailPreview url={result.bestThumbnail.url} label={`Best thumbnail for ${result.videoId}`} />
            </div>
            <div className="yte-meta">
              <span>{formatSize(result.bestThumbnail.width, result.bestThumbnail.height)}</span>
              <span>{result.bestThumbnail.tier.toUpperCase()} · {result.bestThumbnail.quality}</span>
            </div>
            <div className="yte-row">
              <button
                className="yte-btn"
                type="button"
                onClick={() => {
                  analytics.track("download_clicked");
                  void downloadManager.download(result.videoId, result.bestThumbnail!).catch(() => setError(userMessage("DOWNLOAD_FAILED")));
                }}
              >
                Download
              </button>
              <button className="yte-ghost" type="button" onClick={() => void showCopied("Copied!", result.bestThumbnail!.url)}>
                Copy image URL
              </button>
              <button className="yte-ghost" type="button" onClick={() => openFullImage(result.bestThumbnail!.url)}>
                Open full resolution
              </button>
            </div>
          </section>
        ) : null}

        {result && result.thumbnails.length > 1 ? (
          <section className="yte-panel yte-grid">
            <p className="yte-kicker">QUALITY COMPARISON</p>
            <div className="yte-cards">
              {result.thumbnails.map((item) => (
                <article className="yte-card" key={item.url}>
                  <ThumbnailPreview url={item.url} label={`${item.quality} thumbnail`} />
                  <div className="yte-card-body">
                    <strong>{item.tier.toUpperCase()} · {formatSize(item.width, item.height)}</strong>
                    <button
                      className="yte-ghost"
                      type="button"
                      onClick={() => void downloadManager.download(result.videoId, item).catch(() => setError(userMessage("DOWNLOAD_FAILED")))}
                    >
                      Download
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {bulkResults.length > 1 ? (
          <section className="yte-panel">
            <p className="yte-kicker">BULK RESULTS</p>
            <div className="yte-row">
              <button
                className="yte-btn"
                type="button"
                onClick={() =>
                  void downloadManager
                    .downloadBulkZip(bulkResults.map((item) => ({ videoId: item.videoId, candidates: item.bestThumbnail ? [item.bestThumbnail] : [] })))
                    .catch(() => setError(userMessage("DOWNLOAD_FAILED")))
                }
              >
                Download all
              </button>
            </div>
            <div className="yte-cards" style={{ marginTop: 12 }}>
              {bulkResults.map((item) => (
                <article className="yte-card" key={item.videoId}>
                  {item.bestThumbnail ? (
                    <ThumbnailPreview url={item.bestThumbnail.url} label={item.videoId} />
                  ) : null}
                  <div className="yte-card-body">
                    <strong>{item.videoId}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <aside className="yte-ad" aria-label="Advertisement">Ad space</aside>

        {history.length ? (
          <section className="yte-panel yte-history">
            <div className="yte-row" style={{ justifyContent: "space-between" }}>
              <p className="yte-kicker" style={{ margin: 0 }}>LOCAL HISTORY</p>
              <button className="yte-ghost" type="button" onClick={() => setHistory(historyStore.clear())}>
                Clear history
              </button>
            </div>
            <div className="yte-list" style={{ marginTop: 12 }}>
              {history.map((item) => (
                <button
                  className="yte-item"
                  type="button"
                  key={item.videoId}
                  onClick={() => {
                    setInput(item.normalizedUrl);
                    void runOne(item.normalizedUrl);
                  }}
                >
                  {item.normalizedUrl}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {power && result ? (
          <section className="yte-panel yte-power">
            <p className="yte-kicker">POWER MODE</p>
            <div className="yte-row">
              <button className="yte-ghost" type="button" onClick={() => void showCopied("Copied all URLs", result.thumbnails.map((item) => item.url).join("\n"))}>
                Copy all URLs
              </button>
              <button
                className="yte-ghost"
                type="button"
                onClick={() => void downloadManager.downloadAll(result.videoId, result.thumbnails).catch(() => setError(userMessage("DOWNLOAD_FAILED")))}
              >
                Download all variants
              </button>
            </div>
            <pre>
{JSON.stringify(
  {
    videoId: result.videoId,
    normalizedUrl: result.normalizedUrl,
    method: result.extractionMethod,
    cached: result.cached,
    timings: result.timings,
    best: result.bestThumbnail,
    valid: result.thumbnails,
    failed: result.failedCandidates,
  },
  null,
  2,
)}
            </pre>
          </section>
        ) : null}

        <p className="yte-foot">
          Public YouTube thumbnails only. No accounts, no video download, no tracking of pasted URLs.
        </p>
      </div>
    </div>
  );
}
