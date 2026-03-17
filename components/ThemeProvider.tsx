"use client";

import { useEffect, useState } from "react";
import { getUserTheme } from "@/app/actions/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initializeTheme = async () => {
      setMounted(true);
      console.log("[ThemeProvider] initializeTheme");
      
      // Try to get theme from database first
      try {
        const result = await getUserTheme();
        if (result.success && result.theme) {
          const isDark = result.theme === "dark";
          if (isDark) {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
          // Sync with localStorage
          localStorage.setItem("theme", result.theme);
          return;
        }
      } catch (error) {
        console.log("[THEME] Could not load theme from database, using fallback");
      }

      // Fallback to localStorage or system preference
      const savedTheme = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
      const systemPrefersDark =
        typeof window !== "undefined"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
          : false;
      const isDark = savedTheme === "dark" || (!savedTheme && systemPrefersDark);
      
      if (isDark) {
        if (typeof document !== "undefined") {
          document.documentElement.classList.add("dark");
        }
      } else {
        if (typeof document !== "undefined") {
          document.documentElement.classList.remove("dark");
        }
      }
    };

    initializeTheme();
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}

export function useTheme() {
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      setMounted(true);
      
      // Try to get theme from database first
      try {
        const result = await getUserTheme();
        if (result.success && result.theme) {
          const isDark = result.theme === "dark";
          setDarkMode(isDark);
          // Sync with localStorage
          localStorage.setItem("theme", result.theme);
          return;
        }
      } catch (error) {
        console.log("[THEME] Could not load theme from database, using fallback");
      }

      // Fallback to localStorage or system preference
      const savedTheme = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
      const systemPrefersDark =
        typeof window !== "undefined"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
          : false;
      const isDark = savedTheme === "dark" || (!savedTheme && systemPrefersDark);
      setDarkMode(isDark);
    };

    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = !darkMode;
    setDarkMode(newTheme);
    
    const themeValue = newTheme ? "dark" : "light";
    
    // Update DOM immediately for instant feedback
    if (typeof document !== "undefined") {
      if (newTheme) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    
    // Save to localStorage immediately
    localStorage.setItem("theme", themeValue);
    
    // Save to database in the background
    try {
      const { updateUserTheme } = await import("@/app/actions/theme");
      await updateUserTheme(themeValue);
    } catch (error) {
      console.error("[THEME] Failed to save theme to database:", error);
      // Continue anyway - localStorage is already updated
    }
  };

  return { darkMode, toggleTheme, mounted };
}
