import { NextResponse } from "next/server";

/**
 * Standardized API error response utility.
 * Use across API routes for consistent error formatting.
 */
export function apiError(
  message: string,
  status: number,
  code?: string
) {
  return NextResponse.json(
    {
      error: message,
      ...(code && { code }),
    },
    { status }
  );
}

export function apiValidationError(errors: Record<string, string>) {
  return NextResponse.json(
    {
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: errors,
    },
    { status: 400 }
  );
}
