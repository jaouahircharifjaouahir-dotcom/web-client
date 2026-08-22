const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

export function thumbPath(platform, videoId) {
  const id = encodeURIComponent(String(videoId || "").trim());
  if (platform === "vimeo") return `/thumb/vimeo/${id}`;
  return `/thumb/${id}`;
}

export function parseThumbPath(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const vimeo = path.match(/^\/thumb\/vimeo\/(\d{6,12})$/);
  if (vimeo) return { platform: "vimeo", videoId: vimeo[1] };
  const youtube = path.match(/^\/thumb\/([A-Za-z0-9_-]{11})$/);
  if (youtube) return { platform: "youtube", videoId: youtube[1] };
  return null;
}

export function migrateExtractLoc(loc) {
  const href = String(loc || "");
  try {
    const url = new URL(href);
    const youtube = url.searchParams.get("v");
    const vimeo = url.searchParams.get("vimeo");
    if (youtube && YT_ID.test(youtube)) return `${url.origin}${thumbPath("youtube", youtube)}`;
    if (vimeo && VIMEO_ID.test(vimeo)) return `${url.origin}${thumbPath("vimeo", vimeo)}`;
    return href;
  } catch {
    return href;
  }
}
