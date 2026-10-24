import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StudioLanding } from "./marketing/StudioLanding";
import "./styles.css";
import "./design-system/ad-index-v4.css";
import "./design-system/ad-studio-index.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname === "/studio" || window.location.pathname === "/studio/" ? <StudioLanding /> : <App />}
  </React.StrictMode>,
);
