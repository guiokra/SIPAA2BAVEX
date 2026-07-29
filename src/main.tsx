import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import "./index.css";

// Global error listeners for WebKit / iOS diagnostic monitoring
window.addEventListener("error", (event) => {
  console.error("GLOBAL ERROR:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("UNHANDLED PROMISE:", event.reason);
});

// Ensure service worker bypasses /api requests (Network-only for /api)
if ("serviceWorker" in navigator) {
  try {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          registration.update().catch(() => {});
        }
      })
      .catch(() => {});
  } catch (err) {
    console.warn("ServiceWorker registrations ignored:", err);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
