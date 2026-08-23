import type { MediaPlatform } from "../parsers/mediaUrl";

export function thumbPath(_platform: MediaPlatform | string, videoId: string): string {
  const id = encodeURIComponent(String(videoId || "").trim());
  return `/thumb/${id}`;
}

export function parseThumbPath(pathname = typeof location === "undefined" ? "/" : location.pathname): {
  platform: MediaPlatform;
  videoId: string;
} | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const youtube = path.match(/^\/thumb\/([A-Za-z0-9_-]{11})$/);
  if (youtube) return { platform: "youtube", videoId: youtube[1] };
  return null;
}
