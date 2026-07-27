import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/** Shared by the homepage and the standalone toys — one key, one class. */
export const THEME_KEY = "theme";

export type Theme = "dark" | "light";

function storedTheme(): Theme | null {
  const value = window.localStorage.getItem(THEME_KEY);
  return value === "dark" || value === "light" ? value : null;
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Reads the preference the homepage writes, falling back to the OS setting
 * until the visitor picks a side. Keeps in sync with other tabs — and with the
 * homepage itself when a toy is opened inside its preview iframe.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => storedTheme() ?? systemTheme(),
  );

  useLayoutEffect(() => {
    const dark = theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [theme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setTheme(storedTheme() ?? systemTheme());
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      // An explicit choice always wins over the OS.
      if (!storedTheme()) setTheme(systemTheme());
    };
    window.addEventListener("storage", onStorage);
    media.addEventListener("change", onSystem);
    return () => {
      window.removeEventListener("storage", onStorage);
      media.removeEventListener("change", onSystem);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_KEY, next);
    if (!document.startViewTransition) {
      setTheme(next);
      return;
    }
    document.startViewTransition({
      types: ["theme"],
      update: () => setTheme(next),
    });
  }, [theme]);

  return { theme, toggleTheme };
}
