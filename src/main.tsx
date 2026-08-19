import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bootLite } from "./boot/lite";
import App from "./App.tsx";
import "./index.css";

bootLite();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
