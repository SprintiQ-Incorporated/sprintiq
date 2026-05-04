/**
 * Debug Logger Utility
 *
 * Only logs in development mode to prevent sensitive information
 * from being exposed in production logs.
 */

export const debugLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
  }
};
