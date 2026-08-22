export interface PublicVideoMeta {
  title: string | null;
  authorName: string | null;
  tags: string[];
}

interface OEmbedJson {
  title?: string;
  author_name?: string;
}

async function readOEmbed(url: string, signal: AbortSignal): Promise<PublicVideoMeta | null> {
  const response = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const data = (await response.json()) as OEmbedJson;
  const title = data.title?.trim() || null;
  const authorName = data.author_name?.trim() || null;
  if (!title && !authorName) return null;
  return { title, authorName, tags: [] };
}

export async function fetchYouTubePublicMeta(videoId: string, signal: AbortSignal): Promise<PublicVideoMeta> {
  try {
    const response = await fetch(`https://www.11tik.com/web-client/youtube-meta?v=${encodeURIComponent(videoId)}`, {
      signal,
      cache: "no-store",
    });
    if (response.ok) {
      const data = (await response.json()) as { title?: string; authorName?: string; tags?: string[] };
      const tags = Array.isArray(data.tags)
        ? data.tags.map((tag) => String(tag).trim().replace(/^#+/, "").trim()).filter(Boolean)
        : [];
      if (tags.length || data.title) {
        return {
          title: data.title?.trim() || null,
          authorName: data.authorName?.trim() || null,
          tags,
        };
      }
    }
  } catch {
    /* fall back to oEmbed title only */
  }

  const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const endpoints = [
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`,
    `https://noembed.com/embed?url=${encodeURIComponent(watch)}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const meta = await readOEmbed(endpoint, signal);
      if (meta) return meta;
    } catch {
      /* try next public oEmbed host */
    }
  }
  return { title: null, authorName: null, tags: [] };
}
