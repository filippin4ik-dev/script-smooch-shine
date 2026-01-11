import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Auto-update: reload page when new version available
registerSW({
  onNeedRefresh() {
    // Automatically reload when new version is available
    window.location.reload();
  },
  onOfflineReady() {
    console.log("App ready to work offline");
  },
  immediate: true,
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
