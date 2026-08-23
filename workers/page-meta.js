import { descriptionForPath } from "./post-descriptions.js";

const PAGES = {
  "/p/about.html": {
    title: "About 11tik",
    description:
      "11tik is a free in-browser YouTube thumbnail extractor. Public stills only. No account and no video download.",
  },
  "/p/privacy.html": {
    title: "Privacy · 11tik",
    description:
      "11tik processes pasted URLs in your browser. Optional analytics use the 11tik.com cookie domain. Thumbnail files are not stored as original media.",
  },
  "/p/terms-of-use.html": {
    title: "Terms of use · 11tik",
    description:
      "Use 11tik with public URLs you may open. The tool is not a license to reuse a thumbnail. Copyright stays with the uploader.",
  },
  "/p/contact.html": {
    title: "Contact · 11tik",
    description: "Email 11tik at jaouahircharifjaouahir@gmail.com for product questions, privacy requests, or rights notices.",
  },
  "/p/embed.html": {
    title: "Embed the 11tik extractor",
    description:
      "Embed a free YouTube thumbnail extractor iframe on your site. No API key. Keep id=yte-app so height sync works.",
  },
  "/p/keyword-tools.html": {
    title: "Keyword tools · 11tik",
    description: "Open the 11tik extractor with a ready intro for common YouTube thumbnail search topics.",
  },
  "/copyright": {
    title: "Copyright & usage · 11tik",
    description:
      "How 11tik treats public YouTube thumbnails, copyright, and reuse. Stills only. No claim of ownership of creator art.",
  },
  "/p/copyright.html": {
    title: "Copyright & usage · 11tik",
    description:
      "How 11tik treats public YouTube thumbnails, copyright, and reuse. Stills only. No claim of ownership of creator art.",
  },
  "/stats": {
    title: "Thumbnail statistics · 11tik",
    description: "Counts from public 11tik extractions that passed the quality gate: title, tags, and a live thumbnail.",
  },
  "/trending-tags": {
    title: "Trending tags · 11tik",
    description: "Tags collected from public thumbnail extractions that passed the 11tik quality gate.",
  },
  "/guide": {
    title: "YouTube thumbnails guide · 11tik",
    description:
      "How public YouTube thumbnail files work: sizes, Shorts, URLs, and how 11tik lists only stills that exist.",
  },
  "/guide/youtube-thumbnails": {
    title: "YouTube thumbnails guide · 11tik",
    description:
      "How public YouTube thumbnail files work: sizes, Shorts, URLs, and how 11tik lists only stills that exist.",
  },
};

export function viewMeta(homeTitle, homeDescription, pathname) {
  const path = String(pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/") return { title: homeTitle, description: homeDescription };
  const tag = path.match(/^\/tag\/([^/]+)$/);
  if (tag) {
    const slug = decodeURIComponent(tag[1]);
    return {
      title: `#${slug} · 11tik`,
      description: `Public YouTube thumbnail extracts tagged ${slug} that passed the 11tik quality gate.`,
    };
  }
  const mapped = descriptionForPath(path);
  const hit = PAGES[path];
  if (hit) return { title: `${hit.title}`, description: mapped || hit.description };
  if (mapped) return { title: homeTitle, description: mapped };
  return {
    title: homeTitle,
    description: `${homeTitle}. Page on 11tik — public YouTube stills only.`,
  };
}
