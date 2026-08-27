import { useEffect, useState, type ReactNode } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { hasStaticSiteHeader } from "../components/hasStaticSiteHeader";
import { tx } from "../i18n/extra";
import { KEYWORD_LANDINGS } from "../content/keywordLandings";
import { applyDocumentMeta } from "../seo/documentMeta";
import { pageFill, pageString } from "../i18n/pages";
import { localeHomeUrl, readLocale, t } from "../i18n/ui";
import { useLocaleCatalog } from "../i18n/useLocaleCatalog";
import { readTheme, resolvedTheme, saveTheme, type ThemeMode } from "../hooks/theme";
import { homeViewHref, type HomeView } from "../routing/homeView";
import type { AppRoute } from "../routing/path";
import { thumbPath } from "../routing/thumb";

type TagPayload = {
  ok: boolean;
  robots?: string;
  tag?: { slug: string; name: string; count: number; gate?: { decision: string; reason: string } };
  videos?: Array<{ loc: string; title?: string; thumb?: string; videoId?: string; tags?: string[] }>;
};

function PageShell({ origin, children }: { origin: string; children: ReactNode }) {
  const locale = readLocale();
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme());
  const staticHeader = hasStaticSiteHeader();
  const themeLabel = theme === "dark" ? t("themeDark") : theme === "light" ? t("themeLight") : t("themeSystem");

  useEffect(() => {
    const mode = resolvedTheme(theme);
    document.documentElement.dataset.yteTheme = mode;
    saveTheme(theme);
  }, [theme]);

  const goView = (view: HomeView) => {
    window.location.assign(homeViewHref(view, origin));
  };

  return (
    <div className="yte-app">
      <div className="yte-shell">
        {staticHeader ? null : (
          <SiteHeader
            homeView="home"
            theme={theme}
            themeLabel={themeLabel}
            onNavigateView={goView}
            onCycleTheme={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
            locale={locale}
          />
        )}
        {children}
      </div>
    </div>
  );
}

export function SitePages({ route }: { route: Exclude<AppRoute, { name: "home" }> }) {
  const locale = readLocale();
  const origin = localeHomeUrl();
  if (route.name === "copyright") {
    return (
      <Article
        title={tx(locale, "legalTitle")}
        body={`${tx(locale, "legalQ1")}\n${tx(locale, "legalA1")}\n\n${tx(locale, "legalQ2")}\n${tx(locale, "legalA2")}\n\n${tx(locale, "legalQ3")}\n${tx(locale, "legalA3")}`}
        origin={origin}
      />
    );
  }
  if (route.name === "guide") return <Article title={pageString(locale, "guideTitle")} body={pageString(locale, "guideBody")} origin={origin} />;
  if (route.name === "about") return <Article title={pageString(locale, "aboutTitle")} body={pageString(locale, "aboutBody")} origin={origin} />;
  if (route.name === "privacy") return <Article title={pageString(locale, "privacyTitle")} body={pageString(locale, "privacyBody")} origin={origin} />;
  if (route.name === "terms") return <Article title={pageString(locale, "termsTitle")} body={pageString(locale, "termsBody")} origin={origin} />;
  if (route.name === "contact") return <Article title={pageString(locale, "contactTitle")} body={pageString(locale, "contactBody")} origin={origin} />;
  if (route.name === "embed") return <Article title={pageString(locale, "embedTitle")} body={pageString(locale, "embedBody")} origin={origin} />;
  if (route.name === "keywords") return <KeywordTools origin={origin} />;
  if (route.name === "trending") return <Trending origin={origin} />;
  if (route.name === "hold") return <Hold origin={origin} />;
  if (route.name === "stats") return <Stats origin={origin} />;
  if (route.name === "tag") return <TagPage slug={route.slug} origin={origin} />;
  if (route.name === "thumb") return <ThumbPage platform={route.platform} videoId={route.videoId} origin={origin} />;
  return <Article title="11tik" body="" origin={origin} />;
}

function Article({ title, body, origin }: { title: string; body: string; origin: string }) {
  const { posts: guides } = useLocaleCatalog(readLocale());
  useEffect(() => {
    const desc = body.split("\n").map((line) => line.trim()).find((line) => line.length > 40) || body.slice(0, 160);
    applyDocumentMeta(`${title} · 11tik`, desc);
  }, [title, body]);
  return (
    <PageShell origin={origin}>
      <h1>{title}</h1>
      <section className="yte-panel">
        {body.split("\n").map((line, index) => (
          <p key={index}>{line || "\u00a0"}</p>
        ))}
      </section>
      <nav className="yte-kw">
        {guides.slice(0, 6).map((post) => (
          <a href={post.href} key={post.href}>
            {post.title}
          </a>
        ))}
      </nav>
    </PageShell>
  );
}

function TagPage({ slug, origin }: { slug: string; origin: string }) {
  const data: TagPayload = { ok: false };
  useEffect(() => {
    applyDocumentMeta(
      `#${slug} · 11tik`,
      `Public YouTube thumbnail extracts tagged ${slug} that passed the 11tik quality gate.`,
    );
  }, [slug]);
  useEffect(() => {
    if (data?.robots?.includes("noindex")) {
      const robots = document.createElement("meta");
      robots.name = "robots";
      robots.content = "noindex,follow";
      document.head.appendChild(robots);
      return () => robots.remove();
    }
    return undefined;
  }, [data]);
  const videos = data?.videos || [];
  return (
    <PageShell origin={origin}>
      <h1>#{slug}</h1>
      <p>{data?.tag?.gate?.reason || ""}</p>
      <div className="yte-grid">
        {videos.map((video) => (
          <a className="yte-shot" href={video.loc || `${origin.replace(/\/$/, "")}${thumbPath("youtube", video.videoId || "")}`} key={video.videoId || video.loc}>
            {video.thumb ? (
              <img
                alt={`${video.title || video.videoId || "YouTube"} thumbnail | 11tik`}
                title={`${video.title || "YouTube thumbnail"}${video.tags?.length ? ` – ${video.tags.slice(0, 8).join(", ")}` : ""}`}
                src={video.thumb}
                style={{ width: "100%", borderRadius: 12 }}
              />
            ) : null}
            <p>{video.title || video.videoId}</p>
          </a>
        ))}
      </div>
    </PageShell>
  );
}

type ExtractPayload = {
  ok?: boolean;
  title?: string;
  tags?: string[];
  thumb?: string;
  loc?: string;
  gate?: { decision?: string };
  platform?: string;
  videoId?: string;
};

export function ThumbArticle({
  platform,
  videoId,
  origin,
}: {
  platform: "youtube";
  videoId: string;
  origin: string;
}) {
  const locale = readLocale();
  const [data] = useState<ExtractPayload>({});
  const title = data?.title || videoId;
  const heading = pageFill(locale, "thumbHeading", { title });
  useEffect(() => {
    applyDocumentMeta(`${heading} · 11tik`, pageFill(locale, "thumbLead", { title }));
  }, [heading, locale, title]);
  const home = origin.replace(/\/$/, "");
  const thumb =
    data?.thumb ||
    (platform === "youtube" ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "");
  const tags = data?.tags || [];
  return (
    <section className="yte-panel" aria-labelledby="yte-thumb-h">
      <h1 id="yte-thumb-h">{heading}</h1>
      {thumb ? (
        <p>
          <img
            alt={pageFill(locale, "thumbImgAlt", { title })}
            title={heading}
            src={thumb}
            width={640}
            height={360}
            style={{ width: "100%", maxWidth: 640, height: "auto", borderRadius: 12 }}
          />
        </p>
      ) : null}
      <p>{pageFill(locale, "thumbLead", { title })}</p>
      <p>{pageFill(locale, "thumbBody", { title })}</p>
      <p>{pageString(locale, "thumbSizes")}</p>
      <p>{pageString(locale, "thumbRights")}</p>
      {tags.length ? (
        <nav className="yte-kw">
          {tags.slice(0, 12).map((tag) => (
            <a href={`${home}/tag/${encodeURIComponent(tag.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 48))}`} key={tag}>
              {tag}
            </a>
          ))}
        </nav>
      ) : null}
    </section>
  );
}

function ThumbPage({
  platform,
  videoId,
  origin,
}: {
  platform: "youtube";
  videoId: string;
  origin: string;
}) {
  const locale = readLocale();
  return (
    <PageShell origin={origin}>
      <ThumbArticle platform={platform} videoId={videoId} origin={origin} />
      <p>
        <a href={origin}>{pageString(locale, "thumbCta")}</a>
      </p>
    </PageShell>
  );
}

function KeywordTools({ origin }: { origin: string }) {
  const locale = readLocale();
  const home = origin.replace(/\/$/, "");
  useEffect(() => {
    applyDocumentMeta(`${pageString(locale, "keywordsTitle")} · 11tik`, pageString(locale, "keywordsBody"));
  }, [locale]);
  return (
    <PageShell origin={origin}>
      <h1>{pageString(locale, "keywordsTitle")}</h1>
      <section className="yte-panel">
        <p>{pageString(locale, "keywordsBody")}</p>
        <div className="yte-list">
          {KEYWORD_LANDINGS.map((item) => (
            <a className="yte-item" href={`${home}/?k=${item.slug}`} key={item.slug}>
              {item.keyword}
            </a>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function Trending({ origin }: { origin: string }) {
  const tags: Array<{ slug: string; name: string; count: number }> = [];
  useEffect(() => {
    applyDocumentMeta(`${pageString(readLocale(), "trendingTags")} · 11tik`, pageString(readLocale(), "trendingIntro"));
  }, []);
  return (
    <PageShell origin={origin}>
      <h1>{pageString(readLocale(), "trendingTags")}</h1>
      <p>{pageString(readLocale(), "trendingIntro")}</p>
      <div className="yte-list">
        {tags.map((tag) => (
          <a className="yte-item" href={`${origin.replace(/\/$/, "")}/tag/${tag.slug}`} key={tag.slug}>
            {tag.name} · {tag.count}
          </a>
        ))}
      </div>
    </PageShell>
  );
}

function Hold({ origin }: { origin: string }) {
  const hold: Array<{ slug: string; count: number; gate?: { reason: string } }> = [];
  return (
    <Article
      title="Hold queue"
      body={hold.map((row) => `${row.slug}: ${row.count} — ${row.gate?.reason || ""}`).join("\n") || "Empty"}
      origin={origin}
    />
  );
}

function Stats({ origin }: { origin: string }) {
  const count = 0;
  return (
    <Article
      title={pageString(readLocale(), "statsTitle")}
      body={`${pageString(readLocale(), "statsBody")}\n${count}`}
      origin={origin}
    />
  );
}
