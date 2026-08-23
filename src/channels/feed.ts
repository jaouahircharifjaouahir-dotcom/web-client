export function looksLikeChannelUrl(value: string): boolean {
  return /youtube\.com\/(channel\/|c\/|@|user\/)/i.test(String(value || ""));
}

export async function expandChannelVideos(_channelUrl: string, _limit = 20): Promise<string[]> {
  return [];
}
