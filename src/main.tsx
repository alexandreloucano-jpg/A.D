import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/bodoni-moda/latin-400.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StudioLanding } from "./marketing/StudioLanding";
import "./styles.css";
import "./design-system/ad-v4-fieldnotes.css";
import "./design-system/ad-v4-studio.css";
import "./design-system/ad-v5-monochrome-workspace.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname === "/studio" || window.location.pathname === "/studio/" ? <StudioLanding /> : <App />}
  </React.StrictMode>,
);
