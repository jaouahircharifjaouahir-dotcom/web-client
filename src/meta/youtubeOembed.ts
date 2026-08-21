export interface PublicVideoMeta {
  title: string | null;
  authorName: string | null;
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
  return { title, authorName };
}

export async function fetchYouTubePublicMeta(videoId: string, signal: AbortSignal): Promise<PublicVideoMeta> {
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
  return { title: null, authorName: null };
}
