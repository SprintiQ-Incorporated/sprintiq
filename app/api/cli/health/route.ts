import { NextResponse } from "next/server";

/**
 * GET /api/cli/health
 * Simple health check endpoint for `sprintiq doctor`.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}
