import type { MediaPlatform } from "../parsers/mediaUrl";

export function thumbPath(platform: MediaPlatform | string, videoId: string): string {
  const id = encodeURIComponent(String(videoId || "").trim());
  if (platform === "vimeo") return `/thumb/vimeo/${id}`;
  return `/thumb/${id}`;
}

export function parseThumbPath(pathname = typeof location === "undefined" ? "/" : location.pathname): {
  platform: MediaPlatform;
  videoId: string;
} | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const vimeo = path.match(/^\/thumb\/vimeo\/(\d{6,12})$/);
  if (vimeo) return { platform: "vimeo", videoId: vimeo[1] };
  const youtube = path.match(/^\/thumb\/([A-Za-z0-9_-]{11})$/);
  if (youtube) return { platform: "youtube", videoId: youtube[1] };
  return null;
}
