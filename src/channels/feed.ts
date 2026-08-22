export async function expandChannelVideos(channelUrl: string, limit = 20): Promise<string[]> {
  const endpoint = `https://www.11tik.com/web-client/channel-videos?url=${encodeURIComponent(channelUrl)}&limit=${limit}`;
  const res = await fetch(endpoint, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { ok?: boolean; videos?: { url: string }[] };
  if (!data.ok || !data.videos?.length) return [];
  return data.videos.map((item) => item.url);
}

export function looksLikeChannelUrl(raw: string): boolean {
  const value = raw.trim();
  return /youtube\.com\/(channel\/|c\/|user\/|@|playlist)/i.test(value);
}
