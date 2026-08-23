/**
 * Client-side YouTube thumbnail discovery.
 * Ranking mirrors src/ranking/ranker.ts and probe order mirrors src/engines/discovery.ts.
 */

const QUALITY_PRESETS = [
  { quality: "maxres-webp", expectedWidth: 1280, expectedHeight: 720, tier: "best", filename: "maxresdefault.webp" },
  { quality: "maxres", expectedWidth: 1280, expectedHeight: 720, tier: "best", filename: "maxresdefault.jpg" },
  { quality: "hq720", expectedWidth: 1280, expectedHeight: 720, tier: "best", filename: "hq720.jpg" },
  { quality: "sd", expectedWidth: 640, expectedHeight: 480, tier: "high", filename: "sddefault.jpg" },
  { quality: "hq", expectedWidth: 480, expectedHeight: 360, tier: "standard", filename: "hqdefault.jpg" },
  { quality: "mq", expectedWidth: 320, expectedHeight: 180, tier: "preview", filename: "mqdefault.jpg" },
  { quality: "default", expectedWidth: 120, expectedHeight: 90, tier: "preview", filename: "default.jpg" },
];

const TIER_SCORE = { best: 400, high: 250, standard: 120, preview: 40 };
const REQUEST_TIMEOUT_MS = 8000;

const STRATEGY_ORDER = ["primary", "high-quality", "standard", "alternative", "fallback"];
const STRATEGY_PRESETS = {
  primary: ["maxres-webp", "maxres", "hq720"],
  "high-quality": ["sd"],
  standard: ["hq"],
  alternative: ["mq"],
  fallback: ["default"],
};

export function candidateUrl(videoId, filename) {
  if (filename.endsWith(".webp")) {
    return `https://i.ytimg.com/vi_webp/${encodeURIComponent(videoId)}/${filename}`;
  }
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${filename}`;
}

export function orderedCandidates(videoId) {
  const byQuality = new Map(QUALITY_PRESETS.map((preset) => [preset.quality, preset]));
  const seen = new Set();
  const list = [];

  for (const strategy of STRATEGY_ORDER) {
    for (const quality of STRATEGY_PRESETS[strategy]) {
      const preset = byQuality.get(quality);
      if (!preset) continue;
      const url = candidateUrl(videoId, preset.filename);
      if (seen.has(url)) continue;
      seen.add(url);
      list.push({ ...preset, url, strategy });
    }
  }

  return list;
}

export function allCandidateUrls(videoId) {
  return orderedCandidates(videoId);
}

function isPlaceholder(width, height, expectedWidth) {
  if (width <= 0 || height <= 0) return true;
  if (expectedWidth >= 480 && width <= 120 && height <= 90) return true;
  return false;
}

export function rankCandidate(candidate) {
  if (!candidate.valid || candidate.placeholder) {
    return { ...candidate, score: 0 };
  }

  const pixels = (candidate.width ?? 0) * (candidate.height ?? 0);
  const expected = (candidate.expectedWidth ?? 0) * (candidate.expectedHeight ?? 0);
  const matchBonus = expected && pixels >= expected * 0.85 ? 80 : 0;
  const webpPenalty = candidate.url.endsWith(".webp") ? -8 : 0;

  let tier = candidate.tier;
  if ((candidate.width ?? 0) >= 1280) tier = "best";
  else if ((candidate.width ?? 0) >= 640) tier = "high";
  else if ((candidate.width ?? 0) >= 480) tier = "standard";
  else tier = "preview";

  const score = TIER_SCORE[tier] + Math.round(pixels / 1000) + matchBonus + webpPenalty;
  return { ...candidate, tier, score };
}

export function sortRanked(candidates) {
  return [...candidates].sort((a, b) => b.score - a.score || (b.width ?? 0) - (a.width ?? 0));
}

export function isVisuallyDuplicate(a, b) {
  if (!a.valid || !b.valid) return false;
  if (a.url === b.url) return true;
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.quality.replace("-webp", "") === b.quality.replace("-webp", "")
  );
}

export function selectBestThumbnail(validCandidates) {
  return sortRanked(validCandidates)[0] ?? null;
}

async function probeOne(candidate, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(candidate.url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();

    const placeholder = isPlaceholder(width, height, candidate.expectedWidth);
    const base = {
      ...candidate,
      width,
      height,
      blob,
      mimeType: blob.type || (candidate.url.endsWith(".webp") ? "image/webp" : "image/jpeg"),
      valid: !placeholder,
      placeholder,
      failureReason: placeholder ? "IMAGE_VALIDATION_FAILED" : null,
    };

    return rankCandidate(base);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function discoverBestThumbnail(videoId, signal) {
  const pending = orderedCandidates(videoId);
  const valid = [];
  const failed = [];

  for (const candidate of pending) {
    if (signal?.aborted) break;
    const checked = await probeOne(candidate, signal);
    if (!checked) {
      failed.push({ ...candidate, valid: false, failureReason: "NETWORK_ERROR" });
      continue;
    }
    if (checked.valid) {
      if (!valid.some((item) => isVisuallyDuplicate(item, checked))) {
        valid.push(checked);
      } else {
        failed.push({ ...checked, valid: false, failureReason: "duplicate" });
      }
    } else {
      failed.push(checked);
    }
  }

  const ranked = sortRanked(valid);
  return {
    best: ranked[0] ?? null,
    all: ranked,
    failed,
  };
}

export function formatQualityLabel(candidate) {
  if (!candidate) return "";
  return `${candidate.quality} · ${candidate.width}×${candidate.height}`;
}

export function downloadFilename(videoId, candidate) {
  const ext = candidate.url.endsWith(".webp") ? "webp" : "jpg";
  const safeId = String(videoId || "video").replace(/[^A-Za-z0-9_-]+/g, "-");
  const safeQuality = String(candidate.quality || "thumb").replace(/[^a-z0-9-]+/gi, "-");
  return `11tik-${safeId}-${safeQuality}.${ext}`;
}
