const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function thumbPath(_platform, videoId) {
  const id = encodeURIComponent(String(videoId || "").trim());
  return `/thumb/${id}`;
}

export function parseThumbPath(pathname) {
  const path = String(pathname || "").replace(/\/+$/, "") || "/";
  const youtube = path.match(/^\/thumb\/([A-Za-z0-9_-]{11})$/);
  if (youtube) return { platform: "youtube", videoId: youtube[1] };
  return null;
}

export function migrateExtractLoc(loc) {
  const href = String(loc || "");
  try {
    const url = new URL(href);
    const youtube = url.searchParams.get("v");
    if (youtube && YT_ID.test(youtube)) return `${url.origin}${thumbPath("youtube", youtube)}`;
    return href;
  } catch {
    return href;
  }
}
