import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.jsx";
import { installClientCacheProbe } from "./lib/client-cache/dev-probe.js";
import { initTheme } from "./shared/ui/theme.js";
import "./styles.css";

installClientCacheProbe();
initTheme();

if (typeof history !== "undefined" && "scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
