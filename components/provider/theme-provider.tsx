"use client";

import * as React from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextThemes,
} from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export type Theme = "light" | "dark" | "system";
type Color =
  | "default"
  | "blue"
  | "red"
  | "gray"
  | "orange"
  | "pink"
  | "cyan"
  | "brown"
  | "green"
  | "purple"
  | "yellow";

interface CustomThemeProviderProps extends ThemeProviderProps {
  children: React.ReactNode;
}

interface ThemeContextType {
  theme: Theme | undefined; // user's selection
  setTheme: (theme: Theme) => void;
  color: Color;
  setColor: (color: Color) => void;
  resolvedTheme: Theme | undefined; // add this
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(
  undefined
);

export function ThemeProvider({
  children,
  ...props
}: CustomThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <InternalThemeProviderContent>{children}</InternalThemeProviderContent>
    </NextThemesProvider>
  );
}

function InternalThemeProviderContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, setTheme, resolvedTheme } = useNextThemes();
  const [color, setColorState] = React.useState<Color>("green");

  // Load saved color theme on mount
  React.useEffect(() => {
    const savedColor = localStorage.getItem("color-theme") as Color;
    if (savedColor) {
      setColorState(savedColor);
      applyColorTheme(savedColor);

      // Dispatch custom event for initial theme load
      window.dispatchEvent(
        new CustomEvent("theme-changed", {
          detail: { color: savedColor },
        })
      );
    }
  }, []);

  const applyColorTheme = (colorValue: Color) => {
    const root = document.documentElement;

    // Remove all existing theme classes
    const themeClasses = [
      "theme-green",
      "theme-blue",
      "theme-red",
      "theme-gray",
      "theme-orange",
      "theme-pink",
      "theme-cyan",
      "theme-brown",
      "theme-purple",
    ];
    themeClasses.forEach((cls) => root.classList.remove(cls));

    // Add new theme class (skip for default)
    if (colorValue !== "default") {
      root.classList.add(`theme-${colorValue}`);
    }
  };

  const handleSetColor = (newColor: Color) => {
    setColorState(newColor);
    localStorage.setItem("color-theme", newColor);
    applyColorTheme(newColor);

    // Dispatch custom event for theme change
    window.dispatchEvent(
      new CustomEvent("theme-changed", {
        detail: { color: newColor },
      })
    );
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: theme as Theme, // user's selection
        setTheme: setTheme as (theme: Theme) => void,
        color,
        setColor: handleSetColor,
        resolvedTheme: resolvedTheme as Theme, // add this line
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
