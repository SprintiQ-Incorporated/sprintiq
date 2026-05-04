/**
 * Performance Optimization Hooks
 *
 * Debounce and throttle utilities for INP optimization.
 * Use these for scroll handlers and other high-frequency events.
 */

import { useCallback, useRef, useEffect } from "react";

/**
 * Creates a debounced version of a callback function.
 * The callback will only execute after the specified delay
 * has passed without any new calls.
 *
 * @param callback - Function to debounce
 * @param delay - Delay in milliseconds (default: 150ms for scroll events)
 * @returns Debounced function
 *
 * @example
 * const debouncedScroll = useDebounce(() => {
 *   setIsScrolled(window.scrollY > 10);
 * }, 16); // ~60fps
 */
export function useDebounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number = 150
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  return debouncedFn;
}

/**
 * Creates a throttled version of a callback function.
 * The callback will execute at most once per specified interval.
 * Uses requestAnimationFrame for optimal scroll performance.
 *
 * @param callback - Function to throttle
 * @param useRAF - Use requestAnimationFrame instead of setTimeout (default: true)
 * @returns Throttled function
 *
 * @example
 * const throttledScroll = useThrottle(() => {
 *   setIsScrolled(window.scrollY > 10);
 * });
 */
export function useThrottle<T extends (...args: unknown[]) => void>(
  callback: T,
  useRAF: boolean = true
): T {
  const pendingRef = useRef(false);
  const callbackRef = useRef(callback);
  const rafIdRef = useRef<number | null>(null);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const throttledFn = useCallback(
    (...args: Parameters<T>) => {
      if (pendingRef.current) return;

      pendingRef.current = true;

      if (useRAF) {
        rafIdRef.current = requestAnimationFrame(() => {
          callbackRef.current(...args);
          pendingRef.current = false;
        });
      } else {
        callbackRef.current(...args);
        // Use 16ms (~60fps) for time-based throttling
        setTimeout(() => {
          pendingRef.current = false;
        }, 16);
      }
    },
    [useRAF]
  ) as T;

  return throttledFn;
}

/**
 * Custom hook for optimized scroll event handling.
 * Automatically uses requestAnimationFrame for smooth performance.
 *
 * @param callback - Scroll event handler
 * @param options - Configuration options
 *
 * @example
 * useScrollHandler(() => {
 *   setIsScrolled(window.scrollY > 10);
 * }, { passive: true });
 */
export function useScrollHandler(
  callback: () => void,
  options: { passive?: boolean } = { passive: true }
) {
  const throttledCallback = useThrottle(callback);

  useEffect(() => {
    // Run initial check
    callback();

    window.addEventListener("scroll", throttledCallback, {
      passive: options.passive,
    });

    return () => {
      window.removeEventListener("scroll", throttledCallback);
    };
  }, [throttledCallback, options.passive, callback]);
}

export default useDebounce;
