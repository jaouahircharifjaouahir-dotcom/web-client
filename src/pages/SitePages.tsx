import { useEffect, useState } from "react";
import { PILLAR_GUIDE, TRUST_PAGES } from "../content/trust";
import { relatedGuides } from "../content/related";
import { tx } from "../i18n/extra";
import { localeHomeUrl, readLocale } from "../i18n/ui";
import type { AppRoute } from "../routing/path";

type TagPayload = {
  ok: boolean;
  robots?: string;
  tag?: { slug: string; name: string; count: number; gate?: { decision: string; reason: string } };
  videos?: Array<{ loc: string; title?: string; thumb?: string; videoId?: string; tags?: string[] }>;
};

export function SitePages({ route }: { route: Exclude<AppRoute, { name: "home" }> }) {
  const locale = readLocale();
  const origin = localeHomeUrl();
  if (route.name === "about") return <Article title={TRUST_PAGES.about.title} body={TRUST_PAGES.about.body} origin={origin} />;
  if (route.name === "privacy") return <Article title={TRUST_PAGES.privacy.title} body={TRUST_PAGES.privacy.body} origin={origin} />;
  if (route.name === "terms") return <Article title={TRUST_PAGES.terms.title} body={TRUST_PAGES.terms.body} origin={origin} />;
  if (route.name === "contact") return <Article title={TRUST_PAGES.contact.title} body={TRUST_PAGES.contact.body} origin={origin} />;
  if (route.name === "copyright") {
    return (
      <Article
        title={tx(locale, "legalTitle")}
        body={`${tx(locale, "legalQ1")}\n${tx(locale, "legalA1")}\n\n${tx(locale, "legalQ2")}\n${tx(locale, "legalA2")}\n\n${tx(locale, "legalQ3")}\n${tx(locale, "legalA3")}`}
        origin={origin}
      />
    );
  }
  if (route.name === "guide") return <Article title={PILLAR_GUIDE.title} body={PILLAR_GUIDE.body} origin={origin} />;
  if (route.name === "trending") return <Trending origin={origin} />;
  if (route.name === "hold") return <Hold origin={origin} />;
  if (route.name === "stats") return <Stats origin={origin} />;
  if (route.name === "tag") return <TagPage slug={route.slug} origin={origin} />;
  return <Article title="11tik" body="" origin={origin} />;
}

function Article({ title, body, origin }: { title: string; body: string; origin: string }) {
  useEffect(() => {
    document.title = `${title} · 11tik`;
  }, [title]);
  return (
    <div className="yte-app">
      <div className="yte-shell">
        <p className="yte-kicker">
          <a href={origin}>11tik</a>
        </p>
        <h1>{title}</h1>
        <section className="yte-panel">
          {body.split("\n").map((line, index) => (
            <p key={index}>{line || "\u00a0"}</p>
          ))}
        </section>
        <nav className="yte-kw">
          {relatedGuides("").map((post) => (
            <a href={post.href} key={post.href}>
              {post.title}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

function TagPage({ slug, origin }: { slug: string; origin: string }) {
  const [data, setData] = useState<TagPayload | null>(null);
  useEffect(() => {
    void fetch(`https://www.11tik.com/web-client/tags/${encodeURIComponent(slug)}.json`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData({ ok: false }));
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
    <div className="yte-app">
      <div className="yte-shell">
        <p className="yte-kicker">
          <a href={origin}>11tik</a> / tag
        </p>
        <h1>#{slug}</h1>
        <p>{data?.tag?.gate?.reason || ""}</p>
        <div className="yte-grid">
          {videos.map((video) => (
            <a className="yte-shot" href={video.loc || `${origin}/?v=${video.videoId}`} key={video.videoId || video.loc}>
              {video.thumb ? <img alt="" src={video.thumb} style={{ width: "100%", borderRadius: 12 }} /> : null}
              <p>{video.title || video.videoId}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Trending({ origin }: { origin: string }) {
  const [tags, setTags] = useState<Array<{ slug: string; name: string; count: number }>>([]);
  useEffect(() => {
    void fetch("https://www.11tik.com/web-client/tags/trending.json")
      .then((res) => res.json())
      .then((data) => setTags(data.tags || []))
      .catch(() => setTags([]));
  }, []);
  return (
    <div className="yte-app">
      <div className="yte-shell">
        <p className="yte-kicker">
          <a href={origin}>11tik</a>
        </p>
        <h1>Trending tags</h1>
        <div className="yte-list">
          {tags.map((tag) => (
            <a className="yte-item" href={`${origin.replace(/\/$/, "")}/tag/${tag.slug}`} key={tag.slug}>
              #{tag.name} · {tag.count}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hold({ origin }: { origin: string }) {
  const [hold, setHold] = useState<Array<{ slug: string; count: number; gate?: { reason: string } }>>([]);
  useEffect(() => {
    void fetch("https://www.11tik.com/web-client/hold-queue.json")
      .then((res) => res.json())
      .then((data) => setHold(data.hold || []))
      .catch(() => setHold([]));
  }, []);
  return (
    <Article
      title="Hold queue"
      body={hold.map((row) => `${row.slug}: ${row.count} — ${row.gate?.reason || ""}`).join("\n") || "Empty"}
      origin={origin}
    />
  );
}

function Stats({ origin }: { origin: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    void fetch("https://www.11tik.com/web-client/tags/trending.json")
      .then((res) => res.json())
      .then((data) => setCount((data.tags || []).reduce((sum: number, row: { count: number }) => sum + (row.count || 0), 0)))
      .catch(() => setCount(0));
  }, []);
  return (
    <Article
      title="YouTube Thumbnail Statistics 2026"
      body={`Indexed public extracts currently associated with qualifying tags: ${count}.\nThese counts grow only from real extractions and capped trending seeds that pass the quality gate (complete title, tags, and a live thumbnail).`}
      origin={origin}
    />
  );
}

