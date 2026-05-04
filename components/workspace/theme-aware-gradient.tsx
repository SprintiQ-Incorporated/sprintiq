"use client";

import { useEffect, useState } from "react";

// Function to get gradient colors based on theme
function getThemeGradientColors(theme: string = "green") {
  const themeGradients = {
    green: "from-emerald-600 via-green-600 to-teal-600",
    blue: "from-blue-600 via-indigo-600 to-cyan-600",
    red: "from-red-600 via-rose-600 to-pink-600",
    gray: "from-gray-600 via-slate-600 to-zinc-600",
    orange: "from-orange-600 via-amber-600 to-yellow-600",
    pink: "from-pink-600 via-rose-600 to-red-600",
    cyan: "from-cyan-600 via-teal-600 to-blue-600",
    brown: "from-yellow-600 via-orange-600 to-amber-600",
    purple: "from-purple-600 via-violet-600 to-indigo-600",
  };

  return (
    themeGradients[theme as keyof typeof themeGradients] || themeGradients.green
  );
}

interface ThemeAwareGradientProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ThemeAwareGradient({
  className = "",
  children,
}: ThemeAwareGradientProps) {
  const [gradientClass, setGradientClass] = useState(
    "from-emerald-600 via-green-600 to-teal-600"
  );

  useEffect(() => {
    // Function to update gradient based on current theme
    const updateGradient = () => {
      const savedColorTheme = localStorage.getItem("color-theme") || "green";
      const gradient = getThemeGradientColors(savedColorTheme);
      setGradientClass(gradient);
    };

    // Set initial gradient
    updateGradient();

    // Listen for theme changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "color-theme") {
        const newTheme = e.newValue || "green";
        const newGradient = getThemeGradientColors(newTheme);
        setGradientClass(newGradient);
      }
    };

    // Listen for custom theme change events (when theme is changed programmatically)
    const handleThemeChange = (e: CustomEvent) => {
      const newTheme =
        e.detail?.color || localStorage.getItem("color-theme") || "green";
      const gradient = getThemeGradientColors(newTheme);
      setGradientClass(gradient);
    };

    // Watch for changes to document class list (fallback mechanism)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          // Check if a theme class was added/removed
          const target = mutation.target as HTMLElement;
          const classList = target.classList;
          const hasThemeClass = Array.from(classList).some((cls) =>
            cls.startsWith("theme-")
          );

          if (hasThemeClass) {
            // Small delay to ensure localStorage is updated
            setTimeout(updateGradient, 10);
          }
        }
      });
    });

    // Start observing
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "theme-changed",
      handleThemeChange as EventListener
    );

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "theme-changed",
        handleThemeChange as EventListener
      );
    };
  }, [localStorage.getItem("color-theme")]);

  return (
    <div className={`bg-gradient-to-r ${gradientClass} ${className}`}>
      {children}
    </div>
  );
}
