/**
 * Shared HTTP error handling utilities
 * Provides consistent error messages across the application
 */

export interface HttpErrorOptions {
  /** Default error message if none can be extracted */
  defaultMessage?: string;
  /** Context-specific messages for certain status codes */
  contextMessages?: {
    401?: string;
    403?: string;
    429?: string;
    500?: string;
  };
}

/**
 * Standard HTTP status code error messages
 */
export const HTTP_ERROR_MESSAGES = {
  401: "Please sign in to use this feature",
  403: "You don't have permission to use this feature",
  429: "Too many requests. Please wait a moment and try again",
  500: "Server error. Please try again later",
  502: "Service temporarily unavailable. Please try again",
  503: "Service temporarily unavailable. Please try again",
} as const;

/**
 * Extracts error message from a Response object
 * Tries to parse JSON body first, falls back to status-based messages
 */
export async function extractErrorMessage(
  response: Response,
  options: HttpErrorOptions = {}
): Promise<string> {
  const { defaultMessage = "An error occurred", contextMessages = {} } = options;

  // Try to extract error message from response body
  let errorMessage = defaultMessage;
  try {
    const errorData = await response.json();
    if (errorData.error) {
      errorMessage = errorData.error;
    } else if (errorData.message) {
      errorMessage = errorData.message;
    }
  } catch {
    // Response body isn't JSON, continue with status-based messages
  }

  // Return context-specific message if provided, otherwise use standard messages
  switch (response.status) {
    case 401:
      return contextMessages[401] || HTTP_ERROR_MESSAGES[401];
    case 403:
      return contextMessages[403] || errorMessage || HTTP_ERROR_MESSAGES[403];
    case 429:
      return contextMessages[429] || HTTP_ERROR_MESSAGES[429];
    case 500:
      return contextMessages[500] || HTTP_ERROR_MESSAGES[500];
    case 502:
    case 503:
      return HTTP_ERROR_MESSAGES[502];
    default:
      return errorMessage;
  }
}

/**
 * Creates an Error from a non-OK Response
 * Convenience wrapper around extractErrorMessage
 */
export async function createHttpError(
  response: Response,
  options: HttpErrorOptions = {}
): Promise<Error> {
  const message = await extractErrorMessage(response, options);
  return new Error(message);
}

/**
 * Type guard to check if an error has a message property
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

/**
 * Safely extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return "An unexpected error occurred";
}
