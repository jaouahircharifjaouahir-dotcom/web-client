const HOME_BLURB = /Download YouTube thumbnails instantly|highest available quality|Paste a video or Shorts URL/i;

export function applyDocumentMeta(title: string, description: string) {
  if (typeof document === "undefined") return;
  const desc = description.replace(/\s+/g, " ").trim().slice(0, 150);
  if (title) document.title = title.includes("11tik") ? title : `${title} · 11tik`;
  const pairs: Array<[string, string, string]> = [
    ["meta[name='description']", "name", "description"],
    ["meta[property='og:description']", "property", "og:description"],
    ["meta[name='twitter:description']", "name", "twitter:description"],
  ];
  for (const [sel, attr, name] of pairs) {
    let el = document.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", desc);
  }
  const ogTitle = document.querySelector("meta[property='og:title']");
  if (ogTitle && title) ogTitle.setAttribute("content", document.title);
  const twTitle = document.querySelector("meta[name='twitter:title']");
  if (twTitle && title) twTitle.setAttribute("content", document.title);
}

export function isHomeBlurb(value: string): boolean {
  return HOME_BLURB.test(value);
}
