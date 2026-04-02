import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logger } from "@/lib/logger";

function scheduleAfterLoad(task: () => void) {
  const run = () => {
    const globalScope = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };

    if (typeof globalScope.requestIdleCallback === 'function') {
      globalScope.requestIdleCallback(task, { timeout: 4000 });
      return;
    }

    window.setTimeout(task, 1200);
  };

  if (document.readyState === 'complete') {
    run();
    return;
  }

  window.addEventListener('load', run, { once: true });
}

// Lazy-load Sentry to keep it out of the critical rendering path
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  scheduleAfterLoad(() => {
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
    }).catch((error) => {
      logger.warn("[Sentry] initialization skipped", error);
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

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      logger.warn('[ServiceWorker] registration failed', error);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
