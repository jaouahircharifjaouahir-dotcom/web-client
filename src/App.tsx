import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { analytics } from "./analytics";
import { ThumbnailPreview } from "./components/ThumbnailPreview";
import { GUIDE_POSTS } from "./content/posts";
import { relatedGuides } from "./content/related";
import { DEFAULT_HERO, findKeywordLanding, KEYWORD_LANDINGS, readKeywordSlug } from "./content/keywordLandings";
import { config, isEmbedMode } from "./config";
import { startEmbedResize } from "./embed/resize";
import { extractThumbnails } from "./engines/extract";
import { bulkResultsCsv, downloadCsv } from "./export/csv";
import { historyStore } from "./history/store";
import { readTheme, resolvedTheme, saveTheme, type ThemeMode } from "./hooks/theme";
import { isLikelyMediaUrl, normalizeMediaUrl, parseMediaMany, readDeepLink } from "./parsers/mediaUrl";
import { scorePublicThumbnail } from "./score/readImage";
import { copyText } from "./services/clipboard";
import { downloadManager, openFullImage } from "./services/download";
import { shareUrlFor, shareUrlForIds } from "./share/url";
import { submitShareToSitemap, submitVideoToSitemap } from "./sitemap/submit";
import { userMessage } from "./types/errors";
import { QUALITY_PRESETS } from "./engines/presets";
import type { HistoryEntry, ThumbnailCandidate, ThumbnailExtractionResult } from "./types";

const QUALITY_ORDER = QUALITY_PRESETS.map((item) => item.quality);

function formatSize(width: number | null, height: number | null): string {
  if (!width || !height) return "Unknown size";
  return `${width} × ${height}`;
}

function ShareUrlLine({ url }: { url: string }) {
  return (
    <p
      className="yte-shareline"
      style={{
        margin: "12px 0 0",
        padding: "12px 14px",
        border: "2px solid #0f766e",
        borderRadius: "14px",
        background: "rgba(15, 118, 110, 0.12)",
        wordBreak: "break-all",
      }}
    >
      <span style={{ display: "block", fontWeight: 800, marginBottom: 6, fontSize: 12, letterSpacing: "0.08em" }}>SHARE LINK</span>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#0f766e", fontWeight: 800, fontSize: "1rem" }}>
        {url}
      </a>
    </p>
  );
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
  const [thumbScore, setThumbScore] = useState<{ score: number; notes: string[] } | null>(null);
  const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>(() => historyStore.list());
  const abortRef = useRef<AbortController | null>(null);
  const syncedShareKey = useRef("");
  const parsed = useMemo(() => (input.trim() ? normalizeMediaUrl(input) : null), [input]);
  const bulkParsed = useMemo(() => (bulk ? parseMediaMany(input).filter((item) => item.valid) : []), [bulk, input]);
  const liveShareUrls = useMemo(() => {
    if (bulk) return bulkParsed.map((item) => shareUrlForIds(item.platform, item.videoId));
    if (parsed?.valid && parsed.videoId) return [shareUrlForIds(parsed.platform, parsed.videoId)];
    return [];
  }, [bulk, bulkParsed, parsed]);
  const deepLinkBoot = useRef(false);

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
    url.searchParams.delete("v");
    url.searchParams.delete("vimeo");
    history.pushState({ k: slug }, "", `${url.pathname}${url.search}${url.hash}`);
    setKeywordSlug(slug);
    setPostsOpen(false);
    analytics.pageView();
  };

  const syncShareUrl = (platform: "youtube" | "vimeo", videoId: string) => {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("k");
      url.searchParams.delete("m");
      if (platform === "vimeo") {
        url.searchParams.delete("v");
        url.searchParams.set("vimeo", videoId);
      } else {
        url.searchParams.delete("vimeo");
        url.searchParams.set("v", videoId);
      }
      history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      setKeywordSlug(null);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (bulk) {
      for (const item of bulkParsed) submitVideoToSitemap(item.platform, item.videoId);
      return;
    }
    if (!parsed?.valid || !parsed.videoId) return;
    submitVideoToSitemap(parsed.platform, parsed.videoId);
    const key = `${parsed.platform}:${parsed.videoId}`;
    if (embed || syncedShareKey.current === key) return;
    syncedShareKey.current = key;
    syncShareUrl(parsed.platform, parsed.videoId);
  }, [bulk, bulkParsed, parsed, embed]);

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
    setRecentHistory(
      historyStore.save({
        videoId: entry.videoId,
        normalizedUrl: entry.normalizedUrl,
        timestamp: Date.now(),
        bestThumbnailUrl: entry.bestThumbnail?.url ?? null,
        bestWidth: entry.bestThumbnail?.width ?? null,
        bestHeight: entry.bestThumbnail?.height ?? null,
        title: entry.meta?.title ?? null,
      }),
    );
    submitShareToSitemap(entry);
  };

  const runOne = async (raw: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const parsedUrl = normalizeMediaUrl(raw);
    if (!parsedUrl.valid) {
      setError(userMessage(parsedUrl.errorCode ?? "INVALID_URL"));
      analytics.track("extraction_failure");
      return;
    }
    setBusy(true);
    setError("");
    submitVideoToSitemap(parsedUrl.platform, parsedUrl.videoId);
    if (!embed) {
      syncedShareKey.current = `${parsedUrl.platform}:${parsedUrl.videoId}`;
      syncShareUrl(parsedUrl.platform, parsedUrl.videoId);
    }
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
      setResult(extracted);
      remember(extracted);
      syncShareUrl(extracted.meta?.platform ?? parsedUrl.platform, extracted.videoId);
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

  useEffect(() => {
    if (deepLinkBoot.current || embed) return;
    const deep = readDeepLink();
    if (!deep) return;
    deepLinkBoot.current = true;
    const raw = deep.platform === "vimeo" ? `https://vimeo.com/${deep.videoId}` : `https://www.youtube.com/watch?v=${deep.videoId}`;
    setInput(raw);
    void runOne(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once from deep link
  }, [embed]);

  const runBulk = async () => {
    const items = parseMediaMany(input).filter((item) => item.valid);
    if (!items.length) {
      setError(userMessage("INVALID_URL"));
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setBulkResults([]);
    setResult(null);
    setError("");
    for (const item of items.slice(0, config.maxBulkUrls)) {
      submitVideoToSitemap(item.platform, item.videoId);
    }
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
  };

  useEffect(() => {
    if (!result?.bestThumbnail) {
      setThumbScore(null);
      return;
    }
    let cancelled = false;
    void scorePublicThumbnail(result.bestThumbnail.url, result.bestThumbnail.width, result.bestThumbnail.height).then((next) => {
      if (!cancelled) setThumbScore(next);
    });
    return () => {
      cancelled = true;
    };
  }, [result]);

  useEffect(() => {
    const existing = document.getElementById("yte-video-jsonld");
    existing?.remove();
    if (!result?.bestThumbnail || !result.meta?.title) return;
    const script = document.createElement("script");
    script.id = "yte-video-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: result.meta.title,
      thumbnailUrl: result.bestThumbnail.url,
      url: shareUrlFor(result),
      embedUrl: result.normalizedUrl,
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [result]);

  const hint = !input.trim()
    ? bulk
      ? "Paste one YouTube or Vimeo URL per line."
      : "Paste a YouTube or Vimeo URL (Shorts, live, youtu.be, and vimeo.com)."
    : bulk
      ? bulkParsed.length
        ? `${bulkParsed.length} valid video ID${bulkParsed.length === 1 ? "" : "s"} ✓`
        : "No video IDs found yet."
      : parsed?.valid
        ? `Valid ${parsed.platform} ID ✓`
        : "No supported video ID found in that text.";

  const showCopied = async (label: string, value: string) => {
    const ok = await copyText(value);
    setCopied(ok ? label : "");
    if (ok) analytics.track("copy_clicked");
    window.setTimeout(() => setCopied(""), 1400);
  };

  const shareNow = async (urls: string[]) => {
    const first = urls[0];
    if (!first) return;
    try {
      if (urls.length === 1 && navigator.share) {
        await navigator.share({ url: first, title: config.siteName });
        analytics.track("copy_clicked");
        return;
      }
    } catch {
      /* fall through to copy */
    }
    await showCopied(urls.length > 1 ? "Share links copied" : "Share link copied", urls.join("\n"));
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
          {result?.bestThumbnail && !bulk ? (
            <p className="yte-video-meta">
              {result.meta?.platform === "vimeo" ? "Vimeo" : "YouTube"}
              {result.meta?.authorName ? ` · ${result.meta.authorName}` : ""}
              {` · ${result.meta?.title || result.videoId}`}
            </p>
          ) : null}
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
    placeholder="Paste one YouTube or Vimeo URL per line"
                aria-label="YouTube or Vimeo URLs"
                onPaste={(event) => {
                  const text = event.clipboardData.getData("text");
                  if (!text.trim()) return;
                  const items = parseMediaMany(text).filter((item) => item.valid);
                  for (const item of items) submitVideoToSitemap(item.platform, item.videoId);
                }}
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
                  if (!isLikelyMediaUrl(text)) return;
                  event.preventDefault();
                  setInput(text);
                  void runOne(text);
                }}
                placeholder="Paste YouTube or Vimeo URL"
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
              {liveShareUrls.length ? (
                <>
                  <button
                    className="yte-ghost"
                    type="button"
                    onClick={() => void showCopied(liveShareUrls.length > 1 ? "Share links copied" : "Share link copied", liveShareUrls.join("\n"))}
                  >
                    Copy share link
                  </button>
                  <button className="yte-ghost" type="button" onClick={() => void shareNow(liveShareUrls)}>
                    Share
                  </button>
                </>
              ) : null}
              {copied ? <span className="yte-hint ok">{copied}</span> : null}
            </div>
            <p className={`yte-hint${(bulk ? bulkParsed.length > 0 : parsed?.valid) ? " ok" : input.trim() ? " bad" : ""}`}>{error || hint}</p>
            {liveShareUrls.length ? liveShareUrls.map((url) => <ShareUrlLine url={url} key={url} />) : null}
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
                    <ThumbnailPreview url={item.url} label={`${item.quality} thumbnail`} priority={index === 0} />
                  </div>
                  <div className="yte-meta">
                    <span>{formatSize(item.width, item.height)}</span>
                    <span>
                      {index === 0 ? "BEST · " : ""}
                      {item.tier.toUpperCase()} · {item.quality}
                    </span>
                  </div>
                  {index === 0 && thumbScore ? <p className="yte-score">Packaging score {thumbScore.score}/100</p> : null}
                  {index === 0 && liveShareUrls[0] ? <ShareUrlLine url={liveShareUrls[0]} /> : null}
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
                  <p className="yte-video-meta">{item.meta?.title || item.videoId}</p>
                  <ShareUrlLine url={shareUrlFor(item)} />
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
              <button
                className="yte-ghost"
                type="button"
                onClick={() => downloadCsv("11tik-bulk-thumbnails.csv", bulkResultsCsv(bulkResults))}
              >
                Export CSV
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

        {recentHistory.length ? (
          <section className="yte-panel yte-history">
            <div className="yte-row" style={{ justifyContent: "space-between" }}>
              <p className="yte-kicker" style={{ margin: 0 }}>LOCAL HISTORY</p>
              <button className="yte-ghost" type="button" onClick={() => setRecentHistory(historyStore.clear())}>
                Clear history
              </button>
            </div>
            <div className="yte-list" style={{ marginTop: 12 }}>
              {recentHistory.map((item) => (
                <button
                  className="yte-item"
                  type="button"
                  key={item.videoId}
                  onClick={() => {
                    setInput(item.normalizedUrl);
                    void runOne(item.normalizedUrl);
                  }}
                >
                  {item.title || item.normalizedUrl}
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
        <nav className="yte-kw" aria-label="Related guides">
          {relatedGuides("").map((post) => (
            <a href={post.href} key={post.href}>
              {post.title}
            </a>
          ))}
        </nav>
          </>
        )}
      </div>
    </div>
  );
}
