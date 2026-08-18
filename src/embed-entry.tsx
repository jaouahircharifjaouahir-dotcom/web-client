import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function mount(): void {
  const el = document.getElementById("yte-root") || document.getElementById("root");
  if (!el) return;
  createRoot(el).render(<App />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
