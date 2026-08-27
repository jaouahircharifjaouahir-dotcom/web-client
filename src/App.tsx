import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { analytics } from "./analytics";
import { ThumbnailPreview } from "./components/ThumbnailPreview";
import { findKeywordLanding, KEYWORD_LANDINGS, readKeywordSlug } from "./content/keywordLandings";
import { config, isEmbedMode } from "./config";
import { startEmbedResize } from "./embed/resize";
import { extractThumbnails } from "./engines/extract";
import { expandChannelVideos, looksLikeChannelUrl } from "./channels/feed";
import { bulkResultsCsv, downloadCsv } from "./export/csv";
import { bulkResultsJson, downloadText } from "./export/json";
import { tx } from "./i18n/extra";
import { legalHrefs, pageString } from "./i18n/pages";
import { SitePages, ThumbArticle } from "./pages/SitePages";
import { parseAppRoute } from "./routing/path";
import { calculateConsistencyScore } from "./score/consistency";
import { buildShareUrls } from "./share/social";
import { imageSeoAttrs, stampSeoImages } from "./seo/imageAttrs";
import { tagsForResult } from "./tags/fromExtract";
import { historyStore } from "./history/store";
import { readTheme, resolvedTheme, saveTheme, type ThemeMode } from "./hooks/theme";
import { isLikelyMediaUrl, mediaSharePath, normalizeMediaUrl, parseMediaMany, readDeepLink } from "./parsers/mediaUrl";
import { scorePublicThumbnail } from "./score/readImage";
import { copyText } from "./services/clipboard";
import { downloadManager, openFullImage } from "./services/download";
import { shareUrlFor, shareUrlForIds } from "./share/url";
import { QUALITY_PRESETS } from "./engines/presets";
import { SiteHeader } from "./components/SiteHeader";
import { hasStaticSiteHeader } from "./components/hasStaticSiteHeader";
import { guidePosts, localeHomeUrl, publicOrigin, readLocale, t, tFill } from "./i18n/ui";
import { isRtl } from "./i18n/ui";
import { useLocaleCatalog } from "./i18n/useLocaleCatalog";
import { usePublishabilityDoc } from "./i18n/usePublishabilityDoc";
import { readHomeView, withHomeView, type HomeView } from "./routing/homeView";
import { userMessage } from "./types/errors";
import type { HistoryEntry, ThumbnailCandidate, ThumbnailExtractionResult } from "./types";

const QUALITY_ORDER = QUALITY_PRESETS.map((item) => item.quality);

function formatSize(width: number | null, height: number | null): string {
  if (!width || !height) return t("unknownSize");
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
      <span style={{ display: "block", fontWeight: 800, marginBottom: 6, fontSize: 12, letterSpacing: "0.08em" }}>{t("shareLink")}</span>
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
  const [homeView, setHomeView] = useState<HomeView>(() => readHomeView());
  const postsOpen = homeView === "posts";
  const bulk = homeView === "bulk";
  const [keywordSlug, setKeywordSlug] = useState(() => readKeywordSlug());
  const [staticHeader] = useState(() => hasStaticSiteHeader());
  const [power, setPower] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ThumbnailExtractionResult | null>(null);
  const [bulkResults, setBulkResults] = useState<ThumbnailExtractionResult[]>([]);
  const [thumbScore, setThumbScore] = useState<{ score: number; notes: string[] } | null>(null);
  const [brandScore, setBrandScore] = useState<number | null>(null);
  const [compareOn, setCompareOn] = useState(false);
  const [route, setRoute] = useState(() => parseAppRoute());
  const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>(() => historyStore.list());
  const abortRef = useRef<AbortController | null>(null);
  const syncedShareKey = useRef("");
  const bestThumbControlsRef = useRef<HTMLDivElement | null>(null);
  const scrolledToBestKeyRef = useRef("");
  const parsed = useMemo(() => (input.trim() ? normalizeMediaUrl(input) : null), [input]);
  const bulkParsed = useMemo(() => (bulk ? parseMediaMany(input).filter((item) => item.valid) : []), [bulk, input]);
  const liveShareUrls = useMemo(() => {
    if (bulk) return bulkParsed.flatMap((item) => (item.videoId ? [shareUrlForIds(item.platform, item.videoId, publicOrigin())] : []));
    if (parsed?.valid && parsed.videoId) return [shareUrlForIds(parsed.platform, parsed.videoId, publicOrigin())];
    return [];
  }, [bulk, bulkParsed, parsed]);
  const deepLinkBoot = useRef(false);
  const publishability = usePublishabilityDoc();
  const localeCatalog = useLocaleCatalog(readLocale());
  const localizedGuides = localeCatalog.posts.length
    ? localeCatalog.posts
    : guidePosts({ doc: publishability });

  const navigateHomeView = (view: HomeView, historyMode: "push" | "replace" = "push") => {
    if (typeof window === "undefined") {
      setHomeView(view);
      return;
    }
    const next = new URL(withHomeView(window.location.href, view));
    if (view === "posts" || view === "bulk") {
      next.searchParams.delete("k");
      next.searchParams.delete("v");
      next.searchParams.delete("m");
    }
    const href = `${next.pathname}${next.search}${next.hash}`;
    if (historyMode === "push") window.history.pushState({ homeView: view }, "", href);
    else window.history.replaceState({ homeView: view }, "", href);
    setHomeView(view);
    if (view === "posts" || view === "bulk") setKeywordSlug(null);
  };

  useEffect(() => {
    const mode = resolvedTheme(theme);
    document.documentElement.dataset.yteTheme = mode;
    document.documentElement.lang = readLocale();
    document.documentElement.dir = isRtl() ? "rtl" : "ltr";
    document.getElementById("yte-root")?.setAttribute("data-yte-theme", mode);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    window.__yteAppReady = true;
    const applyView = (view: HomeView) => {
      if (view !== "posts" && view !== "bulk" && view !== "home") return;
      navigateHomeView(view);
    };
    window.__yteNavigateView = applyView;
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<{ view?: HomeView }>).detail;
      const view = detail?.view;
      if (view === "posts" || view === "bulk" || view === "home") applyView(view);
    };
    const onTheme = () => setTheme(readTheme());
    window.addEventListener("yte:navigate-view", onNavigate);
    window.addEventListener("yte:theme-change", onTheme);
    return () => {
      delete window.__yteNavigateView;
      window.removeEventListener("yte:navigate-view", onNavigate);
      window.removeEventListener("yte:theme-change", onTheme);
    };
  }, []);

  useEffect(() => {
    if (!staticHeader) return;
    const postsBtn = document.getElementById("yte-posts-btn");
    const bulkBtn = document.getElementById("yte-bulk-btn");
    postsBtn?.setAttribute("aria-pressed", postsOpen ? "true" : "false");
    if (postsOpen) postsBtn?.setAttribute("aria-current", "page");
    else postsBtn?.removeAttribute("aria-current");
    bulkBtn?.setAttribute("aria-pressed", bulk ? "true" : "false");
    if (bulk) bulkBtn?.setAttribute("aria-current", "page");
    else bulkBtn?.removeAttribute("aria-current");
  }, [staticHeader, postsOpen, bulk]);

  useEffect(() => {
    document.body.dataset.ytePosts = postsOpen ? "1" : "";
    document.getElementById("yte-root")?.toggleAttribute("data-yte-posts", postsOpen);
    return () => {
      delete document.body.dataset.ytePosts;
      document.getElementById("yte-root")?.removeAttribute("data-yte-posts");
    };
  }, [postsOpen]);

  useEffect(() => {
    const sync = () => {
      setRoute(parseAppRoute());
      setHomeView(readHomeView());
      setKeywordSlug(readKeywordSlug());
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => startEmbedResize(), []);

  useEffect(() => {
    if (route.name !== "thumb") {
      scrolledToBestKeyRef.current = "";
      return;
    }
    if (busy || bulk || !result?.thumbnails.length) return;
    const key = `${result.videoId}:${result.thumbnails[0]?.url ?? ""}`;
    if (scrolledToBestKeyRef.current === key) return;
    scrolledToBestKeyRef.current = key;
    requestAnimationFrame(() => {
      bestThumbControlsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [route.name, busy, bulk, result?.videoId, result?.thumbnails]);

  useEffect(() => {
    const timer = window.setTimeout(() => stampSeoImages(), 400);
    return () => window.clearTimeout(timer);
  }, [result, bulkResults, route]);

  useEffect(() => {
    const sync = () => setKeywordSlug(readKeywordSlug());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const landing = readLocale() === "en" ? findKeywordLanding(keywordSlug) : undefined;
  const heroTitle = landing?.title ?? t("heroTitle");
  const heroIntro = landing?.intro ?? t("heroIntro");
  const locale = readLocale();
  const themeLabel = theme === "dark" ? t("themeDark") : theme === "light" ? t("themeLight") : t("themeSystem");

  const openKeyword = (slug: string) => {
    const url = new URL(location.href);
    url.searchParams.set("k", slug);
    url.searchParams.delete("m");
    url.searchParams.delete("v");
    url.searchParams.delete("posts");
    url.searchParams.delete("bulk");
    history.pushState({ k: slug, homeView: "home" }, "", `${url.pathname}${url.search}${url.hash}`);
    setKeywordSlug(slug);
    setHomeView("home");
    analytics.pageView();
  };

  const syncShareUrl = (platform: "youtube", videoId: string) => {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("k");
      url.searchParams.delete("m");
      if (embed) {
        url.searchParams.set("v", videoId);
        history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      } else {
        const next = new URL(`${url.origin}${mediaSharePath(platform, videoId)}`);
        const lang = url.searchParams.get("lang");
        if (lang) next.searchParams.set("lang", lang);
        history.replaceState({}, document.title, `${next.pathname}${next.search}${url.hash}`);
        setRoute(parseAppRoute(next.pathname));
      }
      setKeywordSlug(null);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (bulk) return;
    if (!parsed?.valid || !parsed.videoId) return;
    const key = `${parsed.platform}:${parsed.videoId}`;
    if (embed || syncedShareKey.current === key) return;
    syncedShareKey.current = key;
    syncShareUrl(parsed.platform, parsed.videoId);
  }, [bulk, parsed, embed]);

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
  };

  const runOne = async (raw: string) => {
    if (looksLikeChannelUrl(raw)) {
      navigateHomeView("bulk", "replace");
      await runBulk(raw);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const parsedUrl = normalizeMediaUrl(raw);
    if (!parsedUrl.valid || !parsedUrl.videoId) {
      setError(userMessage(parsedUrl.errorCode ?? "INVALID_URL"));
      analytics.track("extraction_failure");
      return;
    }
    setBusy(true);
    setError("");
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
    const raw = `https://www.youtube.com/watch?v=${deep.videoId}`;
    setInput(raw);
    void runOne(raw);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once from deep link
  }, [embed]);

  const runBulk = async (source = input) => {
    let raw = source;
    if (looksLikeChannelUrl(source)) {
      setBusy(true);
      const urls = await expandChannelVideos(source.trim().split(/[\s\n]+/)[0] || source, 20);
      if (!urls.length) {
        setBusy(false);
        setError(userMessage("CHANNEL_OR_PLAYLIST"));
        return;
      }
      raw = urls.join("\n");
      navigateHomeView("bulk", "replace");
      setInput(raw);
    }
    const items = parseMediaMany(raw).filter((item) => item.valid);
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
    const thumbs = next.map((item) => item.bestThumbnail?.url).filter(Boolean) as string[];
    void calculateConsistencyScore(thumbs).then((row) => setBrandScore(row?.score ?? null));
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
      ? t("pasteBulk")
      : t("pasteOne")
    : bulk
      ? bulkParsed.length
        ? `${bulkParsed.length} ${bulkParsed.length === 1 ? t("idsOk") : t("idsOkPlural")} ✓`
        : t("noIds")
      : parsed?.valid
        ? `${t("validId")} ${parsed.platform} ID ✓`
        : t("noId");

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
    await showCopied(urls.length > 1 ? t("copiedShares") : t("copiedShare"), urls.join("\n"));
  };

  if (route.name !== "home" && route.name !== "thumb") {
    return <SitePages route={route} />;
  }

  return (
    <div className={`yte-app${embed ? " yte-embed" : ""}`}>
      <div className="yte-shell">
        {staticHeader ? null : (
          <SiteHeader
            homeView={homeView}
            theme={theme}
            themeLabel={themeLabel}
            onNavigateView={(view) => navigateHomeView(view)}
            onCycleTheme={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
            locale={locale}
          />
        )}

        {postsOpen ? (
          <section className="yte-panel yte-posts" aria-label={t("kicker")}>
            <p className="yte-kicker">{t("kicker")}</p>
            <div className="yte-post-list">
              {localizedGuides.map((post) => (
                <article className="yte-post" key={String(("contentId" in post && post.contentId) || post.href)}>
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
          {route.name === "thumb" ? (
            <ThumbArticle platform={route.platform} videoId={route.videoId} origin={localeHomeUrl()} />
          ) : (
            <>
              <h1>{heroTitle}</h1>
              <p>{heroIntro}</p>
            </>
          )}
          {result?.bestThumbnail && !bulk ? (
            <p className="yte-video-meta">
              YouTube
              {result.meta?.authorName ? ` · ${result.meta.authorName}` : ""}
              {` · ${result.meta?.title || result.videoId}`}
            </p>
          ) : null}
          <nav aria-label={t("ariaKeywordLinks")} className="yte-kw">
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
                placeholder={t("pasteBulkPh") + " · " + tx(locale, "channelHint")}
                aria-label={t("ariaYoutubeUrls")}
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
                placeholder={t("pasteOnePh")}
                aria-label={t("ariaYoutubeUrl")}
                autoComplete="off"
                inputMode="url"
                spellCheck={false}
              />
            )}
            <div className="yte-row">
              <button className="yte-btn" type="submit" disabled={busy || !input.trim()}>
                {busy ? t("finding") : bulk ? t("extractAll") : t("getThumb")}
              </button>
              {liveShareUrls.length ? (
                <>
                  <button
                    className="yte-ghost"
                    type="button"
                    onClick={() => void showCopied(liveShareUrls.length > 1 ? t("copiedShares") : t("copiedShare"), liveShareUrls.join("\n"))}
                  >
                    {t("copyShare")}
                  </button>
                  <button className="yte-ghost" type="button" onClick={() => void shareNow(liveShareUrls)}>
                    {t("share")}
                  </button>
                </>
              ) : null}
              {copied ? <span className="yte-hint ok">{copied}</span> : null}
            </div>
            <p className={`yte-hint${(bulk ? bulkParsed.length > 0 : parsed?.valid) ? " ok" : input.trim() ? " bad" : ""}`}>{error || hint}</p>
            {liveShareUrls.length ? liveShareUrls.map((url) => <ShareUrlLine url={url} key={url} />) : null}
            <div className="yte-status" role="status" aria-live="polite">
              {busy ? t("extracting") : result?.bestThumbnail ? t("ready") : error}
            </div>
          </form>
        </section>

        {!bulk && result?.thumbnails.length ? (
          <section className="yte-panel yte-stack-wrap">
            <p className="yte-kicker">{t("thumbnailsKicker")}</p>
            <div className="yte-stack">
              {result.thumbnails.map((item, index) => (
                <article className="yte-shot" key={item.url}>
                  <div
                    className="yte-preview"
                    style={item.width && item.height ? { aspectRatio: `${item.width} / ${item.height}` } : undefined}
                  >
                    <ThumbnailPreview
                      url={item.url}
                      {...imageSeoAttrs({
                        title: result.meta?.title,
                        quality: item.quality,
                        tags: tagsForResult(result),
                      })}
                      priority={index === 0}
                    />
                  </div>
                  <div className="yte-meta">
                    <span>{formatSize(item.width, item.height)}</span>
                    <span>
                      {index === 0 ? t("best") : ""}
                      {item.tier.toUpperCase()} · {item.quality}
                    </span>
                  </div>
                  {index === 0 && thumbScore ? (
                    <p className="yte-score">
                      {tx(readLocale(), "packagingScore")} {thumbScore.score}/100
                    </p>
                  ) : null}
                  {index === 0 && liveShareUrls[0] ? <ShareUrlLine url={liveShareUrls[0]} /> : null}
                  {index === 0 ? <SocialRow title={result.meta?.title || t("heroTitle")} url={shareUrlFor(result)} /> : null}
                  <div className="yte-row" ref={index === 0 ? bestThumbControlsRef : undefined}>
                    <button
                      className="yte-btn"
                      type="button"
                      onClick={() => {
                        analytics.track("download_clicked");
                        void downloadManager.download(result.videoId, item).catch(() => setError(userMessage("DOWNLOAD_FAILED")));
                      }}
                    >
                      {t("download")}
                    </button>
                    <button className="yte-ghost" type="button" onClick={() => void showCopied(t("copiedImage"), item.url)}>
                      {t("copyImage")}
                    </button>
                    <button className="yte-ghost" type="button" onClick={() => openFullImage(item.url)}>
                      {t("openFull")}
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
                      <ThumbnailPreview
                        url={item.bestThumbnail.url}
                        {...imageSeoAttrs({
                          title: item.meta?.title || `Video ${index + 1}`,
                          quality: item.bestThumbnail.quality,
                          tags: tagsForResult(item),
                        })}
                      />
                    </div>
                  ) : null}
                  <div className="yte-meta">
                    <span>{tFill("videoLabel", { n: index + 1 })}</span>
                    <span>
                      {formatSize(item.bestThumbnail?.width ?? null, item.bestThumbnail?.height ?? null)} ·{" "}
                      {item.bestThumbnail?.quality ?? "best"}
                    </span>
                  </div>
                  <p className="yte-video-meta">{item.meta?.title || item.videoId}</p>
                  <ShareUrlLine url={shareUrlFor(item)} />
                  <SocialRow title={item.meta?.title || item.videoId} url={shareUrlFor(item)} />
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
                        {tFill("downloadThumbVideo", { n: index + 1, quality: item.bestThumbnail.quality })}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            {brandScore != null ? (
              <p className="yte-score">
                {tx(locale, "brandScore")}: {brandScore}/100
              </p>
            ) : null}
            {bulkResults.length >= 2 ? (
              <button className="yte-ghost" type="button" onClick={() => setCompareOn((value) => !value)}>
                {tx(locale, "compare")}
              </button>
            ) : null}
            {compareOn && bulkResults.length >= 2 ? (
              <div className="yte-compare">
                {bulkResults.slice(0, 2).map((item) => (
                  <article key={item.videoId}>
                    {item.bestThumbnail ? (
                      <ThumbnailPreview
                        url={item.bestThumbnail.url}
                        {...imageSeoAttrs({
                          title: item.meta?.title || item.videoId,
                          quality: item.bestThumbnail.quality,
                          tags: tagsForResult(item),
                        })}
                      />
                    ) : null}
                    <p>{item.meta?.title || item.videoId}</p>
                  </article>
                ))}
              </div>
            ) : null}
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
                {t("exportCsv")}
              </button>
              <button
                className="yte-ghost"
                type="button"
                onClick={() => downloadText("11tik-bulk-thumbnails.json", bulkResultsJson(bulkResults), "application/json")}
              >
                {tx(locale, "exportJson")}
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
                      {tFill("downloadThumbVideo", { n: item.videoNumber, quality: row.quality })}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <aside className="yte-ad" aria-label={t("adSpace")}>{t("adSpace")}</aside>

        {recentHistory.length ? (
          <section className="yte-panel yte-history">
            <div className="yte-row" style={{ justifyContent: "space-between" }}>
              <p className="yte-kicker" style={{ margin: 0 }}>{t("localHistoryKicker")}</p>
              <button className="yte-ghost" type="button" onClick={() => setRecentHistory(historyStore.clear())}>
                {t("clearHistory")}
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
              <button className="yte-ghost" type="button" onClick={() => void showCopied(t("copiedAllUrls"), result.thumbnails.map((item) => item.url).join("\n"))}>
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
          {t("foot")}
        </p>
        <details className="yte-panel">
          <summary>{tx(locale, "legalTitle")}</summary>
          <h3>{tx(locale, "legalQ1")}</h3>
          <p>{tx(locale, "legalA1")}</p>
          <h3>{tx(locale, "legalQ2")}</h3>
          <p>{tx(locale, "legalA2")}</p>
          <h3>{tx(locale, "legalQ3")}</h3>
          <p>{tx(locale, "legalA3")}</p>
        </details>
        <nav className="yte-kw" aria-label={tx(locale, "relatedAlso")}>
          <a href={legalHrefs(locale).about}>{tx(locale, "trustAbout")}</a>
          <a href={legalHrefs(locale).privacy}>{tx(locale, "trustPrivacy")}</a>
          <a href={legalHrefs(locale).terms}>{tx(locale, "trustTerms")}</a>
          <a href={legalHrefs(locale).contact}>{tx(locale, "trustContact")}</a>
          <a href={legalHrefs(locale).embed}>{pageString(locale, "embedTitle")}</a>
          <a href={legalHrefs(locale).keywords}>{pageString(locale, "keywordsTitle")}</a>
          <a href={legalHrefs(locale).copyright}>{tx(locale, "legalTitle")}</a>
          {localizedGuides.slice(0, 6).map((post) => (
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

function SocialRow({ title, url }: { title: string; url: string }) {
  const locale = readLocale();
  const urls = buildShareUrls(url, title);
  return (
    <p className="yte-social">
      <span className="yte-kicker">{tx(locale, "socialShare")}</span>{" "}
      <a href={urls.facebook} target="_blank" rel="noopener noreferrer">
        {tx(locale, "shareFacebook")}
      </a>{" "}
      <a href={urls.twitter} target="_blank" rel="noopener noreferrer">
        {tx(locale, "shareTwitter")}
      </a>{" "}
      <a href={urls.whatsapp} target="_blank" rel="noopener noreferrer">
        {tx(locale, "shareWhatsapp")}
      </a>{" "}
      <a href={urls.telegram} target="_blank" rel="noopener noreferrer">
        {tx(locale, "shareTelegram")}
      </a>{" "}
      <a href={urls.email}>{tx(locale, "shareEmail")}</a>
    </p>
  );
}
