import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logger } from "@/lib/logger";

// Lazy-load Sentry to keep it out of the critical rendering path
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.2,
      environment: import.meta.env.MODE,
      release: `burs@${__APP_VERSION__}`,
    });

    // Capture unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      Sentry.captureException(event.reason);
    });
  });
}

// Global fallback for unhandled errors (even without Sentry)
window.addEventListener("error", (event) => {
  logger.error("[GlobalError]", event.error?.message || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  logger.error("[UnhandledRejection]", event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
