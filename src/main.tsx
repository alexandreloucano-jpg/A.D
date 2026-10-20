import "@fontsource/bodoni-moda/latin-400-italic.css";
import "@fontsource/bodoni-moda/latin-400.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StudioLanding } from "./marketing/StudioLanding";
import "./styles.css";

const showStudioLanding = /^\/studio\/?$/.test(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {showStudioLanding ? <StudioLanding /> : <App />}
  </React.StrictMode>,
);
