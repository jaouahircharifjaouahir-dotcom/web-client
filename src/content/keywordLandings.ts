export type KeywordLanding = {
  slug: string;
  keyword: string;
  title: string;
  intro: string;
};

export const DEFAULT_HERO = {
  title: "YouTube Thumbnail Extractor",
  intro:
    "Extract and download public YouTube thumbnail images in your browser. Paste a public watch, Shorts, live, or youtu.be link. Processing is client-side. 11tik does not download YouTube videos or audio.",
} as const;

export const KEYWORD_LANDINGS: KeywordLanding[] = [
  {
    slug: "youtube-thumbnail-downloader",
    keyword: "YouTube thumbnail downloader",
    title: "YouTube Thumbnail Downloader",
    intro:
      "Use this YouTube thumbnail downloader to save the public still YouTube already hosts for a video. Paste a watch, Shorts, live, or youtu.be link, then download the highest file that actually exists. The extractor below is the same tool as the homepage—this page is just the downloader wording.",
  },
  {
    slug: "youtube-thumbnail-grabber",
    keyword: "YouTube thumbnail grabber",
    title: "YouTube Thumbnail Grabber",
    intro:
      "A YouTube thumbnail grabber is the same 11tik extractor: paste a public YouTube URL and save the public still YouTube already hosts. No separate grabber product—client-side thumbnail images only, not video or audio.",
  },
  {
    slug: "youtube-thumbnail-download",
    keyword: "YouTube thumbnail download",
    title: "YouTube Thumbnail Download",
    intro:
      "Need a YouTube thumbnail download without a screenshot or desktop app? Paste the public video URL into the extractor. It checks maxres, sd, hq, and smaller public sizes in your browser and lets you save the best valid image.",
  },
  {
    slug: "youtube-shorts-thumbnail",
    keyword: "YouTube Shorts thumbnail",
    title: "YouTube Shorts Thumbnail Extractor",
    intro:
      "Shorts links such as youtube.com/shorts/ID still have public thumbnail files. Paste a Shorts URL below to preview and download the highest available still. The image is often landscape even when the Short plays vertical.",
  },
  {
    slug: "youtube-thumbnail-url",
    keyword: "YouTube thumbnail URL",
    title: "Get a YouTube Thumbnail URL",
    intro:
      "A YouTube thumbnail URL is the direct image address on i.ytimg.com or img.youtube.com, built from the video ID. Paste a video link, then use Copy image URL on the size you need. You can also download the file with the extractor below.",
  },
  {
    slug: "youtube-thumbnail-size",
    keyword: "YouTube thumbnail size",
    title: "YouTube Thumbnail Size Checker",
    intro:
      "Public YouTube thumbnails are not one size. Common files include 120×90, 320×180, 480×360, 640×480, and 1280×720 when maxres exists. Paste a URL to see which sizes are real for that video, then download the one you need.",
  },
  {
    slug: "hd-youtube-thumbnail",
    keyword: "HD YouTube thumbnail",
    title: "Download an HD YouTube Thumbnail",
    intro:
      "HD here means the largest public thumbnail YouTube published for that video, usually 1280×720 when maxresdefault is available. Paste the URL below. If HD was never published, the tool selects the next valid public size instead of faking pixels.",
  },
  {
    slug: "maxresdefault-thumbnail",
    keyword: "maxresdefault thumbnail",
    title: "Find maxresdefault Thumbnail",
    intro:
      "maxresdefault.jpg is YouTube’s common 1280×720 public still. Not every video has it. Paste a URL and the extractor will list maxres only when the file exists, then fall back to the next real size.",
  },
  {
    slug: "youtube-live-thumbnail",
    keyword: "YouTube Live thumbnail",
    title: "YouTube Live Thumbnail Extractor",
    intro:
      "Live URLs such as youtube.com/live/ID still use a video ID. Paste a supported Live link to load public thumbnail files for that stream. Private or unlisted lives without public stills will not return images.",
  },
  {
    slug: "youtu-be-thumbnail",
    keyword: "youtu.be thumbnail",
    title: "youtu.be Thumbnail Downloader",
    intro:
      "Short youtu.be/ID links work the same as full watch URLs. Paste a youtu.be address below to extract and download the public thumbnail. Extra query parameters on the link are ignored.",
  },
  {
    slug: "original-youtube-thumbnail",
    keyword: "original YouTube thumbnail",
    title: "Original YouTube Thumbnail Image",
    intro:
      "The original public thumbnail is the best derivative YouTube hosts, not a frame ripped from the video. Paste a URL to download that still at the highest available public resolution. Restricted videos without public thumbs cannot be forced.",
  },
  {
    slug: "bulk-youtube-thumbnails",
    keyword: "bulk YouTube thumbnails",
    title: "Bulk YouTube Thumbnail Extractor",
    intro:
      "Turn on Bulk in the header, paste one YouTube URL per line, and extract public thumbnails for many videos at once. Each video shows its best still first. Use this when you need several public thumbnails in one pass.",
  },
];

export function findKeywordLanding(slug: string | null | undefined): KeywordLanding | null {
  if (!slug) return null;
  return KEYWORD_LANDINGS.find((item) => item.slug === slug) ?? null;
}

export function readKeywordSlug(search = typeof location === "undefined" ? "" : location.search): string | null {
  try {
    return new URLSearchParams(search).get("k");
  } catch {
    return null;
  }
}
