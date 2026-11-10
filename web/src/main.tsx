import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initializeAnalytics } from "./analytics";
import { enableSpeedInsights } from "./speedInsights";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App.tsx";
import "./index.css";
import { billSplitRoute } from "./billSplitApi";

// Bearer bill links and guest names must not enter marketing analytics.
// Speed Insights still runs there; its reporter strips the token from the URL.
if (billSplitRoute(window.location.pathname) === undefined) initializeAnalytics();
enableSpeedInsights();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
