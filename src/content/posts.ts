export const GUIDE_POSTS = [
  {
    title: "How to Download a YouTube Thumbnail in HD – Free & Fast",
    href: "https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html",
    summary:
      "This guide walks through the full path from a public YouTube watch link, Shorts URL, or youtu.be short link to an HD still you can save on any device. You will see how the video ID is read in the browser, why extra query parameters such as pp= do not matter, and how the extractor checks maxresdefault, hq720, sddefault, and smaller public files. If YouTube never published a 1280×720 still for that upload, the article shows how the next valid size is chosen so you still download the sharpest real image instead of a broken filename. It also covers copy-image-URL, opening full resolution, and what the tool will not do: no video or audio download, no private files, and no account.",
  },
  {
    title: "How to Get a YouTube Thumbnail URL – Easy, Fast & Free",
    href: "https://www.11tik.com/2026/08/youtube-thumbnail-url.html",
    summary:
      "A YouTube thumbnail URL is the direct address of an image on i.ytimg.com or img.youtube.com, not the watch page you share with viewers. This article explains how those URLs are built from the 11-character video ID, which filenames map to default, mq, hq, sd, and maxres, and how to copy a working link into a blog, thumbnail mockup, or social preview. You will learn why some guessed URLs 404, why the extractor only lists files that actually return an image, and how to keep the address HTTPS. Use it when you need the image location itself rather than a downloaded file, including for CMS featured images and design tools.",
  },
  {
    title: "YouTube Thumbnail Size & Resolution: Complete 2026 Guide",
    href: "https://www.11tik.com/2026/08/youtube-thumbnail-size-resolution.html",
    summary:
      "YouTube does not serve one thumbnail size. Public stills commonly include 120×90 default, 320×180 mqdefault, 480×360 hqdefault, 640×480 sddefault, and 1280×720 maxresdefault when the uploader’s source allowed it. This 2026 guide lists those resolutions, how they relate to the 16:9 player, and what happens on Shorts where the player is vertical but the stored still is often landscape. It also explains ranking: the extractor prefers the largest file that validates as a real image, so a missing maxres file does not invent pixels. Use this when you need exact pixel sizes for thumbnails, embeds, or Open Graph previews.",
  },
  {
    title: "How to Download a YouTube Shorts Thumbnail in HD – Free & Fast",
    href: "https://www.11tik.com/2026/08/youtube-shorts-thumbnail-download.html",
    summary:
      "Shorts URLs such as youtube.com/shorts/ID use the same public image hosts as regular videos, so you can still pull HD stills in the browser without an app. This guide covers how to paste a Shorts link, how the ID is parsed from the path, and why the preview may look wider than the vertical Short you watched. You will see how to download the best available public file, what to do if maxres is absent, and how bulk mode handles several Shorts at once. Private or age-gated Shorts that do not publish public thumbnails will not appear, which is expected. No video file is saved—only the still YouTube already hosts.",
  },
  {
    title: "How to Get the Highest Quality YouTube Thumbnail – HD & Maximum Resolution",
    href: "https://www.11tik.com/2026/08/highest-quality-youtube-thumbnail.html",
    summary:
      "Highest quality means the largest public JPEG (or WebP) that YouTube actually returns, not the highest name you type into a URL. This article compares maxresdefault and hq720 against sd, hq, mq, and default, and shows how validation avoids placeholder or missing files. When 1280×720 exists, that is usually the top pick; when it does not, the next real size is the honest maximum for that video. You will also see how bulk mode shows each video’s best still first, then download buttons for lower qualities. The process stays on your device: paste the URL, wait for checks, then save. There is no paid unlock and no claim of 4K if YouTube never published that still.",
  },
  {
    title: "How to Get the Original YouTube Thumbnail Image – Full Quality Guide",
    href: "https://www.11tik.com/2026/08/original-youtube-thumbnail-image.html",
    summary:
      "Creators upload one source thumbnail; viewers and tools only receive the public derivatives YouTube stores on its image CDN. This full-quality guide explains how to recover that original public image at the best available resolution, how filenames map to those derivatives, and why “original” never means extracting frames from the video stream. You will learn the difference between the custom upload and auto-generated stills, how to copy the direct image URL, and how to download without logging in. Restricted videos without public thumbs cannot be forced. Use 11tik for a fast client-side check, then keep the file for design, archiving, or posts—still images only, never the video or audio.",
  },
] as const;
