export const TRUST_PAGES = {
  about: {
    title: "About 11tik",
    body: `11tik is a free public thumbnail extractor for YouTube and Vimeo. The project is built so creators can inspect the stills a platform already publishes, without downloading video or audio.

We do not ask for accounts. Extraction runs in your browser against public image URLs. Share pages exist so you can send a specific video's public stills to a teammate.

Contact: hello@11tik.com`,
  },
  privacy: {
    title: "Privacy policy",
    body: `11tik does not require a login. Pasted URLs are processed in your browser. Optional sitemap registration sends only a public video ID to our edge worker so Google can discover real share pages.

We do not sell personal data. Local history stays in your browser storage until you clear it. Contact hello@11tik.com for privacy questions.`,
  },
  terms: {
    title: "Terms of use",
    body: `The service is provided as-is for inspecting publicly hosted thumbnails. You are responsible for how you reuse those images. Do not use 11tik to infringe copyright, scrape at abusive volume, or impersonate another channel.

We may rate-limit automated traffic to keep the index useful.`,
  },
  contact: {
    title: "Contact",
    body: `Email: hello@11tik.com

For legal notices about a specific thumbnail, include the YouTube URL. We do not host the image files; we point to the public CDN.`,
  },
} as const;

export const PILLAR_GUIDE = {
  slug: "youtube-thumbnails",
  title: "The complete YouTube thumbnails guide",
  body: `A YouTube thumbnail is the public still viewers see before they press play. 11tik only reads files YouTube already hosts on i.ytimg.com. That is why the extractor can run in the browser: there is no private Studio download.

Start with a public watch, Shorts, live, or youtu.be link. The tool checks maxresdefault, hq720, sd, hq, mq, and default, then keeps files that are real images. If maxres was never published, the next valid size is the honest maximum.

Bulk mode accepts one URL per line, or a channel URL to pull the latest public uploads. Each video gets its own share link so Copy/Share never collapses onto the first result.

Related reading on this site covers size and resolution, Shorts stills, original vs screenshot, extractor vs maker, and YouTube Studio custom thumbs. Use the related block below — those links are the same cluster, not random pages.`,
};
