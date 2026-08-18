import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { keepDomGuards } from "./embed/dom-guard";
import "./index.css";

const embedScript = document.currentScript as HTMLScriptElement | null;

function cssHref(): string {
  if (embedScript?.src) return new URL("blogger-app.css", embedScript.src).href;
  return "blogger-app.css";
}

function mount(): void {
  const host = document.getElementById("yte-root") || document.getElementById("root");
  if (!host || host.getAttribute("data-yte-mounted") === "1") return;
  host.setAttribute("data-yte-mounted", "1");
  keepDomGuards();

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

keepDomGuards();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
