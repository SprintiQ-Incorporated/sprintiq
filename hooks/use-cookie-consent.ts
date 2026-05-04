import { useState, useEffect } from "react";

// Declare gtag function type
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

const COOKIE_PREFERENCES_KEY = "sprintiq-cookie-preferences";
const COOKIE_CONSENT_KEY = "sprintiq-cookie-consent";

export function useCookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    functional: false,
    marketing: false,
  });
  const [hasConsented, setHasConsented] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load saved preferences from localStorage
    const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    const savedPreferences = localStorage.getItem(COOKIE_PREFERENCES_KEY);

    if (savedConsent) {
      setHasConsented(true);
      if (savedPreferences) {
        const parsedPreferences = JSON.parse(savedPreferences);
        setPreferences(parsedPreferences);
        updateGoogleAnalytics(parsedPreferences.analytics);
      }
    }

    setIsLoading(false);
  }, []);

  const updateGoogleAnalytics = (analyticsEnabled: boolean) => {
    if (typeof window !== "undefined" && window.gtag) {
      if (analyticsEnabled) {
        // Enable analytics
        window.gtag("consent", "update", {
          analytics_storage: "granted",
        });
      } else {
        // Disable analytics
        window.gtag("consent", "update", {
          analytics_storage: "denied",
        });
      }
    }
  };

  const savePreferences = (newPreferences: CookiePreferences) => {
    setPreferences(newPreferences);
    setHasConsented(true);

    localStorage.setItem(
      COOKIE_PREFERENCES_KEY,
      JSON.stringify(newPreferences)
    );
    localStorage.setItem(COOKIE_CONSENT_KEY, "true");

    updateGoogleAnalytics(newPreferences.analytics);
  };

  const resetPreferences = () => {
    localStorage.removeItem(COOKIE_PREFERENCES_KEY);
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    setHasConsented(false);
    setPreferences({
      essential: true,
      analytics: false,
      functional: false,
      marketing: false,
    });
    updateGoogleAnalytics(false);
  };

  return {
    preferences,
    hasConsented,
    isLoading,
    savePreferences,
    resetPreferences,
    updateGoogleAnalytics,
  };
}
