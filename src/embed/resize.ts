import { config } from "../config";

export function postEmbedHeight(): void {
  if (!config || window.parent === window) return;
  const root = document.getElementById("root");
  const height = Math.ceil((root?.scrollHeight || document.body.scrollHeight) + 8);
  window.parent.postMessage({ source: "yte", type: "resize", height }, "*");
}

export function startEmbedResize(): () => void {
  if (!new URLSearchParams(window.location.search).get("embed")) return () => undefined;
  const publish = () => postEmbedHeight();
  publish();
  const observer = new ResizeObserver(publish);
  observer.observe(document.documentElement);
  window.addEventListener("load", publish);
  return () => {
    observer.disconnect();
    window.removeEventListener("load", publish);
  };
}
