import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = "C:/Users/ADMIN/Downloads/11tik-pages-ready";
mkdirSync(outDir, { recursive: true });

const STYLE = `<style>
.yte-page{max-width:720px;margin:32px auto 64px;padding:0 20px;font-family:system-ui,Segoe UI,sans-serif;color:#17141c;line-height:1.65}
.yte-page h1{font-size:2rem;line-height:1.15;margin:0 0 12px}
.yte-page h2{font-size:1.2rem;margin:28px 0 8px}
.yte-page h3{font-size:1.05rem;margin:18px 0 8px}
.yte-page p,.yte-page li{color:#5c5666}
.yte-page a{color:#c2410c}
.yte-byline,.yte-updated{font-size:14px;color:#5c5666;margin:0 0 8px}
.yte-hero{display:block;width:100%;max-width:1200px;height:auto;margin:12px 0 20px;border-radius:12px}
.yte-bio{margin-top:36px;padding-top:16px;border-top:1px solid #d9d3dc;font-size:14px;color:#5c5666}
.yte-page pre{background:#17141c;color:#f6f1ea;padding:14px;border-radius:12px;overflow:auto;font-size:13px}
.yte-page nav{margin-top:28px}
.yte-form-grid{display:grid;gap:14px;margin:24px 0 8px}
.yte-form-grid label{display:grid;gap:6px;font-weight:600;color:#17141c}
.yte-form-grid input,.yte-form-grid textarea{width:100%;box-sizing:border-box;border:1px solid #d9d3dc;border-radius:16px;padding:12px 14px;font:inherit;color:#17141c;background:#fff}
.yte-form-grid textarea{min-height:140px;resize:vertical}
.yte-form-grid button{border:0;border-radius:999px;padding:12px 18px;cursor:pointer;font-weight:700;background:#17141c;color:#fff;justify-self:start}
.yte-hp{position:absolute;left:-9999px;height:0;width:0;overflow:hidden}
</style>`;

const HERO = "https://www.11tik.com/web-client/images/social/og-image-1200x630.png";

function wrap({ h1, alt, lead, body, faq, howTo, jsonHeadline, extra = "" }) {
  const faqJson = faq
    .map(
      (item) =>
        `{"@type":"Question","name":${JSON.stringify(item.q)},"acceptedAnswer":{"@type":"Answer","text":${JSON.stringify(item.a)}}}`,
    )
    .join(",");
  const howJson = howTo
    ? `{"@type":"HowTo","name":${JSON.stringify(howTo.name)},"step":[${howTo.steps
        .map((text, i) => `{"@type":"HowToStep","position":${i + 1},"text":${JSON.stringify(text)}}`)
        .join(",")}]}`
    : "";
  const graph = [
    `{"@type":"Article","headline":${JSON.stringify(jsonHeadline || h1)},"datePublished":"2026-08-19","dateModified":"2026-08-21","inLanguage":"en","author":{"@type":"Organization","name":"11tik","url":"https://www.11tik.com/p/about.html"},"publisher":{"@type":"Organization","name":"11tik","url":"https://www.11tik.com/"},"image":{"@type":"ImageObject","url":${JSON.stringify(HERO)},"width":1200,"height":630}}`,
    howJson,
    `{"@type":"FAQPage","mainEntity":[${faqJson}]}`,
  ]
    .filter(Boolean)
    .join(",");
  return `${STYLE}
<article class="yte-page">
  <h1>${h1}</h1>
  <p class="yte-byline">By <a href="https://www.11tik.com/p/about.html">11tik</a></p>
  <p class="yte-updated">Last updated: 21 August 2026</p>
  <p>${lead}</p>
  <img alt="${alt}" class="yte-hero" height="630" src="${HERO}" width="1200"/>
${body}
  <p class="yte-bio">Written by 11tik, publisher of the in-browser YouTube Thumbnail Extractor. See <a href="https://www.11tik.com/p/about.html">About</a> or <a href="https://www.11tik.com/p/contact.html">Contact</a>.</p>
  ${extra}
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[${graph}]}</script>
</article>
`;
}

writeFileSync(
  join(outDir, "how-to-download-youtube-thumbnail.html"),
  wrap({
    h1: "How to Download a YouTube Thumbnail in HD",
    jsonHeadline: "How to Download a YouTube Thumbnail in HD",
    alt: "Downloading a public HD YouTube thumbnail with the 11tik extractor",
    lead: "You can save YouTube’s public preview image in the browser, without installing software. Paste a public watch or Shorts URL into 11tik, then download the highest still YouTube actually published for that video ID.",
    howTo: {
      name: "How do I download a YouTube thumbnail in HD?",
      steps: [
        "Copy the public video or Shorts URL from YouTube.",
        "Paste it into https://www.11tik.com/.",
        "Download the first listed size, or pick another file that exists.",
      ],
    },
    faq: [
      {
        q: "How do I download a YouTube thumbnail in HD?",
        a: "Paste a public YouTube URL into 11tik and download the first listed size. That is the highest public still YouTube published.",
      },
      {
        q: "Do I need to install an app?",
        a: "No. The extractor runs in the browser and does not download the video file.",
      },
    ],
    extra: `<p><a href="https://www.11tik.com/">Open the extractor</a> · <a href="https://www.11tik.com/2026/08/youtube-thumbnail-url.html">Thumbnail URL</a> · <a href="https://www.11tik.com/2026/08/youtube-thumbnail-size-resolution.html">Sizes</a></p>`,
    body: `  <h2>How do I download a YouTube thumbnail in HD?</h2>
  <p>Copy the video URL, paste it on 11tik, and download the first listed file. That file is the highest public size that exists for that ID. A missing maxres file is normal; the next valid size is used instead.</p>
  <ol>
    <li>Copy the video or Shorts URL from YouTube.</li>
    <li>Open the <a href="https://www.11tik.com/">YouTube Thumbnail Extractor</a>.</li>
    <li>Paste the URL. Extraction starts when the ID is valid.</li>
    <li>Choose Download, or copy the direct image URL.</li>
  </ol>
  <h2>What file am I downloading?</h2>
  <p>You are saving a still image that YouTube already hosts on its public thumbnail servers. This is not a video or audio download and it does not unlock private videos.</p>
  <h2>What mistakes should I avoid?</h2>
  <p>Do not paste a channel or playlist URL with no video ID. Do not expect a 4K still; maxres is usually 1280×720 when it exists. A missing maxres file is not a tool failure.</p>`,
  }),
);

writeFileSync(
  join(outDir, "original-youtube-thumbnail-image.html"),
  wrap({
    h1: "How to Get the Original YouTube Thumbnail Image",
    alt: "Original public YouTube thumbnail file shown in the 11tik extractor",
    lead: "The original YouTube thumbnail is the public still YouTube hosts for that video ID, not a screenshot of the player. 11tik finds those files, lists only sizes that exist, and lets you download or copy the image URL.",
    howTo: {
      name: "How do I get the original YouTube thumbnail image?",
      steps: [
        "Paste a public YouTube URL into 11tik.",
        "Wait until valid public sizes appear.",
        "Download the top result or copy its image URL.",
      ],
    },
    faq: [
      {
        q: "What is the original YouTube thumbnail?",
        a: "The public image file YouTube hosts for the video ID, such as maxresdefault when it exists. It is not a screenshot of the watch page.",
      },
      {
        q: "Does original always mean 1280×720?",
        a: "No. Maxres is usually 1280×720 when published. If that file is missing, the original public still is the next size YouTube stored.",
      },
    ],
    extra: `<p><a href="https://www.11tik.com/">Extractor</a> · <a href="https://www.11tik.com/2026/08/highest-quality-youtube-thumbnail.html">Highest quality</a></p>`,
    body: `  <h2>What is the original YouTube thumbnail?</h2>
  <p>It is the preview image YouTube already stores on its image hosts. It is the file used in search and suggested shelves, not a frame you capture with Print Screen.</p>
  <h2>How is that different from a screenshot?</h2>
  <p>A screenshot includes player chrome, browser UI, and extra compression. The original file is a clean still at the pixel size YouTube published.</p>
  <h2>How do I find the original thumbnail?</h2>
  <p>Paste the watch, Shorts, live, or youtu.be URL into <a href="https://www.11tik.com/">11tik</a>. The tool reads the video ID, checks public files, and ranks the highest one that exists.</p>
  <h2>How do YouTube thumbnail URLs work?</h2>
  <p>They use the video ID plus a size name such as maxresdefault.jpg or hqdefault.jpg on i.ytimg.com. Guessing a size that was never published returns an error or a placeholder.</p>
  <h2>What is maxresdefault.jpg?</h2>
  <p>It is the common highest public filename, usually 1280×720 when YouTube created it. It is not a 4K master and it is not the video file.</p>
  <h2>Does original always mean 1280×720?</h2>
  <p>No. If maxres was never published, the original public image is hq, sd, or another surviving file. 11tik shows the real pixel size instead of inventing pixels.</p>
  <h2>Can I get the original still from Shorts, Live, or youtu.be?</h2>
  <p>Yes, when those URLs contain a public video ID and YouTube hosted public stills. The extractor treats them the same as a standard watch URL.</p>
  <h2>How do I check that I really got the original file?</h2>
  <p>Use the size and dimensions 11tik lists after it validates the file. If the image looks like a player screenshot, you did not download the hosted thumbnail.</p>`,
  }),
);

writeFileSync(
  join(outDir, "highest-quality-youtube-thumbnail.html"),
  wrap({
    h1: "How to Get the Highest Quality YouTube Thumbnail",
    alt: "Highest available public YouTube thumbnail selected in 11tik",
    lead: "The highest quality public YouTube thumbnail is the largest still YouTube actually published for that video, often maxresdefault at 1280×720. 11tik checks those files in your browser and lists only sizes that exist.",
    howTo: {
      name: "How do I get the highest quality YouTube thumbnail?",
      steps: [
        "Paste a public YouTube URL into 11tik.",
        "Wait for the ranked sizes.",
        "Download the first result, which is the highest valid public file.",
      ],
    },
    faq: [
      {
        q: "How do I get the highest quality YouTube thumbnail?",
        a: "Paste the public URL into 11tik and download the first listed size. That is the highest public file YouTube stored.",
      },
      {
        q: "Is the highest quality file 4K?",
        a: "Usually not. Public maxres is typically 1280×720. 11tik does not upscale or invent a larger master.",
      },
    ],
    extra: `<p><a href="https://www.11tik.com/">Extractor</a> · <a href="https://www.11tik.com/2026/08/youtube-thumbnail-size-resolution.html">Size guide</a></p>`,
    body: `  <h2>How do I get the highest quality YouTube thumbnail?</h2>
  <p>Paste a public URL into <a href="https://www.11tik.com/">11tik</a> and download the first listed size. The extractor ranks surviving public files; it does not stretch a small still into fake HD.</p>
  <h2>What is the maximum public resolution?</h2>
  <p>When YouTube published maxresdefault, it is usually 1280×720. If that file is missing, the highest quality is the next valid size such as sd or hq.</p>
  <h2>Does WebP matter?</h2>
  <p>Some videos also have WebP variants of the same size names. 11tik can surface those when they exist. Pick the file the tool validated, not a guessed URL.</p>
  <h2>Why does “HD” sometimes look soft?</h2>
  <p>The public still may be 1280×720 with compression, or you may be looking at hqdefault. Check the pixel size 11tik reports before you assume the download failed.</p>`,
  }),
);

writeFileSync(
  join(outDir, "youtube-shorts-thumbnail-download.html"),
  wrap({
    h1: "How to Download a YouTube Shorts Thumbnail in HD",
    alt: "Downloading a public YouTube Shorts thumbnail in 11tik",
    lead: "Shorts use a different watch URL, but public thumbnail files still key off the video ID. Paste a Shorts link into 11tik the same way you paste a watch URL, then download a still that actually exists.",
    howTo: {
      name: "How do I download a YouTube Shorts thumbnail?",
      steps: [
        "Copy a youtube.com/shorts/ URL that includes the video ID.",
        "Paste it into 11tik.",
        "Download a listed public size.",
      ],
    },
    faq: [
      {
        q: "Can I download a YouTube Shorts thumbnail?",
        a: "Yes, when YouTube published public stills for that Shorts video ID.",
      },
      {
        q: "Why does the still look letterboxed?",
        a: "YouTube may store a 16:9 derivative even for a vertical Short. 11tik shows the hosted file instead of inventing a crop.",
      },
    ],
    extra: `<p><a href="https://www.11tik.com/">Extractor</a> · <a href="https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html">How to download</a></p>`,
    body: `  <h2>How do I download a YouTube Shorts thumbnail?</h2>
  <p>Copy a URL that contains /shorts/ plus a video ID, paste it into <a href="https://www.11tik.com/">11tik</a>, and download a listed size. Extraction starts when the ID is valid.</p>
  <h2>Are Shorts files the same as watch-page files?</h2>
  <p>They use the same public size names keyed by video ID. The still may look letterboxed if YouTube stored a widescreen derivative.</p>
  <h2>What if no image appears?</h2>
  <p>The Short may be private, deleted, or without public stills. The extractor cannot bypass those limits.</p>`,
  }),
);

writeFileSync(
  join(outDir, "youtube-thumbnail-size-resolution.html"),
  wrap({
    h1: "YouTube Thumbnail Size and Resolution (2026)",
    alt: "Public YouTube thumbnail sizes listed in the 11tik extractor",
    lead: "YouTube does not give every video the same still. Public files are named by size. 11tik lists only the files that exist for that video ID, including WebP when YouTube published it.",
    faq: [
      {
        q: "What thumbnail sizes does YouTube actually publish?",
        a: "Common public files include default, mqdefault, hqdefault, sddefault, and maxresdefault. Maxres is usually 1280×720 when it exists.",
      },
      {
        q: "Why is maxres sometimes missing?",
        a: "YouTube did not publish that file for the video. The extractor uses the next valid size.",
      },
    ],
    extra: `<p><a href="https://www.11tik.com/">Extractor</a> · <a href="https://www.11tik.com/2026/08/highest-quality-youtube-thumbnail.html">Highest quality</a></p>`,
    body: `  <h2>What thumbnail sizes does YouTube actually publish?</h2>
  <p>Typical public names are default, mqdefault, hqdefault, sddefault, and maxresdefault. Maxres, when present, is usually 1280×720. The extractor never invents a larger file than YouTube stored.</p>
  <ul>
    <li><strong>maxresdefault</strong> — highest common public still, usually 1280×720 when present</li>
    <li><strong>sddefault</strong> — 640×480 class file when published</li>
    <li><strong>hqdefault</strong> — 480×360 class file</li>
    <li><strong>mqdefault</strong> — smaller medium file</li>
    <li><strong>default</strong> — smallest standard still</li>
  </ul>
  <h2>Why is maxres sometimes missing?</h2>
  <p>Some uploads never received a maxres file. 11tik then ranks the next valid image. That is expected, not a failed video download.</p>
  <h2>What size should I upload as a custom thumbnail?</h2>
  <p>YouTube’s custom upload is a different file you create in a design tool. This page describes public derivatives YouTube hosts after a video exists. For custom art, follow current YouTube Studio help; then confirm the live public still with 11tik.</p>`,
  }),
);

writeFileSync(
  join(outDir, "youtube-thumbnail-url.html"),
  wrap({
    h1: "How to Get a YouTube Thumbnail URL",
    alt: "Copying a public YouTube thumbnail URL in 11tik",
    lead: "A YouTube thumbnail URL is the direct address of a public preview image on hosts such as i.ytimg.com. It is not the watch page. 11tik copies that address after it confirms the file exists.",
    howTo: {
      name: "How do I get a YouTube thumbnail URL?",
      steps: [
        "Paste the public video URL into 11tik.",
        "Wait until valid sizes appear.",
        "Use Copy image URL on the size you need.",
      ],
    },
    faq: [
      {
        q: "How do I get a YouTube thumbnail URL?",
        a: "Paste the video into 11tik and copy the image URL of a size that exists.",
      },
    ],
    extra: `<p><a href="https://www.11tik.com/">Extractor</a> · <a href="https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html">How to download</a></p>`,
    body: `  <h2>How do I get a working YouTube thumbnail URL?</h2>
  <p>Paste the video or Shorts link into <a href="https://www.11tik.com/">11tik</a>, wait until valid sizes appear, then use Copy image URL. Guessing a size name that was never published returns an error or a placeholder.</p>
  <h2>Why is the watch URL not enough?</h2>
  <p>Thumbnail files use the video ID plus a size name such as maxresdefault.jpg. The watch URL identifies the video; it is not the still.</p>
  <h2>Can I build the URL by hand?</h2>
  <p>You can, but only if that size exists. 11tik validates the file first so you copy a working address.</p>`,
  }),
);

writeFileSync(
  join(outDir, "about.html"),
  `${STYLE}
<article class="yte-page">
  <h1>About 11tik</h1>
  <p class="yte-updated">Last updated: 21 August 2026</p>
  <p>11tik is the publisher of the YouTube Thumbnail Extractor at <a href="https://www.11tik.com/">www.11tik.com</a>. The site is run for people who need the public preview image of a YouTube or Vimeo video without installing software or uploading the link to a processing server.</p>
  <img alt="11tik YouTube Thumbnail Extractor product preview at 1200 by 630 pixels" class="yte-hero" height="630" src="${HERO}" width="1200"/>
  <h2>Who publishes this site?</h2>
  <p>Content and the extractor are published under the 11tik name. There is no invented expert persona and no fabricated review scores. Editorial pages explain how public thumbnail files work; they do not claim to be YouTube.</p>
  <h2>What does 11tik do?</h2>
  <p>The tool reads a public video ID in the browser, checks which thumbnail files exist on YouTube or Vimeo image hosts, and lets you download or copy those stills. Parsing and ranking stay on your device.</p>
  <h2>What does 11tik not do?</h2>
  <ul>
    <li>It does not download YouTube video or audio.</li>
    <li>It does not bypass private, age-gated, or region-blocked videos.</li>
    <li>It does not require an account.</li>
  </ul>
  <h2>How can I contact the publisher?</h2>
  <p>Use the <a href="https://www.11tik.com/p/contact.html">contact form</a>. Read the <a href="https://www.11tik.com/p/privacy.html">privacy policy</a> for analytics details.</p>
  <p class="yte-bio">11tik publishes practical guides about public YouTube thumbnails and maintains the free in-browser extractor.</p>
  <nav>
    <a href="https://www.11tik.com/">YouTube Thumbnail Extractor</a>
    · <a href="https://www.11tik.com/p/contact.html">Contact</a>
  </nav>
</article>
`,
);

writeFileSync(
  join(outDir, "privacy.html"),
  `${STYLE}
<article class="yte-page">
  <h1>Privacy Policy</h1>
  <p class="yte-updated">Last updated: 21 August 2026</p>
  <p>This policy explains how the YouTube Thumbnail Extractor at <a href="https://www.11tik.com/">www.11tik.com</a> handles URLs, browser storage, hosting logs, and Google Analytics. Pasted YouTube links are processed in your browser, not stored on an 11tik application server.</p>
  <h2>Where is a pasted YouTube URL processed?</h2>
  <p>In your browser. The page reads the video ID and checks public thumbnail image URLs on your device. This product does not have a backend that stores video URLs.</p>
  <h2>What is saved on my device?</h2>
  <p>The extractor may save recent URLs in this browser’s local storage so you can open them again. Clear it with the in-page history control, or by clearing this site’s data. It is not a cloud account.</p>
  <h2>What do hosting providers log?</h2>
  <p>The website and its static files are served by the hosts used for 11tik.com. Those hosts can keep ordinary web logs such as IP address, browser type, and the page requested, according to their own policies.</p>
  <h2>Which third parties are involved?</h2>
  <p>Thumbnail files are requested from YouTube’s public image hosts. The site uses Google Analytics 4 (measurement ID G-FW7B8NDZZ5) to count visits and in-page actions such as extract and download. Google may set cookies. Pasted YouTube URLs are not sent as analytics event parameters. Scripts may load from CDNs used to display the page.</p>
  <h2>How do I ask a privacy question?</h2>
  <p>Use the <a href="https://www.11tik.com/p/contact.html">Contact</a> form. Messages are emailed to the site operator. The form delivery service can see the name, email, and message you submit.</p>
  <nav>
    <a href="https://www.11tik.com/">YouTube Thumbnail Extractor</a>
    · <a href="https://www.11tik.com/p/about.html">About</a>
  </nav>
</article>
`,
);

writeFileSync(
  join(outDir, "contact.html"),
  `${STYLE}
<article class="yte-page">
  <h1>Contact</h1>
  <p class="yte-updated">Last updated: 21 August 2026</p>
  <p>Use this form for questions about the YouTube Thumbnail Extractor. Messages go to the 11tik operator by email. Do not send video or audio files. The tool only works with public thumbnail images.</p>
  <form class="yte-form-grid" action="https://formsubmit.co/jaouahircharifjaouahir@gmail.com" method="POST">
    <input type="hidden" name="_subject" value="11tik contact form"/>
    <input type="hidden" name="_template" value="table"/>
    <input type="hidden" name="_next" value="https://www.11tik.com/p/contact.html"/>
    <input type="hidden" name="_captcha" value="false"/>
    <input class="yte-hp" type="text" name="_honey" tabindex="-1" autocomplete="off"/>
    <label>
      Name
      <input type="text" name="name" required="required" autocomplete="name"/>
    </label>
    <label>
      Email
      <input type="email" name="email" required="required" autocomplete="email"/>
    </label>
    <label>
      Message
      <textarea name="message" required="required"></textarea>
    </label>
    <button type="submit">Send message</button>
  </form>
  <nav>
    <a href="https://www.11tik.com/">YouTube Thumbnail Extractor</a>
    · <a href="https://www.11tik.com/p/about.html">About</a>
    · <a href="https://www.11tik.com/p/privacy.html">Privacy Policy</a>
  </nav>
</article>
`,
);

writeFileSync(
  join(outDir, "keyword-tools.html"),
  `${STYLE}
<article class="yte-page">
  <h1>Keyword tools</h1>
  <p class="yte-updated">Last updated: 21 August 2026</p>
  <p>These links open the same YouTube Thumbnail Extractor with a short on-page intro for that topic. They are convenience shortcuts, not separate websites. Ranking stays on the homepage and the real guides.</p>
  <h2>What do these links do?</h2>
  <p>Each URL adds a <code>k</code> parameter so the extractor can show a matching intro. Use them if you already know the topic name. For search, prefer the homepage or the articles linked below.</p>
  <ul>
    <li><a href="https://www.11tik.com/?k=youtube-thumbnail-downloader">YouTube thumbnail downloader</a></li>
    <li><a href="https://www.11tik.com/?k=youtube-thumbnail-download">YouTube thumbnail download</a></li>
    <li><a href="https://www.11tik.com/?k=youtube-shorts-thumbnail">YouTube Shorts thumbnail</a></li>
    <li><a href="https://www.11tik.com/?k=youtube-thumbnail-url">YouTube thumbnail URL</a></li>
    <li><a href="https://www.11tik.com/?k=youtube-thumbnail-size">YouTube thumbnail size</a></li>
    <li><a href="https://www.11tik.com/?k=hd-youtube-thumbnail">HD YouTube thumbnail</a></li>
    <li><a href="https://www.11tik.com/?k=maxresdefault-thumbnail">maxresdefault thumbnail</a></li>
    <li><a href="https://www.11tik.com/?k=youtube-live-thumbnail">YouTube Live thumbnail</a></li>
    <li><a href="https://www.11tik.com/?k=youtu-be-thumbnail">youtu.be thumbnail</a></li>
    <li><a href="https://www.11tik.com/?k=original-youtube-thumbnail">Original YouTube thumbnail</a></li>
    <li><a href="https://www.11tik.com/?k=bulk-youtube-thumbnails">Bulk YouTube thumbnails</a></li>
  </ul>
  <h2>Where should I read the full guides?</h2>
  <p><a href="https://www.11tik.com/2026/08/how-to-download-youtube-thumbnail.html">How to download</a> · <a href="https://www.11tik.com/2026/08/youtube-thumbnail-url.html">Thumbnail URL</a> · <a href="https://www.11tik.com/2026/08/youtube-thumbnail-size-resolution.html">Sizes</a></p>
  <nav>
    <a href="https://www.11tik.com/">YouTube Thumbnail Extractor</a>
    · <a href="https://www.11tik.com/p/about.html">About</a>
  </nav>
</article>
`,
);

writeFileSync(
  join(outDir, "embed.html"),
  wrap({
    h1: "Embed the 11tik Thumbnail Extractor",
    alt: "11tik thumbnail extractor embed widget preview",
    lead: "You can add the free YouTube thumbnail extractor to a blog or docs page with an iframe. The widget loads from 11tik and resizes itself. No API key is required.",
    howTo: {
      name: "How do I embed the 11tik extractor?",
      steps: [
        "Copy the iframe snippet below.",
        "Keep id=yte-app on the iframe.",
        "Include embed.js from www.11tik.com/web-client/embed.js.",
      ],
    },
    faq: [
      {
        q: "How do I embed the 11tik extractor?",
        a: "Paste the iframe with id yte-app and the embed.js script. No API key is required.",
      },
    ],
    extra: `<nav><a href="https://www.11tik.com/">Open the extractor</a></nav>`,
    body: `  <h2>How do I embed the extractor?</h2>
  <p>Paste this snippet. Keep the id so height sync works, and do not clip the iframe with a tiny fixed height.</p>
  <pre>&lt;iframe
  id="yte-app"
  title="11tik YouTube Thumbnail Extractor"
  src="https://www.11tik.com/?embed=1"
  loading="lazy"
  style="width:100%;min-height:720px;border:0;border-radius:16px;"
&gt;&lt;/iframe&gt;
&lt;script src="https://www.11tik.com/web-client/embed.js" defer&gt;&lt;/script&gt;</pre>
  <h2>What rules should I follow?</h2>
  <ul>
    <li>Keep the <code>id="yte-app"</code> attribute.</li>
    <li>Do not wrap the iframe in a height that hides download buttons.</li>
    <li>Link back to <a href="https://www.11tik.com/">www.11tik.com</a> so users can open the full tool.</li>
  </ul>
  <h2>Can I deep-link a video?</h2>
  <p>Share <code>https://www.11tik.com/?v=VIDEO_ID</code> for YouTube or <code>https://www.11tik.com/?vimeo=ID</code> for Vimeo.</p>`,
  }),
);

console.log("wrote all ready pages to", outDir);
copyFileSync("docs/blogger-pages/about.html", join(outDir, "about.html"));
copyFileSync("docs/blogger-pages/privacy.html", join(outDir, "privacy.html"));
copyFileSync("docs/blogger-pages/contact.html", join(outDir, "contact.html"));
copyFileSync("docs/blogger-pages/terms.html", join(outDir, "terms.html"));
