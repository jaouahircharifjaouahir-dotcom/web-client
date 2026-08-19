import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { analytics } from "./analytics";
import { ThumbnailPreview } from "./components/ThumbnailPreview";
import { GUIDE_POSTS } from "./content/posts";
import { DEFAULT_HERO, findKeywordLanding, KEYWORD_LANDINGS, readKeywordSlug } from "./content/keywordLandings";
import { config, isEmbedMode } from "./config";
import { startEmbedResize } from "./embed/resize";
import { extractThumbnails } from "./engines/extract";
import { historyStore } from "./history/store";
import { readTheme, resolvedTheme, saveTheme, type ThemeMode } from "./hooks/theme";
import { isLikelyYouTubeUrl, normalizeYouTubeUrl, parseMany } from "./parsers/youtubeUrl";
import { copyText } from "./services/clipboard";
import { downloadManager, openFullImage } from "./services/download";
import { userMessage } from "./types/errors";
import { QUALITY_PRESETS } from "./engines/presets";
import type { HistoryEntry, ThumbnailCandidate, ThumbnailExtractionResult } from "./types";

const QUALITY_ORDER = QUALITY_PRESETS.map((item) => item.quality);

function formatSize(width: number | null, height: number | null): string {
  if (!width || !height) return "Unknown size";
  return `${width} × ${height}`;
}

function bulkLowerQualityRows(results: ThumbnailExtractionResult[]) {
  const qualities = new Set<string>();
  for (const result of results) {
    const bestUrl = result.bestThumbnail?.url;
    for (const thumb of result.thumbnails) {
      if (thumb.url !== bestUrl) qualities.add(thumb.quality);
    }
  }

  return [...qualities]
    .sort((a, b) => {
      const ia = QUALITY_ORDER.indexOf(a);
      const ib = QUALITY_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map((quality) => ({
      quality,
      items: results.flatMap((result, index) => {
        const bestUrl = result.bestThumbnail?.url;
        const candidate = result.thumbnails.find((thumb) => thumb.quality === quality && thumb.url !== bestUrl);
        return candidate ? [{ videoNumber: index + 1, videoId: result.videoId, candidate }] : [];
      }),
    }))
    .filter((row) => row.items.length);
}

export default function App() {
  const embed = isEmbedMode();
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme());
  const [input, setInput] = useState("");
  const [postsOpen, setPostsOpen] = useState(false);
  const [keywordSlug, setKeywordSlug] = useState(() => readKeywordSlug());
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
  const bulkParsed = useMemo(() => (bulk ? parseMany(input).filter((item) => item.valid) : []), [bulk, input]);

  useEffect(() => {
    const mode = resolvedTheme(theme);
    document.documentElement.dataset.yteTheme = mode;
    document.getElementById("yte-root")?.setAttribute("data-yte-theme", mode);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.body.dataset.ytePosts = postsOpen ? "1" : "";
    document.getElementById("yte-root")?.toggleAttribute("data-yte-posts", postsOpen);
    return () => {
      delete document.body.dataset.ytePosts;
      document.getElementById("yte-root")?.removeAttribute("data-yte-posts");
    };
  }, [postsOpen]);

  useEffect(() => startEmbedResize(), []);

  useEffect(() => {
    const sync = () => setKeywordSlug(readKeywordSlug());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const landing = findKeywordLanding(keywordSlug);
  const heroTitle = landing?.title ?? DEFAULT_HERO.title;
  const heroIntro = landing?.intro ?? DEFAULT_HERO.intro;

  const openKeyword = (slug: string) => {
    const url = new URL(location.href);
    url.searchParams.set("k", slug);
    url.searchParams.delete("m");
    history.pushState({ k: slug }, "", `${url.pathname}${url.search}${url.hash}`);
    setKeywordSlug(slug);
    setPostsOpen(false);
  };

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
    ? bulk
      ? "Paste one YouTube URL or video ID per line."
      : "Paste a YouTube video, Shorts, live, or youtu.be URL."
    : bulk
      ? bulkParsed.length
        ? `${bulkParsed.length} valid video ID${bulkParsed.length === 1 ? "" : "s"} ✓`
        : "No YouTube video IDs found yet."
      : parsed?.valid
        ? "Valid video ID ✓"
        : "No YouTube video ID found in that text.";

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
          <a className="yte-brand" href="https://www.11tik.com/">
            <span className="yte-mark" aria-hidden="true">11</span>
            <span>{config.siteName}</span>
          </a>
          <div className="yte-actions">
            <button className="yte-chip" type="button" aria-expanded={postsOpen} aria-pressed={postsOpen} onClick={() => setPostsOpen((v) => !v)}>
              Posts
            </button>
            <button className="yte-chip" type="button" aria-pressed={bulk} onClick={() => setBulk((v) => !v)}>
              Bulk
            </button>
            <button className="yte-chip" type="button" onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}>
              Theme: {theme}
            </button>
          </div>
        </header>

        {postsOpen ? (
          <section className="yte-panel yte-posts" aria-label="Guides">
            <p className="yte-kicker">POSTS</p>
            <div className="yte-post-list">
              {GUIDE_POSTS.map((post) => (
                <article className="yte-post" key={post.href}>
                  <a className="yte-post-title" href={post.href}>
                    {post.title}
                  </a>
                  <p>{post.summary}</p>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <>
        <section className="yte-hero">
          <h1>{heroTitle}</h1>
          <p>{heroIntro}</p>
          <nav aria-label="Keyword links" className="yte-kw">
            {KEYWORD_LANDINGS.map((item) => (
              <a
                className={item.slug === keywordSlug ? "is-on" : undefined}
                href={`/?k=${item.slug}`}
                key={item.slug}
                onClick={(event) => {
                  event.preventDefault();
                  openKeyword(item.slug);
                }}
              >
                {item.keyword}
              </a>
            ))}
          </nav>
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
                onChange={(event) => {
                  setError("");
                  setInput(event.target.value);
                }}
                placeholder="Paste one YouTube URL per line"
                aria-label="YouTube URLs"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />
            ) : (
              <input
                value={input}
                onChange={(event) => {
                  setError("");
                  setInput(event.target.value);
                }}
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
                spellCheck={false}
              />
            )}
            <div className="yte-row">
              <button className="yte-btn" type="submit" disabled={busy || !input.trim()}>
                {busy ? "Finding thumbnail…" : bulk ? "Extract all" : "Get Thumbnail Image"}
              </button>
              {copied ? <span className="yte-hint ok">{copied}</span> : null}
            </div>
            <p className={`yte-hint${(bulk ? bulkParsed.length > 0 : parsed?.valid) ? " ok" : input.trim() ? " bad" : ""}`}>{error || hint}</p>
            <div className="yte-status" role="status" aria-live="polite">
              {busy ? "Extracting thumbnails" : result?.bestThumbnail ? "Thumbnail ready" : error}
            </div>
          </form>
        </section>

        {!bulk && result?.thumbnails.length ? (
          <section className="yte-panel yte-stack-wrap">
            <p className="yte-kicker">THUMBNAILS</p>
            <div className="yte-stack">
              {result.thumbnails.map((item, index) => (
                <article className="yte-shot" key={item.url}>
                  <div
                    className="yte-preview"
                    style={item.width && item.height ? { aspectRatio: `${item.width} / ${item.height}` } : undefined}
                  >
                    <ThumbnailPreview url={item.url} label={`${item.quality} thumbnail`} />
                  </div>
                  <div className="yte-meta">
                    <span>{formatSize(item.width, item.height)}</span>
                    <span>
                      {index === 0 ? "BEST · " : ""}
                      {item.tier.toUpperCase()} · {item.quality}
                    </span>
                  </div>
                  <div className="yte-row">
                    <button
                      className="yte-btn"
                      type="button"
                      onClick={() => {
                        analytics.track("download_clicked");
                        void downloadManager.download(result.videoId, item).catch(() => setError(userMessage("DOWNLOAD_FAILED")));
                      }}
                    >
                      Download
                    </button>
                    <button className="yte-ghost" type="button" onClick={() => void showCopied("Copied!", item.url)}>
                      Copy image URL
                    </button>
                    <button className="yte-ghost" type="button" onClick={() => openFullImage(item.url)}>
                      Open full resolution
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {bulk && bulkResults.length ? (
          <section className="yte-panel">
            <p className="yte-kicker">HIGHEST QUALITY</p>
            <div className="yte-stack">
              {bulkResults.map((item, index) => (
                <article className="yte-shot" key={item.videoId}>
                  {item.bestThumbnail ? (
                    <div
                      className="yte-preview"
                      style={
                        item.bestThumbnail.width && item.bestThumbnail.height
                          ? { aspectRatio: `${item.bestThumbnail.width} / ${item.bestThumbnail.height}` }
                          : undefined
                      }
                    >
                      <ThumbnailPreview url={item.bestThumbnail.url} label={`Video ${index + 1} best thumbnail`} />
                    </div>
                  ) : null}
                  <div className="yte-meta">
                    <span>Video {index + 1}</span>
                    <span>
                      {formatSize(item.bestThumbnail?.width ?? null, item.bestThumbnail?.height ?? null)} ·{" "}
                      {item.bestThumbnail?.quality ?? "best"}
                    </span>
                  </div>
                  {item.bestThumbnail ? (
                    <div className="yte-row">
                      <button
                        className="yte-btn"
                        type="button"
                        onClick={() => {
                          analytics.track("download_clicked");
                          void downloadManager
                            .download(item.videoId, item.bestThumbnail as ThumbnailCandidate)
                            .catch(() => setError(userMessage("DOWNLOAD_FAILED")));
                        }}
                      >
                        Download thumbnail video {index + 1} {item.bestThumbnail.quality}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="yte-row" style={{ marginTop: 16 }}>
              <button
                className="yte-btn"
                type="button"
                onClick={() =>
                  void downloadManager
                    .downloadBulkZip(
                      bulkResults.map((item) => ({
                        videoId: item.videoId,
                        candidates: item.bestThumbnail ? [item.bestThumbnail] : [],
                      })),
                    )
                    .catch(() => setError(userMessage("DOWNLOAD_FAILED")))
                }
              >
                Download all highest quality
              </button>
            </div>
            {bulkLowerQualityRows(bulkResults).map((row) => (
              <div className="yte-bulk-quality" key={row.quality}>
                <p className="yte-kicker">{row.quality.toUpperCase()}</p>
                <div className="yte-bulk-dl">
                  {row.items.map((item) => (
                    <button
                      className="yte-ghost"
                      type="button"
                      key={`${item.videoId}-${row.quality}`}
                      onClick={() => {
                        analytics.track("download_clicked");
                        void downloadManager
                          .download(item.videoId, item.candidate)
                          .catch(() => setError(userMessage("DOWNLOAD_FAILED")));
                      }}
                    >
                      Download thumbnail video {item.videoNumber} {row.quality}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
          </>
        )}
      </div>
    </div>
  );
}
