import { bootLite } from "./boot/lite";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { stampSeoImages } from "./seo/imageAttrs";
import { keepDomGuards } from "./embed/dom-guard";
import { preloadUiCatalog } from "./i18n/uiCatalog";
import { readLocale } from "./i18n/ui";
import "./index.css";

bootLite();

function cssHref(): string {
  const scripts = document.querySelectorAll("script[src]");
  for (let i = 0; i < scripts.length; i++) {
    const src = (scripts[i] as HTMLScriptElement).src;
    if (!src.includes("blogger-app.js")) continue;
    const css = new URL("blogger-app.css", src);
    css.search = new URL(src).search;
    return css.href;
  }
  return "blogger-app.css";
}

const CRITICAL_SHADOW_CSS = `:host{display:block;min-height:100svh;min-height:100vh}
.yte-app{min-height:100svh;min-height:100vh}
.yte-shell{width:min(920px,calc(100% - 24px));margin:0 auto;padding:16px 0 40px}
.yte-lang,.yte-lang select{max-width:200px}
.yte-ad{min-height:90px}`;

function paintApp(rootNode: ParentNode): void {
  const mountPoint = document.createElement("div");
  mountPoint.id = "yte-mount";
  rootNode.appendChild(mountPoint);
  createRoot(mountPoint).render(<App />);
  window.setTimeout(() => stampSeoImages(), 50);
}

async function applyShadowCss(rootNode: ShadowRoot): Promise<void> {
  const boot = document.createElement("style");
  boot.textContent = CRITICAL_SHADOW_CSS;
  rootNode.appendChild(boot);
  try {
    const res = await fetch(cssHref());
    if (!res.ok) return;
    const css = await res.text();
    const full = document.createElement("style");
    full.textContent = css;
    rootNode.appendChild(full);
  } catch {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref();
    await new Promise<void>((resolve) => {
      link.onload = () => resolve();
      link.onerror = () => resolve();
      window.setTimeout(resolve, 800);
      rootNode.appendChild(link);
    });
  }
}

function mount(): void {
  const host = document.getElementById("yte-root") || document.getElementById("root");
  if (!host || host.getAttribute("data-yte-mounted") === "1") return;
  host.setAttribute("data-yte-mounted", "1");
  keepDomGuards();

  const useShadow = "attachShadow" in host && host.id === "yte-root";
  const rootNode = useShadow ? host.shadowRoot ?? host.attachShadow({ mode: "open" }) : host;
  const start = () => {
    if (useShadow) void applyShadowCss(rootNode as ShadowRoot);
    paintApp(rootNode);
  };
  void preloadUiCatalog(readLocale()).finally(start);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
