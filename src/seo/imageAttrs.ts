export function imageSeoAttrs(input: {
  title?: string | null;
  quality?: string | null;
  tags?: string[];
  fallback?: string;
}): { alt: string; title: string } {
  const heading = String(input.title || input.fallback || "YouTube thumbnail").trim();
  const quality = input.quality ? ` ${input.quality}` : "";
  const keywords = (input.tags || []).map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12);
  const alt = `${heading}${quality} | 11tik`.slice(0, 180);
  const title = (keywords.length ? `${heading} – ${keywords.join(", ")}` : alt).slice(0, 220);
  return { alt, title };
}

export function stampSeoImages(root: ParentNode = document): void {
  const fallback = (typeof document !== "undefined" && document.title) || "11tik YouTube thumbnail";
  const visit = (node: ParentNode) => {
    node.querySelectorAll("img").forEach((img) => {
      const current = img.getAttribute("alt")?.trim();
      const alt = current && current !== "thumbnail" ? current : fallback;
      img.setAttribute("alt", alt);
      if (!img.getAttribute("title")?.trim()) img.setAttribute("title", alt);
    });
    node.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) visit(el.shadowRoot);
    });
  };
  visit(root);
}
