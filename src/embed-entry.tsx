import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const embedScript = document.currentScript as HTMLScriptElement | null;

function restoreNativeDom(): void {
  const frame = document.createElement("iframe");
  frame.style.cssText = "display:none;width:0;height:0;border:0;position:absolute";
  document.documentElement.appendChild(frame);
  const native = frame.contentWindow;
  if (native?.Node) {
    Node.prototype.insertBefore = native.Node.prototype.insertBefore;
    Node.prototype.appendChild = native.Node.prototype.appendChild;
    Node.prototype.removeChild = native.Node.prototype.removeChild;
    Node.prototype.replaceChild = native.Node.prototype.replaceChild;
  }
  frame.remove();
}

function cssHref(): string {
  if (embedScript?.src) return new URL("blogger-app.css", embedScript.src).href;
  return "blogger-app.css";
}

function mount(): void {
  const host = document.getElementById("yte-root") || document.getElementById("root");
  if (!host || host.getAttribute("data-yte-mounted") === "1") return;
  host.setAttribute("data-yte-mounted", "1");
  restoreNativeDom();

  const useShadow = "attachShadow" in host && host.id === "yte-root";
  const rootNode = useShadow ? host.shadowRoot ?? host.attachShadow({ mode: "open" }) : host;
  if (useShadow) {
    const styles = document.createElement("link");
    styles.rel = "stylesheet";
    styles.href = cssHref();
    rootNode.appendChild(styles);
  }

  const mountPoint = document.createElement("div");
  mountPoint.id = "yte-mount";
  rootNode.appendChild(mountPoint);
  createRoot(mountPoint).render(<App />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
