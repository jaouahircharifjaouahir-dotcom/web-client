import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StudioApp } from "./StudioApp";
import "../index.css";
import "./studio.css";

createRoot(document.getElementById("studio-root")!).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>,
);
