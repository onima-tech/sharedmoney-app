import { StrictMode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App";

/** Homepage document body. The client hydrates this instead of replacing #root. */
export function renderHomeDocument(): string {
  return renderToStaticMarkup(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
