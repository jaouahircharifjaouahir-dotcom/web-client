/** 11tik brand links — string helpers only; no network calls. */

export const SITE_ORIGIN = "https://www.11tik.com";

export function shareUrlForVideoId(videoId, origin = SITE_ORIGIN) {
  const id = String(videoId || "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return "";
  return `${origin}/thumb/${encodeURIComponent(id)}`;
}

export function copyImageUrl(candidate) {
  return candidate?.url ?? "";
}

export function copy11tikLink(videoId) {
  return shareUrlForVideoId(videoId);
}

export function open11tikUrl(videoId) {
  return shareUrlForVideoId(videoId);
}

export function openFullResolutionUrl(candidate) {
  return candidate?.url ?? "";
}
