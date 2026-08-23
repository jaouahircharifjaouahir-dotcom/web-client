export interface PublicVideoMeta {
  title: string | null;
  authorName: string | null;
  tags: string[];
}

export async function fetchYouTubePublicMeta(_videoId: string, _signal: AbortSignal): Promise<PublicVideoMeta> {
  return { title: null, authorName: null, tags: [] };
}
