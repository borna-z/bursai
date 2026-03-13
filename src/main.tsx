import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Lazy-load Sentry to keep it out of the critical rendering path
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.2,
      environment: import.meta.env.MODE,
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
