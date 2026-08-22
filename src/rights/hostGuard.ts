const HOME = "https://www.11tik.com/";

export function isAllowedHost(host: string): boolean {
  const name = host.toLowerCase();
  if (name === "localhost" || name === "127.0.0.1") return true;
  return name === "11tik.com" || name.endsWith(".11tik.com");
}

/** If this bundle is opened off 11tik.com (copied page or GitHub Pages), send visitors home. */
export function enforceHomeHost(): void {
  if (typeof location === "undefined") return;
  if (isAllowedHost(location.hostname)) return;
  location.replace(`${HOME}p/terms-of-use.html`);
}

export function watchCopyNotice(): void {
  if (typeof document === "undefined") return;
  document.addEventListener("copy", (event) => {
    const selected = window.getSelection()?.toString() || "";
    const notice = "\n\n© 11tik — https://www.11tik.com/  Content is protected. See https://www.11tik.com/p/terms-of-use.html";
    try {
      event.clipboardData?.setData("text/plain", `${selected}${notice}`);
      event.preventDefault();
    } catch {
      /* keep native copy */
    }
    showCopyToast();
  });
}

function showCopyToast(): void {
  const id = "yte-copy-notice";
  document.getElementById(id)?.remove();
  const el = document.createElement("div");
  el.id = id;
  el.className = "yte-copy-notice";
  el.setAttribute("role", "status");
  el.textContent = "© 11tik — this content is protected. https://www.11tik.com/";
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 4000);
}
