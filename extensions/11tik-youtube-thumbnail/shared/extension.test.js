import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyYouTubeTab,
  extractVideoIdFromUrl,
  isYouTubeHostUrl,
  isUnsupportedPlatformUrl,
  normalizeYouTubeUrl,
} from "./youtube.js";
import {
  allCandidateUrls,
  candidateUrl,
  downloadFilename,
  orderedCandidates,
  rankCandidate,
  selectBestThumbnail,
  sortRanked,
  isVisuallyDuplicate,
} from "./thumbnails.js";
import {
  copy11tikLink,
  copyImageUrl,
  open11tikUrl,
  openFullResolutionUrl,
  shareUrlForVideoId,
  SITE_ORIGIN,
} from "./share.js";

const ID = "dQw4w9WgXcQ";

test("1. YouTube watch URL", () => {
  assert.equal(extractVideoIdFromUrl(`https://www.youtube.com/watch?v=${ID}`), ID);
  assert.equal(extractVideoIdFromUrl(`https://youtube.com/watch?v=${ID}&t=12`), ID);
});

test("2. youtu.be URL", () => {
  assert.equal(extractVideoIdFromUrl(`https://youtu.be/${ID}?si=abc`), ID);
});

test("3. Shorts URL", () => {
  assert.equal(extractVideoIdFromUrl(`https://www.youtube.com/shorts/${ID}`), ID);
});

test("4. embed URL", () => {
  assert.equal(extractVideoIdFromUrl(`https://www.youtube.com/embed/${ID}`), ID);
  assert.equal(extractVideoIdFromUrl(`https://www.youtube-nocookie.com/embed/${ID}`), ID);
});

test("5. invalid YouTube URL", () => {
  assert.equal(extractVideoIdFromUrl("https://www.youtube.com/watch?v=short"), null);
  assert.equal(extractVideoIdFromUrl("not a url"), null);
});

test("6. Vimeo rejection", () => {
  assert.equal(extractVideoIdFromUrl("https://vimeo.com/76979871"), null);
  assert.equal(isUnsupportedPlatformUrl("https://vimeo.com/76979871"), true);
  assert.equal(classifyYouTubeTab("https://vimeo.com/76979871").kind, "unsupported-platform");
});

test("7. best thumbnail selection uses website ranking", () => {
  const maxres = rankCandidate({
    quality: "maxres",
    expectedWidth: 1280,
    expectedHeight: 720,
    tier: "best",
    url: candidateUrl(ID, "maxresdefault.jpg"),
    width: 1280,
    height: 720,
    valid: true,
    placeholder: false,
  });
  const hq = rankCandidate({
    quality: "hq",
    expectedWidth: 480,
    expectedHeight: 360,
    tier: "standard",
    url: candidateUrl(ID, "hqdefault.jpg"),
    width: 480,
    height: 360,
    valid: true,
    placeholder: false,
  });
  assert.equal(selectBestThumbnail([hq, maxres])?.quality, "maxres");
});

test("8. Copy image URL generation", () => {
  const url = copyImageUrl({ url: `https://i.ytimg.com/vi/${ID}/hq720.jpg` });
  assert.equal(url, `https://i.ytimg.com/vi/${ID}/hq720.jpg`);
});

test("9. Copy 11tik link generation", () => {
  assert.equal(copy11tikLink(ID), `${SITE_ORIGIN}/thumb/${ID}`);
  assert.equal(shareUrlForVideoId(""), "");
});

test("10. invalid/empty video ID", () => {
  assert.equal(shareUrlForVideoId(""), "");
  assert.equal(extractVideoIdFromUrl(""), null);
  assert.equal(classifyYouTubeTab("").kind, "no-tab");
});

test("11. unsupported hostname", () => {
  assert.equal(extractVideoIdFromUrl("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(classifyYouTubeTab("about:blank").kind, "not-youtube");
  assert.equal(classifyYouTubeTab("https://example.com/page").kind, "unsupported-platform");
});

test("12. download filename generation", () => {
  assert.equal(
    downloadFilename(ID, { quality: "maxres", url: `https://i.ytimg.com/vi/${ID}/maxresdefault.jpg` }),
    `11tik-${ID}-maxres.jpg`,
  );
  assert.equal(
    downloadFilename(ID, { quality: "maxres-webp", url: `https://i.ytimg.com/vi_webp/${ID}/maxresdefault.webp` }),
    `11tik-${ID}-maxres-webp.webp`,
  );
});

test("ordered candidates follow website strategy order", () => {
  const list = orderedCandidates(ID);
  assert.deepEqual(
    list.map((item) => item.quality),
    ["maxres-webp", "maxres", "hq720", "sd", "hq", "mq", "default"],
  );
  assert.equal(allCandidateUrls(ID).length, 7);
});

test("duplicate thumbnails are skipped", () => {
  const a = {
    valid: true,
    url: "https://i.ytimg.com/vi/x/maxresdefault.jpg",
    quality: "maxres",
    width: 1280,
    height: 720,
  };
  const b = {
    valid: true,
    url: "https://i.ytimg.com/vi/x/maxresdefault.webp",
    quality: "maxres-webp",
    width: 1280,
    height: 720,
  };
  assert.equal(isVisuallyDuplicate(a, b), true);
});

test("YouTube tab classification for channel/search/homepage", () => {
  assert.equal(classifyYouTubeTab("https://www.youtube.com/").kind, "homepage");
  assert.equal(classifyYouTubeTab("https://www.youtube.com/results?search_query=test").kind, "search");
  assert.equal(classifyYouTubeTab("https://www.youtube.com/@mkbhd").kind, "channel");
  assert.equal(classifyYouTubeTab(`https://www.youtube.com/watch?v=${ID}`).kind, "video");
});

test("open actions are string URLs only", () => {
  const candidate = { url: `https://i.ytimg.com/vi/${ID}/hq720.jpg` };
  assert.equal(openFullResolutionUrl(candidate), candidate.url);
  assert.equal(open11tikUrl(ID), `${SITE_ORIGIN}/thumb/${ID}`);
});

test("normalizeYouTubeUrl rejects malformed hosts like website parser", () => {
  assert.equal(normalizeYouTubeUrl(`https://www.youtube.com/watch?v=${ID}`).valid, true);
  assert.equal(normalizeYouTubeUrl("https://www.youtube.com/@channel").errorCode, "CHANNEL_OR_PLAYLIST");
});

test("sortRanked prefers higher score", () => {
  const ranked = sortRanked([
    rankCandidate({ valid: true, placeholder: false, tier: "preview", width: 120, height: 90, expectedWidth: 120, expectedHeight: 90, quality: "default", url: "a" }),
    rankCandidate({ valid: true, placeholder: false, tier: "best", width: 1280, height: 720, expectedWidth: 1280, expectedHeight: 720, quality: "maxres", url: "b" }),
  ]);
  assert.equal(ranked[0].quality, "maxres");
});

test("isYouTubeHostUrl is YouTube-only", () => {
  assert.equal(isYouTubeHostUrl(`https://www.youtube.com/watch?v=${ID}`), true);
  assert.equal(isYouTubeHostUrl("https://vimeo.com/1"), false);
});
