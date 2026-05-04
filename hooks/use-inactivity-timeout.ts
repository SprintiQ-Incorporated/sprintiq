"use client";

import { useEffect, useRef, useCallback } from "react";

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

interface UseInactivityTimeoutOptions {
  onTimeout: () => void;
  isEnabled: boolean;
  timeout?: number;
}

/**
 * Hook that tracks user activity and calls onTimeout after a period of inactivity.
 * Monitors mouse movement, keyboard input, clicks, scrolls, and touch events.
 */
export function useInactivityTimeout({
  onTimeout,
  isEnabled,
  timeout = INACTIVITY_TIMEOUT,
}: UseInactivityTimeoutOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Keep the callback ref up to date
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, timeout);
  }, [timeout]);

  useEffect(() => {
    if (!isEnabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Activity events to monitor
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "wheel",
    ];

    // Throttle the reset timer to avoid excessive calls during mouse movement
    let lastActivity = Date.now();
    const throttleMs = 1000; // Only reset timer once per second max

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity >= throttleMs) {
        lastActivity = now;
        resetTimer();
      }
    };

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Also listen for visibility changes - reset timer when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Start the initial timer
    resetTimer();

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isEnabled, resetTimer]);
}
