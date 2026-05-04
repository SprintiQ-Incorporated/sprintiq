/**
 * Utility functions for handling API errors consistently across the application.
 */

/**
 * Returns a user-friendly error message based on HTTP status code.
 */
export function getErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Invalid request. Please check your input and try again.";
    case 401:
      return "Authentication required. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
      return "Server error. Please try again later.";
    case 503:
      return "Service temporarily unavailable. Please try again later.";
    default:
      return `An unexpected error occurred (${status}).`;
  }
}

/**
 * Extracts error message from API response, falling back to status-based message.
 */
export async function extractApiError(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  try {
    const errorData = await response.json();
    return errorData.error || fallbackMessage;
  } catch {
    // If response body isn't JSON, use status-based message
    return getErrorMessage(response.status);
  }
}
