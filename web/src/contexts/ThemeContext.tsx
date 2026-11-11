/* eslint-disable react-refresh/only-export-components */

/**
 * Theme Context
 * Manages dark mode state - defaults to system preference
 */
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyDarkClass(next: boolean) {
  document.documentElement.classList.toggle("dark", next);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start light so the hydrated homepage matches the server render. The head
  // script already set `html.dark` before paint; the effect below agrees with
  // that class instead of clearing it from this initial state.
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("theme");
    const manual = stored === "dark" || stored === "light";
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const next = manual ? stored === "dark" : mediaQuery.matches;
    applyDarkClass(next);

    if (manual) return;

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDark(event.matches);
      applyDarkClass(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    const legacyHandler = () => {
      setIsDark(mediaQuery.matches);
      applyDarkClass(mediaQuery.matches);
    };
    mediaQuery.addListener(legacyHandler);
    return () => mediaQuery.removeListener(legacyHandler);
  }, []);

  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains("dark");
    setIsDark(next);
    applyDarkClass(next);
    // Save user's manual choice for current session only
    sessionStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
